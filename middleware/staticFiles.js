const express = require('express');
const path = require('path');

// Serve receipt files
const serveReceipts = express.static(path.join(process.cwd(), 'uploads', 'receipts'), {
  setHeaders: (res, filepath) => {
    if (path.extname(filepath) === '.pdf') {
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', 'inline');
    }
  }
});

// Serve applicant CV files
const serveCvs = express.static(path.join(process.cwd(), 'uploads', 'cvs'));

// Serve product images
const serveProducts = express.static(path.join(process.cwd(), 'uploads', 'products'), {
  setHeaders: (res, filepath) => {
    // Set cache control for images
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
  }
});

module.exports = {
  serveReceipts,
  serveCvs,
  serveProducts
}; 