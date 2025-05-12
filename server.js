console.log('Server script starting...');

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
try {
  console.log(`Ensuring 'uploads' directory exists at ${path.join(__dirname, 'uploads')}`);
  fs.ensureDirSync(path.join(__dirname, 'uploads'));
  console.log("'uploads' directory ensured.");
} catch (err) {
  console.error("Error ensuring 'uploads' directory:", err);
  // Potentially exit or handle critical failure if this is essential for startup
}

// Store image metadata
const imageMetadata = {};

// Set up storage for multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    console.log('[Multer Destination] Attempting to set destination for file:', file.originalname);
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    console.log('[Multer Filename] Attempting to set filename. Body:', req.body, 'File:', file.originalname);
    const code = req.body.code;
    if (!code || code.length !== 4 || isNaN(code)) {
      console.error('[Multer Filename] Validation Error: A valid 4-digit code is required. Received code:', code);
      return cb(new Error('A valid 4-digit code is required'));
    }
    
    const fileExt = path.extname(file.originalname);
    const generatedFilename = `image-${code}${fileExt}`;
    console.log('[Multer Filename] Generated filename:', generatedFilename);
    cb(null, generatedFilename);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  console.log('[Multer FileFilter] Checking file mimetype:', file.mimetype);
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    console.error('[Multer FileFilter] Error: Only image files are allowed. Received mimetype:', file.mimetype);
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
}).single('image');

// Get all images
app.get('/api/images', (req, res) => {
  console.log(`[GET /api/images] Received request. IP: ${req.ip}`);
  const uploadsDir = path.join(__dirname, 'uploads');
  console.log(`[GET /api/images] Reading directory: ${uploadsDir}`);
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('[GET /api/images] Error reading images directory:', err);
      return res.status(500).json({ error: 'Failed to read images directory' });
    }
    console.log('[GET /api/images] Files found:', files.length);
    
    const images = files
      .filter(file => file.startsWith('image-'))
      .map(file => {
        const code = file.split('-')[1].substring(0, 4);
        return {
          code: code,
          imageUrl: `/uploads/${file}`,
          timestamp: imageMetadata[code] ? imageMetadata[code].timestamp : null
        };
      });
    
    console.log(`[GET /api/images] Sending ${images.length} images.`);
    res.json(images);
  });
});

// Get image by code
app.get('/api/images/:code', (req, res) => {
  const code = req.params.code;
  console.log(`[GET /api/images/:code] Received request for code: ${code}. IP: ${req.ip}`);
  
  if (!code || code.length !== 4 || isNaN(code)) {
    console.error(`[GET /api/images/:code] Validation Error: Invalid code format for code: ${code}`);
    return res.status(400).json({ error: 'A valid 4-digit code is required' });
  }
  
  const uploadsDir = path.join(__dirname, 'uploads');
  console.log(`[GET /api/images/:code] Reading directory: ${uploadsDir} for code: ${code}`);
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error(`[GET /api/images/:code] Error reading images directory for code ${code}:`, err);
      return res.status(500).json({ error: 'Failed to read images directory' });
    }
    
    const matchingFile = files.find(file => file.startsWith(`image-${code}`));
    
    if (!matchingFile) {
      console.warn(`[GET /api/images/:code] Image not found for code: ${code}`);
      return res.status(404).json({ error: 'Image not found' });
    }
    
    console.log(`[GET /api/images/:code] Found image: ${matchingFile} for code: ${code}. Sending response.`);
    res.json({
      code: code,
      imageUrl: `/uploads/${matchingFile}`,
      timestamp: imageMetadata[code] ? imageMetadata[code].timestamp : null
    });
  });
});

