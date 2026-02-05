const multer = require('multer');
const path = require('path');

/**
 * File Upload Middleware with Security Enhancements
 * 
 * SECURITY FEATURES:
 * - MIME type whitelist validation
 * - Magic byte (file signature) verification  
 * - Filename sanitization to prevent path traversal
 * - Size limits
 * - Archive files removed (potential security risk)
 */

// Configure multer for memory storage (no disk writes)
const storage = multer.memoryStorage();

// File signature (magic bytes) for common file types
const FILE_SIGNATURES = {
  // Images
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF], // JPEG
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47], // PNG
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38], // GIF87a or GIF89a
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46], // RIFF header (WebP)
  ],
  // Documents
  'application/pdf': [
    [0x25, 0x50, 0x44, 0x46], // %PDF
  ],
  // Office documents (OOXML) - ZIP-based format
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4B, 0x03, 0x04], // PK..
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    [0x50, 0x4B, 0x03, 0x04], // PK..
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    [0x50, 0x4B, 0x03, 0x04], // PK..
  ],
};

/**
 * Verify file magic bytes match claimed MIME type
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - Claimed MIME type
 * @returns {boolean} - True if signature matches
 */
const verifyFileSignature = (buffer, mimeType) => {
  if (!buffer || buffer.length < 4) return false;

  const signatures = FILE_SIGNATURES[mimeType];
  if (!signatures) {
    // For text files and legacy docs, allow without signature check
    // but log for monitoring
    return true;
  }

  return signatures.some(sig => {
    for (let i = 0; i < sig.length; i++) {
      if (buffer[i] !== sig[i]) return false;
    }
    return true;
  });
};

/**
 * Sanitize filename to prevent path traversal
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  // Remove path components and dangerous characters
  return path.basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
};

// Allowed MIME types - SECURITY: Archives removed as they can contain malicious files
const allowedMimeTypes = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // NOTE: ZIP/RAR archives removed for security - can contain executable files
];

// File filter - validates MIME type
const fileFilter = (req, file, cb) => {
  // Sanitize the filename
  file.originalname = sanitizeFilename(file.originalname);

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Allowed: images, PDF, Word, Excel, PowerPoint, and text files.'
      ),
      false
    );
  }
};

// Configure multer
const fileUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Middleware to verify file signatures after upload
 * Call this after multer middleware
 */
const verifyUploadedFiles = (req, res, next) => {
  try {
    // Check single file
    if (req.file) {
      if (!verifyFileSignature(req.file.buffer, req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'File content does not match its declared type. Upload rejected.',
        });
      }
    }

    // Check multiple files
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        if (!verifyFileSignature(file.buffer, file.mimetype)) {
          return res.status(400).json({
            success: false,
            message: 'One or more files have content that does not match their declared type.',
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('File verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying uploaded files.',
    });
  }
};

// Error handling middleware for multer
const handleFileUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 10MB.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field in form data.',
      });
    }
    // Don't expose internal error details
    return res.status(400).json({
      success: false,
      message: 'File upload error.',
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error uploading file.',
    });
  }
  next();
};

module.exports = {
  fileUpload,
  handleFileUploadError,
  verifyUploadedFiles,
  verifyFileSignature,
  sanitizeFilename,
};
