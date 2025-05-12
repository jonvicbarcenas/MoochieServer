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
fs.ensureDirSync(path.join(__dirname, 'uploads'));

// Store image metadata
const imageMetadata = {};

// Set up storage for multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    const code = req.body.code;
    if (!code || code.length !== 4 || isNaN(code)) {
      return cb(new Error('A valid 4-digit code is required'));
    }
    
    const fileExt = path.extname(file.originalname);
    cb(null, `image-${code}${fileExt}`);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
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
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read images directory' });
    }
    
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
    
    res.json(images);
  });
});

// Get image by code
app.get('/api/images/:code', (req, res) => {
  const code = req.params.code;
  
  if (!code || code.length !== 4 || isNaN(code)) {
    return res.status(400).json({ error: 'A valid 4-digit code is required' });
  }
  
  const uploadsDir = path.join(__dirname, 'uploads');
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read images directory' });
    }
    
    const matchingFile = files.find(file => file.startsWith(`image-${code}`));
    
    if (!matchingFile) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({
      code: code,
      imageUrl: `/uploads/${matchingFile}`,
      timestamp: imageMetadata[code] ? imageMetadata[code].timestamp : null
    });
  });
});

// Upload an image
app.post('/api/upload', (req, res) => {
  // Create a custom upload instance for this request
  const customUpload = multer({
    storage: multer.diskStorage({
      destination: function(req, file, cb) {
        cb(null, 'uploads/');
      },
      filename: function(req, file, cb) {
        // Code will be available in req.body after the fields are processed
        const fileExt = path.extname(file.originalname);
        // Store original name temporarily, will rename after upload
        cb(null, `temp-${Date.now()}${fileExt}`);
      }
    }),
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  }).single('image');

  customUpload(req, res, function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Now the code should be available in req.body
    const code = req.body.code;

    // Validate code
    if (!code || code.length !== 4 || isNaN(code)) {
      // Remove the temporary file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'A valid 4-digit code is required' });
    }
    
    // Rename the file with the proper code
    const fileExt = path.extname(req.file.originalname);
    const newFilename = `image-${code}${fileExt}`;
    const newPath = path.join('uploads', newFilename);
    
    try {
      // Remove existing file with same code if any
      const uploadsDir = path.join(__dirname, 'uploads');
      const files = fs.readdirSync(uploadsDir);
      const existingFile = files.find(file => file.startsWith(`image-${code}`));
      
      if (existingFile) {
        fs.unlinkSync(path.join(uploadsDir, existingFile));
      }
      
      // Rename the temp file
      fs.renameSync(req.file.path, path.join(__dirname, newPath));
      
      // Store timestamp
      imageMetadata[code] = { timestamp: new Date().toISOString() };
      
      res.json({
        code: code,
        imageUrl: `/uploads/${newFilename}`,
        timestamp: imageMetadata[code].timestamp
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process the image' });
    }
  });
});

// Upload an image without code
app.post('/api/upload/auto', (req, res) => {
  const autoUpload = multer({
    storage: multer.diskStorage({
      destination: function(req, file, cb) {
        cb(null, 'uploads/');
      },
      filename: function(req, file, cb) {
        // Generate a random 4-digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const fileExt = path.extname(file.originalname);
        cb(null, `image-${code}${fileExt}`);
      }
    }),
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
  }).single('image');

  autoUpload(req, res, function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Extract the code from the filename
    const filename = path.basename(req.file.path);
    const code = filename.split('-')[1].substring(0, 4);
    
    // Store timestamp
    imageMetadata[code] = { timestamp: new Date().toISOString() };
    
    res.json({
      code: code,
      imageUrl: `/uploads/${filename}`,
      timestamp: imageMetadata[code].timestamp
    });
  });
});

// Serve a simple HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 