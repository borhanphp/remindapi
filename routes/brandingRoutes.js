const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const {
  getBranding,
  updateBranding,
  uploadLogo,
  deleteLogo,
} = require('../controllers/brandingController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.use(protect);

router.get('/', getBranding);
router.put('/', updateBranding);
router.post('/logo', upload.single('logo'), uploadLogo);
router.delete('/logo/:position', deleteLogo);

module.exports = router;
