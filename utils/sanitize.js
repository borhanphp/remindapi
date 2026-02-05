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

module.exports = {
    escapeRegex,
    sanitizeMongoQuery,
    isValidObjectId,
    sanitizeString,
    createSafeSearchRegex
};
