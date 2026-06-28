const AccountingConnection = require('../models/AccountingConnection');

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.XERO_CLIENT_ID,
    redirect_uri: process.env.XERO_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email accounting.transactions.read accounting.contacts.read offline_access',
    state
  });
  return `${XERO_AUTH_URL}?${params}`;
}

async function exchangeCode(code) {
  const auth = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero token exchange failed: ${text}`);
  }

  return res.json();
}

async function refreshAccessToken(connection) {
  const auth = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.getRefreshToken()
    })
  });

  if (!res.ok) {
    throw new Error('Xero token refresh failed');
  }

  const tokens = await res.json();
  connection.accessToken = tokens.access_token;
  connection.refreshToken = tokens.refresh_token;
  connection.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await connection.save();

  return connection;
}

async function getValidToken(connection) {
  if (new Date() >= connection.tokenExpiresAt) {
    connection = await refreshAccessToken(connection);
  }
  return connection.getAccessToken();
}

async function getTenantId(accessToken) {
  const res = await fetch('https://api.xero.com/connections', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) throw new Error('Failed to get Xero tenants');
  const tenants = await res.json();
  return tenants[0]?.tenantId || null;
}

async function fetchInvoices(connection, since) {
  const token = await getValidToken(connection);

  let url = `${XERO_API_BASE}/Invoices?Statuses=AUTHORISED,SENT&page=1`;
  if (since) {
    url += `&where=UpdatedDateUTC>DateTime(${since.getFullYear()},${since.getMonth() + 1},${since.getDate()})`;
  }

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Xero-Tenant-Id': connection.tenantId,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API error: ${text}`);
  }

  const data = await res.json();
  return (data.Invoices || []).map(inv => ({
    externalId: inv.InvoiceID,
    invoiceNumber: inv.InvoiceNumber,
    clientName: inv.Contact?.Name || 'Unknown',
    clientEmail: inv.Contact?.EmailAddress || '',
    amount: parseFloat(inv.AmountDue || inv.Total || 0),
    dueDate: inv.DueDateString ? new Date(inv.DueDateString) : new Date(),
    status: inv.AmountDue > 0 ? 'sent' : 'paid'
  }));
}

async function getOrganisationName(connection) {
  const token = await getValidToken(connection);

  const res = await fetch(`${XERO_API_BASE}/Organisation`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Xero-Tenant-Id': connection.tenantId,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.Organisations?.[0]?.Name || null;
}

module.exports = { getAuthUrl, exchangeCode, getTenantId, fetchInvoices, getOrganisationName };
