const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const https = require('https');

// Create HTTPS agent with better SSL/TLS configuration
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

// Initialize S3 Client for Cloudflare R2
const getR2Client = () => {
  // Validate required environment variables
  if (!process.env.R2_ACCOUNT_ID) {
    throw new Error('R2_ACCOUNT_ID environment variable is not set');
  }
  if (!process.env.R2_ACCESS_KEY_ID) {
    throw new Error('R2_ACCESS_KEY_ID environment variable is not set');
  }
  if (!process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2_SECRET_ACCESS_KEY environment variable is not set');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    // R2-specific configuration
    forcePathStyle: false,
    // Use custom HTTPS agent
    requestHandler: {
      httpsAgent,
      connectionTimeout: 30000,
      requestTimeout: 60000,
    },
  });
};

// Lazy initialization of R2 client
let r2Client;

/**
 * Generate a unique filename with UUID
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename with extension
 */
const generateFileName = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const uniqueName = `${uuidv4()}${ext}`;
  return uniqueName;
};

/**
 * Upload image to Cloudflare R2
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - MIME type of the file
 * @param {string} folder - Folder/prefix for organization (e.g., 'company', 'products', 'users')
 * @returns {Promise<string>} - Public URL of the uploaded image
 */
const uploadImage = async (fileBuffer, originalName, mimeType, folder = 'general') => {
  try {
    // Validate environment variables
    if (!process.env.R2_ACCOUNT_ID) {
      throw new Error('R2_ACCOUNT_ID not configured');
    }
    if (!process.env.R2_ACCESS_KEY_ID) {
      throw new Error('R2_ACCESS_KEY_ID not configured');
    }
    if (!process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2_SECRET_ACCESS_KEY not configured');
    }
    if (!process.env.R2_BUCKET_NAME) {
      throw new Error('R2_BUCKET_NAME not configured');
    }
    if (!process.env.R2_PUBLIC_URL) {
      throw new Error('R2_PUBLIC_URL not configured');
    }

    const fileName = generateFileName(originalName);
    const key = `${folder}/${fileName}`;

    console.log('Uploading to R2:', {
      bucket: process.env.R2_BUCKET_NAME,
      key,
      contentType: mimeType,
      size: fileBuffer.length,
    });

    // Initialize client if not already done
    if (!r2Client) {
      r2Client = getR2Client();
    }

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      // Set cache control for better performance
      CacheControl: 'public, max-age=31536000',
    });

    await r2Client.send(command);

    // Return the public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    console.log('Upload successful:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to R2:', {
      message: error.message,
      code: error.code,
      statusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
    });
    throw new Error(`Failed to upload image: ${error.message}`);
  }
};

/**
 * Delete image from Cloudflare R2
 * @param {string} imageUrl - Full URL or key of the image
 * @returns {Promise<boolean>} - Success status
 */
const deleteImage = async (imageUrl) => {
  try {
    // Initialize client if not already done
    if (!r2Client) {
      r2Client = getR2Client();
    }

    // Extract the key from the URL
    let key;
    if (imageUrl.startsWith('http')) {
      const url = new URL(imageUrl);
      key = url.pathname.substring(1); // Remove leading slash
    } else {
      key = imageUrl;
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error('Error deleting from R2:', error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
};

/**
 * Upload multiple images to Cloudflare R2
 * @param {Array} files - Array of file objects with buffer, originalName, and mimeType
 * @param {string} folder - Folder/prefix for organization
 * @returns {Promise<Array<string>>} - Array of public URLs
 */
const uploadMultipleImages = async (files, folder = 'general') => {
  try {
    const uploadPromises = files.map((file) =>
      uploadImage(file.buffer, file.originalname, file.mimetype, folder)
    );
    const urls = await Promise.all(uploadPromises);
    return urls;
  } catch (error) {
    console.error('Error uploading multiple images to R2:', error);
    throw new Error(`Failed to upload images: ${error.message}`);
  }
};

/**
 * Upload buffer directly to R2 with specified filename
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - Full path/filename (e.g., 'invoices/INV-001.pdf')
 * @param {string} contentType - MIME type (e.g., 'application/pdf')
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
const uploadBuffer = async (buffer, fileName, contentType) => {
  try {
    // Validate environment variables
    if (!process.env.R2_BUCKET_NAME || !process.env.R2_PUBLIC_URL) {
      throw new Error('R2 configuration missing');
    }

    // Initialize client if not already done
    if (!r2Client) {
      r2Client = getR2Client();
    }

    console.log('Uploading buffer to R2:', {
      bucket: process.env.R2_BUCKET_NAME,
      key: fileName,
      contentType,
      size: buffer.length,
    });

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    });

    await r2Client.send(command);

    // Return the public URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    console.log('Upload successful:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading buffer to R2:', error);
    throw new Error(`Failed to upload buffer: ${error.message}`);
  }
};

module.exports = {
  uploadImage,
  deleteImage,
  uploadMultipleImages,
  uploadBuffer,
  generateFileName,
};

