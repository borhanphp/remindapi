/**
 * Input Sanitization Utilities
 * Prevents NoSQL injection and other input-based attacks
 */

const mongoose = require('mongoose');

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param {string} str - Input string to escape
 * @returns {string} - Escaped string safe for use in regex
 */
const escapeRegex = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitize MongoDB query by removing dangerous operators
 * Prevents NoSQL injection via query operators like $gt, $ne, $where, etc.
 * @param {any} query - Query object or value to sanitize
 * @returns {any} - Sanitized query
 */
const sanitizeMongoQuery = (query) => {
    if (query === null || query === undefined) return query;

    // If it's a string, return as-is (safe)
    if (typeof query === 'string') return query;

    // If it's a number or boolean, return as-is
    if (typeof query === 'number' || typeof query === 'boolean') return query;

    // If it's an array, sanitize each element
    if (Array.isArray(query)) {
        return query.map(item => sanitizeMongoQuery(item));
    }

    // If it's an object, check for dangerous operators
    if (typeof query === 'object') {
        const dangerousOperators = [
            '$where', '$function', '$accumulator', '$expr',
            '$gt', '$gte', '$lt', '$lte', '$ne', '$nin', '$in',
            '$regex', '$options', '$text', '$search',
            '$or', '$and', '$nor', '$not',
            '$exists', '$type', '$mod', '$all', '$elemMatch', '$size'
        ];

        const sanitized = {};
        for (const key of Object.keys(query)) {
            // Block any key starting with $ (MongoDB operator)
            if (key.startsWith('$')) {
                console.warn(`⚠️ Security: Blocked MongoDB operator "${key}" in user input`);
                continue;
            }
            sanitized[key] = sanitizeMongoQuery(query[key]);
        }
        return sanitized;
    }

    return query;
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - String to validate as ObjectId
 * @returns {boolean} - True if valid ObjectId format
 */
const isValidObjectId = (id) => {
    if (!id) return false;
    return mongoose.Types.ObjectId.isValid(id) &&
        (new mongoose.Types.ObjectId(id)).toString() === id;
};

/**
 * Sanitize string input - trim and limit length
 * @param {string} str - Input string
 * @param {number} maxLength - Maximum allowed length (default 1000)
 * @returns {string} - Sanitized string
 */
const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
};

/**
 * Create a safe regex search pattern for MongoDB
 * @param {string} searchTerm - User's search input
 * @param {number} maxLength - Maximum length for search term (default 100)
 * @returns {RegExp} - Safe regex pattern
 */
const createSafeSearchRegex = (searchTerm, maxLength = 100) => {
    const sanitized = sanitizeString(searchTerm, maxLength);
    const escaped = escapeRegex(sanitized);
    return new RegExp(escaped, 'i');
};

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes script tags, event handlers, and dangerous content
 * @param {string} input - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
const sanitizeHtml = (input) => {
    if (typeof input !== 'string') return input;

    return input
        // Remove script tags and content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Remove style tags and content
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // Remove on* event handlers
        .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '')
        // Remove javascript: and vbscript: URLs
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        // Remove data: URLs (except for images)
        .replace(/data:(?!image\/)/gi, '')
        .trim();
};

/**
 * Validate and sanitize email address
 * Prevents email header injection attacks
 * @param {string} email - Email to validate
 * @returns {string|null} - Sanitized email or null if invalid
 */
const sanitizeEmail = (email) => {
    if (typeof email !== 'string') return null;

    const trimmed = email.trim().toLowerCase();

    // Basic email regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(trimmed)) return null;

    // Prevent email header injection (CRLF injection)
    if (trimmed.includes('\n') || trimmed.includes('\r') ||
        trimmed.includes('%0a') || trimmed.includes('%0d')) {
        return null;
    }

    return trimmed;
};

/**
 * Middleware to sanitize request body
 * Applies sanitization to all string fields in request body
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.htmlFields - Fields that should use HTML sanitization
 * @param {Array<string>} options.emailFields - Fields that should use email sanitization
 */
const sanitizeBody = (options = {}) => {
    const { htmlFields = [], emailFields = [] } = options;

    return (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            const sanitizeObj = (obj) => {
                const sanitized = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'string') {
                        if (emailFields.includes(key)) {
                            sanitized[key] = sanitizeEmail(value) || value;
                        } else if (htmlFields.includes(key)) {
                            sanitized[key] = sanitizeHtml(value);
                        } else {
                            sanitized[key] = sanitizeString(value, 10000);
                        }
                    } else if (Array.isArray(value)) {
                        sanitized[key] = value.map(item =>
                            typeof item === 'string' ? sanitizeString(item, 10000) : item
                        );
                    } else if (typeof value === 'object' && value !== null) {
                        sanitized[key] = sanitizeObj(value);
                    } else {
                        sanitized[key] = value;
                    }
                }
                return sanitized;
            };
            req.body = sanitizeObj(req.body);
        }
        next();
    };
};

module.exports = {
    escapeRegex,
    sanitizeMongoQuery,
    isValidObjectId,
    sanitizeString,
    createSafeSearchRegex,
    sanitizeHtml,
    sanitizeEmail,
    sanitizeBody
};

