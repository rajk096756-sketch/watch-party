import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Upload directory outside the public web root
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'secure_uploads');

// Create upload directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Config Multer in memory first to validate magic numbers before saving
const storage = multer.memoryStorage();

const limits = {
  fileSize: 2 * 1024 * 1024, // 2MB limit
};

/**
 * Validates the file buffer magic numbers against known image signatures.
 */
function validateMagicNumber(buffer) {
  if (!buffer || buffer.length < 8) return null;

  const hex = buffer.toString('hex', 0, 8).toUpperCase();

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (hex.startsWith('89504E470D0A1A0A')) {
    return 'image/png';
  }
  // JPEG/JPG: FF D8 FF
  if (hex.startsWith('FFD8FF')) {
    return 'image/jpeg';
  }
  // GIF: 47 49 46 38 (GIF8)
  if (hex.startsWith('47494638')) {
    return 'image/gif';
  }
  // WEBP: 52 49 46 46 (RIFF) followed by 57 45 42 50 (WEBP)
  // RIFF is bytes 0-3 (hex "52494646"). WEBP is bytes 8-11 (hex "57454250").
  const isRiff = hex.startsWith('52494646');
  const isWebp = buffer.toString('hex', 8, 12).toUpperCase() === '57454250';
  if (isRiff && isWebp) {
    return 'image/webp';
  }

  return null;
}

// Multer upload parser
const multerUpload = multer({
  storage,
  limits,
}).single('avatar');

/**
 * File upload middleware that intercepts, parses, verifies magic numbers,
 * and securely saves the file with execute permissions completely stripped.
 */
export const secureAvatarUpload = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: 'File too large. Maximum limit is 2MB.' });
        }
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ success: false, message: 'An upload error occurred.' });
    }

    // If no file was uploaded, proceed (optional upload)
    if (!req.file) {
      return next();
    }

    // Verify file content using magic numbers
    const detectedMime = validateMagicNumber(req.file.buffer);
    if (!detectedMime) {
      return res.status(400).json({ 
        success: false, 
        message: 'File upload blocked: Invalid image signature. Uploaded data is non-compliant or malicious.' 
      });
    }

    // Strip out name and save securely under random name to prevent path traversal
    const extension = detectedMime.split('/')[1];
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${extension}`;
    const targetPath = path.join(UPLOAD_DIR, uniqueFilename);

    try {
      // Write file content securely
      fs.writeFileSync(targetPath, req.file.buffer);
      
      // Enforce zero-execution permissions (noexec behavior)
      // On POSIX it sets chmod 0644 (read/write only, no execution)
      // On Windows, writing natively restricts executable execution unless named with exe/bat.
      fs.chmodSync(targetPath, 0o644);

      // Attach file details to the request
      req.file.savedName = uniqueFilename;
      req.file.savedPath = targetPath;
      req.file.contentType = detectedMime;
      
      next();
    } catch (saveErr) {
      console.error('Failed to write uploaded file:', saveErr);
      return res.status(500).json({ success: false, message: 'Failed to persist uploaded content securely.' });
    }
  });
};

/**
 * Controller to fetch avatar securely (prevents direct public access to files)
 */
export const serveAvatarSecurely = (req, res) => {
  const filename = req.params.filename;
  
  // Prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, sanitizedFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found.' });
  }

  // Set response headers to strip execute capabilities and download securely
  res.setHeader('Content-Type', validateMagicNumber(fs.readFileSync(filePath, { encoding: null, flag: 'r' })) || 'application/octet-stream');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
};
