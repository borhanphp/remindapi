const AccountingConnection = require('../models/AccountingConnection');

const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_API_BASE = process.env.QB_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID,
    redirect_uri: process.env.QB_REDIRECT_URI,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    state
  });
  return `${QB_AUTH_URL}?${params}`;
}

async function exchangeCode(code) {
  const auth = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.QB_REDIRECT_URI
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks token exchange failed: ${text}`);
  }

  return res.json();
}

async function refreshAccessToken(connection) {
  const auth = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(QB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.getRefreshToken()
    })
  });

  if (!res.ok) {
    throw new Error('QuickBooks token refresh failed');
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

async function fetchInvoices(connection, since) {
  const token = await getValidToken(connection);

  let query = "SELECT * FROM Invoice WHERE Balance > '0'";
  if (since) {
    query += ` AND MetaData.LastUpdatedTime >= '${since.toISOString()}'`;
  }
  query += " MAXRESULTS 100";

  const url = `${QB_API_BASE}/v3/company/${connection.realmId}/query?query=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks API error: ${text}`);
  }

  const data = await res.json();
  return (data.QueryResponse?.Invoice || []).map(inv => ({
    externalId: inv.Id,
    invoiceNumber: inv.DocNumber,
    clientName: inv.CustomerRef?.name || 'Unknown',
    clientEmail: inv.BillEmail?.Address || '',
    amount: parseFloat(inv.Balance || inv.TotalAmt || 0),
    dueDate: inv.DueDate ? new Date(inv.DueDate) : new Date(),
    status: inv.Balance > 0 ? 'sent' : 'paid'
  }));
}

async function getCompanyInfo(connection) {
  const token = await getValidToken(connection);
  const url = `${QB_API_BASE}/v3/company/${connection.realmId}/companyinfo/${connection.realmId}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.CompanyInfo?.CompanyName || null;
}

module.exports = { getAuthUrl, exchangeCode, refreshAccessToken, fetchInvoices, getCompanyInfo };
