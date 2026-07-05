/**
 * Shared formatting helpers for emails, PDFs, and messages.
 */

/**
 * Escape a string for safe interpolation into HTML (email bodies).
 * Client-supplied values (names, invoice numbers) must pass through this
 * before being embedded in HTML email templates.
 */
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format an amount in the invoice's currency (e.g. "€1,200.00", "PKR 5,000").
 * Falls back to a plain "USD 1,200" style prefix if the currency code is
 * unknown to Intl.
 */
function formatCurrency(amount, currency = 'USD') {
    const value = Number(amount) || 0;
    const code = (currency || 'USD').toUpperCase();
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
        }).format(value);
    } catch {
        return `${code} ${value.toLocaleString('en-US')}`;
    }
}

/**
 * Return a valid IANA timezone, falling back to UTC for missing/bad values.
 */
function safeTimeZone(tz) {
    if (!tz) return 'UTC';
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return tz;
    } catch {
        return 'UTC';
    }
}

/**
 * Calendar date (YYYY-MM-DD) of a moment as seen in a timezone.
 */
function dateKeyInTz(date, tz) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: safeTimeZone(tz),
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

/**
 * Whole days between the due date and now, as experienced in the given
 * timezone. 0 = due today, negative = due in the future, positive = overdue.
 */
function daysSinceDue(dueDate, tz, now = new Date()) {
    const nowKey = dateKeyInTz(now, tz);
    const dueKey = dateKeyInTz(new Date(dueDate), tz);
    return Math.round((Date.parse(nowKey) - Date.parse(dueKey)) / 86400000);
}

/**
 * Human date ("Mar 5, 2026") as seen in a timezone.
 */
function formatDateInTz(date, tz) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: safeTimeZone(tz),
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(date));
}

module.exports = { escapeHtml, formatCurrency, safeTimeZone, dateKeyInTz, daysSinceDue, formatDateInTz };
