/**
 * Migration Script: Product Images to Cloudflare R2
 * 
 * This script migrates existing product images from local file system to Cloudflare R2.
 * Run this if you have products created before the R2 integration.
 * 
 * Usage:
 *   node scripts/migrateProductImagesToR2.js
 * 
 * What it does:
 *   1. Finds all products with local image paths (e.g., /uploads/products/...)
 *   2. Reads image files from local disk
 *   3. Uploads them to Cloudflare R2
 *   4. Updates product records with new R2 URLs
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const { uploadImage } = require('../services/r2Service');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Check if file exists
const fileExists = (filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
};

// Read file as buffer
const readFileBuffer = (filePath) => {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
};

// Get MIME type from file extension
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// Main migration function
const migrateProductImages = async () => {
  try {
    console.log('🚀 Starting product images migration to R2...\n');

    // Find all products with images
    const products = await Product.find({ images: { $exists: true, $ne: [] } });
    console.log(`Found ${products.length} products with images\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      console.log(`Processing product: ${product.name} (${product._id})`);
      
      let productUpdated = false;
      const updatedImages = [];

      for (let i = 0; i < product.images.length; i++) {
        const image = product.images[i];
        
        // Check if image is already on R2 (starts with http)
        if (image.url && image.url.startsWith('http')) {
          console.log(`  ✓ Image ${i + 1} already on R2, skipping`);
          updatedImages.push(image);
          skippedCount++;
          continue;
        }

        // Image has local path, migrate to R2
        console.log(`  ⏳ Migrating image ${i + 1}: ${image.url}`);
        
        try {
          // Construct local file path
          const localPath = path.join(process.cwd(), image.url);
          
          if (!fileExists(localPath)) {
            console.log(`  ❌ File not found: ${localPath}`);
            // Keep the old URL (broken) rather than losing the reference
            updatedImages.push(image);
            errorCount++;
            continue;
          }

          // Read file
          const fileBuffer = readFileBuffer(localPath);
          if (!fileBuffer) {
            console.log(`  ❌ Could not read file: ${localPath}`);
            updatedImages.push(image);
            errorCount++;
            continue;
          }

          // Get filename and MIME type
          const filename = path.basename(image.url);
          const mimeType = getMimeType(filename);

          // Upload to R2
          const r2Url = await uploadImage(fileBuffer, filename, mimeType, 'products');
          console.log(`  ✅ Uploaded to R2: ${r2Url}`);

          // Update image object
          updatedImages.push({
            url: r2Url,
            thumbnail: r2Url, // R2 URL for both (no separate thumbnail)
            alt: image.alt || product.name,
            isPrimary: image.isPrimary || false,
          });

          productUpdated = true;
          migratedCount++;
        } catch (error) {
          console.log(`  ❌ Error migrating image: ${error.message}`);
          // Keep the old URL rather than losing the reference
          updatedImages.push(image);
          errorCount++;
        }
      }

      // Update product if any images were migrated
      if (productUpdated) {
        product.images = updatedImages;
        await product.save();
        console.log(`  💾 Product updated in database\n`);
      } else {
        console.log(`  ⏭️  No changes needed\n`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Images migrated: ${migratedCount}`);
    console.log(`⏭️  Images skipped (already on R2): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));
    console.log('\n🎉 Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
};

// Run migration
connectDB().then(() => {
  migrateProductImages();
});

