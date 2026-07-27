const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 78;

// Банер розтягується на всю ширину екрана — стискаємо делікатніше, ніж звичайні фото товарів.
const HERO_MAX_DIMENSION = 2400;
const HERO_JPEG_QUALITY = 88;

async function compressImage(filePath, { maxDimension = DEFAULT_MAX_DIMENSION, jpegQuality = DEFAULT_JPEG_QUALITY } = {}) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;
  const buffer = fs.readFileSync(filePath);
  let pipeline = sharp(buffer).resize({
    width: maxDimension,
    height: maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  });
  pipeline = ext === '.png' ? pipeline.png({ quality: 80, compressionLevel: 9 }) : pipeline.jpeg({ quality: jpegQuality, mozjpeg: true });
  const output = await pipeline.toBuffer();
  if (output.length < buffer.length) fs.writeFileSync(filePath, output);
}

// Стискає всі щойно завантажені файли (після multer, до обробника роуту).
function processUploadedImages(options) {
  return async function (req, res, next) {
    try {
      const files = req.file ? [req.file] : req.files ? Object.values(req.files).flat() : [];
      for (const file of files) await compressImage(file.path, options);
      next();
    } catch (err) {
      next(err);
    }
  };
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `img_${Date.now()}_${Math.round(Math.random() * 1e6)}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Дозволені лише зображення JPG, PNG або WEBP'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

upload.processUploadedImages = processUploadedImages;
upload.heroImageOptions = { maxDimension: HERO_MAX_DIMENSION, jpegQuality: HERO_JPEG_QUALITY };

module.exports = upload;
