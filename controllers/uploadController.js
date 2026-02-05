const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');
const { uploadImage, deleteImage, uploadMultipleImages } = require('../services/r2Service');

/**
 * @desc    Upload a single image
 * @route   POST /api/upload/image
 * @access  Private
 */
exports.uploadImage = asyncHandler(async (req, res, next) => {
  // Check if file exists
  if (!req.file) {
    return next(new ErrorResponse('Please upload a file', 400));
  }

  // Get folder from request body or default to 'general'
  const folder = req.body.folder || 'general';

  // Validate folder name
  const allowedFolders = ['company', 'products', 'users', 'signatures', 'general'];
  if (!allowedFolders.includes(folder)) {
    return next(new ErrorResponse(`Invalid folder. Allowed: ${allowedFolders.join(', ')}`, 400));
  }

  try {
    // Upload to R2
    const imageUrl = await uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return next(new ErrorResponse(error.message || 'Failed to upload image', 500));
  }
});

/**
 * @desc    Upload multiple images
 * @route   POST /api/upload/images
 * @access  Private
 */
exports.uploadMultipleImages = asyncHandler(async (req, res, next) => {
  // Check if files exist
  if (!req.files || req.files.length === 0) {
    return next(new ErrorResponse('Please upload at least one file', 400));
  }

  // Limit to 10 images at once
  if (req.files.length > 10) {
    return next(new ErrorResponse('Maximum 10 images can be uploaded at once', 400));
  }

  // Get folder from request body or default to 'general'
  const folder = req.body.folder || 'general';

  // Validate folder name
  const allowedFolders = ['company', 'products', 'users', 'signatures', 'general'];
  if (!allowedFolders.includes(folder)) {
    return next(new ErrorResponse(`Invalid folder. Allowed: ${allowedFolders.join(', ')}`, 400));
  }

  try {
    // Upload all images to R2
    const imageUrls = await uploadMultipleImages(req.files, folder);

    res.status(200).json({
      success: true,
      message: `${imageUrls.length} image(s) uploaded successfully`,
      data: {
        urls: imageUrls,
        count: imageUrls.length,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return next(new ErrorResponse(error.message || 'Failed to upload images', 500));
  }
});

/**
 * @desc    Delete an image
 * @route   DELETE /api/upload/image
 * @access  Private
 */
exports.deleteImage = asyncHandler(async (req, res, next) => {
  const { url } = req.body;

  if (!url) {
    return next(new ErrorResponse('Please provide image URL', 400));
  }

  try {
    await deleteImage(url);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return next(new ErrorResponse(error.message || 'Failed to delete image', 500));
  }
});

