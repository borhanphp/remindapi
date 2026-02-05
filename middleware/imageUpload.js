const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure multer storage for product images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'products');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `product-${uniqueSuffix}${ext}`);
  }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10 // Max 10 files per upload
  },
  fileFilter: fileFilter
});

// Generate thumbnails using sharp
const generateThumbnail = async (originalPath, thumbnailPath, width = 200, height = 200) => {
  try {
    await sharp(originalPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .toFile(thumbnailPath);
    return true;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return false;
  }
};

// Middleware to handle multiple image uploads with thumbnails (using R2)
const uploadProductImages = async (req, res, next) => {
  const memoryUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  });

  memoryUpload.array('images', 10)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB per file.'
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 images allowed.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Upload to R2 if files are present
    if (req.files && req.files.length > 0) {
      try {
        const { uploadMultipleImages } = require('../services/r2Service');
        const imagesWithThumbnails = [];

        for (const file of req.files) {
          // Upload original image to R2
          const r2Url = await uploadMultipleImages([file], 'products');
          
          imagesWithThumbnails.push({
            url: r2Url[0], // Full Cloudflare R2 URL
            thumbnail: r2Url[0], // Same URL (R2 doesn't need separate thumbnails)
            alt: file.originalname.replace(/\.[^/.]+$/, ''), // Remove extension for alt text
            size: file.size,
            mimetype: file.mimetype
          });
        }

        req.uploadedImages = imagesWithThumbnails;
      } catch (uploadError) {
        console.error('Error uploading images to R2:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images to cloud storage'
        });
      }
    }

    next();
  });
};

// Middleware to handle single image upload
const uploadSingleProductImage = async (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    // Generate thumbnail for uploaded image
    if (req.file) {
      const thumbnailDir = path.join(process.cwd(), 'uploads', 'products', 'thumbnails');
      ensureDirectoryExists(thumbnailDir);

      const thumbnailFilename = `thumb-${req.file.filename}`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      
      await generateThumbnail(req.file.path, thumbnailPath);

      req.uploadedImage = {
        url: `/uploads/products/${req.file.filename}`,
        thumbnail: `/uploads/products/thumbnails/${thumbnailFilename}`,
        alt: req.file.originalname.replace(/\.[^/.]+$/, ''),
        size: req.file.size,
        mimetype: req.file.mimetype
      };
    }

    next();
  });
};

// Delete image file from disk
const deleteImageFile = (imageUrl) => {
  try {
    if (!imageUrl || !imageUrl.startsWith('/uploads/products/')) {
      return false;
    }

    const filename = path.basename(imageUrl);
    const filePath = path.join(process.cwd(), 'uploads', 'products', filename);
    const thumbnailPath = path.join(process.cwd(), 'uploads', 'products', 'thumbnails', `thumb-${filename}`);

    // Delete original file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete thumbnail
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    return true;
  } catch (error) {
    console.error('Error deleting image file:', error);
    return false;
  }
};

module.exports = {
  uploadProductImages,
  uploadSingleProductImage,
  deleteImageFile,
  generateThumbnail
};

