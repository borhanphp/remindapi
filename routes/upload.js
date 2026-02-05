const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requireOrganization } = require('../middleware/organization');
const { upload, handleMulterError } = require('../middleware/upload');
const {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
} = require('../controllers/uploadController');

// All routes require authentication and organization
router.use(protect);
router.use(requireOrganization);

// Upload single image
router.post('/image', upload.single('image'), handleMulterError, uploadImage);

// Upload multiple images
router.post('/images', upload.array('images', 10), handleMulterError, uploadMultipleImages);

// Delete image
router.delete('/image', deleteImage);

module.exports = router;