// Upload an image
app.post('/api/upload', (req, res) => {
  console.log(`[POST /api/upload] Received request. IP: ${req.ip}`);
  // Create a custom upload instance for this request
  const customUpload = multer({
    storage: multer.diskStorage({
      destination: function(req, file, cb) {
        console.log('[customUpload Multer Destination] Setting destination for temp file:', file.originalname);
        cb(null, 'uploads/');
      },
      filename: function(req, file, cb) {
        // Code will be available in req.body after the fields are processed
        const fileExt = path.extname(file.originalname);
        const tempFilename = `temp-${Date.now()}${fileExt}`;
        console.log('[customUpload Multer Filename] Generating temporary filename:', tempFilename);
        // Store original name temporarily, will rename after upload
        cb(null, tempFilename);
      }
    }),
    fileFilter: fileFilter, // Reuse the same fileFilter with logging
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  }).single('image');

  customUpload(req, res, function(err) {
    console.log('[customUpload Callback] Processing request. Body:', req.body, 'File:', req.file ? req.file.originalname : 'No file');
    if (err) {
      console.error('[customUpload Callback] Multer error during upload:', err);
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      console.error('[customUpload Callback] Error: No image file provided.');
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Now the code should be available in req.body
    const code = req.body.code;
    console.log('[customUpload Callback] Code from body:', code);

    // Validate code
    if (!code || code.length !== 4 || isNaN(code)) {
      console.error('[customUpload Callback] Validation Error: Invalid code:', code, '. Removing temp file:', req.file.path);
      // Remove the temporary file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'A valid 4-digit code is required' });
    }
    
    // Rename the file with the proper code
    const fileExt = path.extname(req.file.originalname);
    const newFilename = `image-${code}${fileExt}`;
    const newPath = path.join('uploads', newFilename);
    
    try {
      console.log(`[customUpload Callback] Attempting to rename ${req.file.path} to ${path.join(__dirname, newPath)}`);
      // Remove existing file with same code if any
      const uploadsDir = path.join(__dirname, 'uploads');
      console.log(`[customUpload Callback] Checking for existing file with code ${code} in ${uploadsDir}`);
      const files = fs.readdirSync(uploadsDir);
      const existingFile = files.find(file => file.startsWith(`image-${code}`));
      
      if (existingFile) {
        console.log(`[customUpload Callback] Found existing file: ${existingFile}. Deleting.`);
        fs.unlinkSync(path.join(uploadsDir, existingFile));
      }
      
      // Rename the temp file
      fs.renameSync(req.file.path, path.join(__dirname, newPath));
      console.log(`[customUpload Callback] File renamed successfully to ${newFilename}`);
      
      // Store timestamp
      const timestamp = new Date().toISOString();
      imageMetadata[code] = { timestamp: timestamp };
      console.log(`[customUpload Callback] Metadata stored for code ${code}:`, imageMetadata[code]);
      
      res.json({
        code: code,
        imageUrl: `/uploads/${newFilename}`,
        timestamp: timestamp
      });
    } catch (error) {
      console.error('[customUpload Callback] Error processing image (rename/delete):', error);
      res.status(500).json({ error: 'Failed to process the image' });
    }
  });
});

// Upload an image without code
app.post('/api/upload/auto', (req, res) => {
  console.log(`[POST /api/upload/auto] Received request. IP: ${req.ip}`);
  const autoUpload = multer({
    storage: multer.diskStorage({
      destination: function(req, file, cb) {
        console.log('[autoUpload Multer Destination] Setting destination for file:', file.originalname);
        cb(null, 'uploads/');
      },
      filename: function(req, file, cb) {
        console.log('[autoUpload Multer Filename] Generating auto code for file:', file.originalname);
        // Generate a random 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const fileExt = path.extname(file.originalname);
        const generatedFilename = `image-${code}${fileExt}`;
        console.log('[autoUpload Multer Filename] Generated filename with auto code:', generatedFilename);
        cb(null, generatedFilename);
      }
    }),
    fileFilter: fileFilter, // Reuse the same fileFilter with logging
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  }).single('image');

  autoUpload(req, res, function(err) {
    console.log('[autoUpload Callback] Processing request. File:', req.file ? req.file.originalname : 'No file');
    if (err) {
      console.error('[autoUpload Callback] Multer error during auto upload:', err);
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      console.error('[autoUpload Callback] Error: No image file provided.');
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Extract the code from the filename
    const filename = path.basename(req.file.path);
    const code = filename.split('-')[1].substring(0, 4);
    
    // Store timestamp
    const timestamp = new Date().toISOString();
    imageMetadata[code] = { timestamp: timestamp };
    console.log(`[autoUpload Callback] Metadata stored for auto-generated code ${code}:`, imageMetadata[code]);
    
    res.json({
      code: code,
      imageUrl: `/uploads/${filename}`,
      timestamp: timestamp
    });
  });
});

// Serve a simple HTML page
app.get('/', (req, res) => {
  console.log(`[GET /] Serving index.html. IP: ${req.ip}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Uploads directory is expected at: ${path.join(__dirname, 'uploads')}`);
  console.log('Script execution finished initial setup. Waiting for requests...');
}); 