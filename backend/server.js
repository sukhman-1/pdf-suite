const express = require('express');
const multer = require('multer');
const cors = require('cors');
// Add new properties from pdf-lib for annotations
const { PDFDocument: PDFLib, StandardFonts, rgb, DecryptionError, degrees, PageSizes, setLineCap, LineCapStyle, PDFName, PDFArray, PDFString } = require('pdf-lib');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer'); // <-- For high-fidelity PDF conversion
const fs = require('fs').promises;
const path = require('path');
// Note: We are NOT using execFile or Ghostscript here per your request.

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
  origin: '*', // Allows all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase body parser limit for large annotation JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');

// Initialize uploads directory
(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
    console.log('Uploads directory ready');
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
})();

// File upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// Helper functions
function parsePageRange(range, maxPages) {
  const pages = new Set();
  const parts = range.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr.trim());
      const end = parseInt(endStr.trim());
      
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= Math.min(end, maxPages); i++) {
          if (i > 0) {
            pages.add(i);
          }
        }
      }
    } else {
      const pageNum = parseInt(trimmed);
      if (!isNaN(pageNum) && pageNum > 0 && pageNum <= maxPages) {
        pages.add(pageNum);
      }
    }
  }
  
  return Array.from(pages).sort((a, b) => a - b);
}

async function cleanupFiles(files) {
  if (!Array.isArray(files)) {
    files = [files];
  }
  for (const file of files) {
    if (file && typeof file === 'string') {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Log error but don't fail the request if cleanup fails
        console.error('Error deleting file:', file, error.message);
      }
    }
  }
}

// Function to parse hex color to rgb components (0-1)
function hexToRgb(hex) {
  if (!hex) return rgb(1, 1, 0); // Default to yellow
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? rgb(
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      )
    : rgb(1, 1, 0); // Default on fail
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'PDF Suite Backend',
    endpoints: [
      'GET  /api/health',
      'POST /api/merge',
      'POST /api/split',
      'POST /api/convert-to-pdf',
      'POST /api/compress',
      'POST /api/unlock',
      'POST /api/annotate' // <-- ADDED
    ]
  });
});

app.get('/api/health', (req, res) => {
  console.log('✓ Health check called');
  res.json({ status: 'OK', message: 'PDF Suite Backend Running' });
});

// Merge PDFs
app.post('/api/merge', upload.array('files'), async (req, res) => {
  console.log('→ Merge endpoint called');
  const uploadedFiles = [];
  
  try {
    if (!req.files || req.files.length === 0) {
      console.log('✗ No files uploaded');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`  Merging ${req.files.length} PDFs...`);
    
    const mergedPdf = await PDFLib.create();

    for (const file of req.files) {
      uploadedFiles.push(file.path);
      const pdfBytes = await fs.readFile(file.path);
      // Load PDF, handling potential encryption
      let pdf;
      try {
        pdf = await PDFLib.load(pdfBytes, { ignoreEncryption: true });
      } catch (err) {
        if (err instanceof DecryptionError) {
          throw new Error(`File "${file.originalname}" is password-protected and cannot be merged.`);
        }
        throw err;
      }

      if (pdf.isEncrypted) {
         throw new Error(`File "${file.originalname}" is password-protected and cannot be merged.`);
      }
      
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    
    console.log('✓ Merge successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error) {
    console.error('✗ Merge error:', error.message);
    res.status(500).json({ error: 'Failed to merge PDFs: ' + error.message });
  } finally {
    // Always cleanup files
    await cleanupFiles(uploadedFiles);
  }
});

// Split PDF
app.post('/api/split', upload.single('file'), async (req, res) => {
  console.log('→ Split endpoint called');
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    uploadedFile = req.file.path;
    
    const { range } = req.body;
    console.log('  Range:', range);

    if (!range) {
      return res.status(400).json({ error: 'Page range is required' });
    }

    const pdfBytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFLib.load(pdfBytes, { ignoreEncryption: true });
    
    if (pdfDoc.isEncrypted) {
      throw new Error("Cannot split a password-protected PDF. Please unlock it first.");
    }
    
    const totalPages = pdfDoc.getPageCount();
    console.log(`  Total pages: ${totalPages}`);
    
    const pages = parsePageRange(range, totalPages);
    console.log(`  Extracting pages: ${pages.join(', ')}`);
    
    if (pages.length === 0) {
      throw new Error('No valid pages in range. Please check your input.');
    }
    
    const newPdf = await PDFLib.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, pages.map(p => p - 1));
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    const newPdfBytes = await newPdf.save();
    
    console.log('✓ Split successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=split_pages_${range}.pdf`);
    res.send(Buffer.from(newPdfBytes));
  } catch (error) {
    console.error('✗ Split error:', error.message);
    res.status(500).json({ error: 'Failed to split PDF: ' + error.message });
  } finally {
    await cleanupFiles(uploadedFile);
  }
});

// WORD TO PDF CONVERSION (High-Fidelity)
app.post('/api/convert-to-pdf', upload.single('file'), async (req, res) => {
  console.log('→ Convert endpoint called');
  let uploadedFile = null;
  let browser = null;
  
  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    uploadedFile = req.file.path;
    console.log('  Converting Word to PDF...');
    
    // 1. Convert Word to HTML using Mammoth
    const buffer = await fs.readFile(req.file.path);
    const { value: html } = await mammoth.convertToHtml({ buffer });
    
    // 2. Add some basic styling to make the PDF look better
    const finalHtml = `
      <html>
        <head>
          <style>
            body { 
              font-family: sans-serif; 
              line-height: 1.5; 
              padding: 72px; /* Approx 1 inch margin */
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
            }
            th, td { 
              border: 1px solid #ccc; 
              padding: 8px; 
              /* Fix for images in tables */
              word-wrap: break-word;
            }
            th { 
              background-color: #f4f4f4; 
            }
            img { 
              max-width: 100%; 
              height: auto; 
            }
            /* Preserve paragraph spacing */
            p { 
              margin-top: 0; 
              margin-bottom: 1em; 
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
    
    // 3. Launch headless browser (Puppeteer)
    console.log('  Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', // Good for server/docker environments
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage' // Good for limited-memory environments
      ]
    });
    const page = await browser.newPage();
    
    // 4. Set the HTML content and "print" to PDF
    await page.setContent(finalHtml, {
      waitUntil: 'networkidle0' // Wait for things like images to finish loading
    });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '72px',
        right: '72px',
        bottom: '72px',
        left: '72px'
      }
    });
    
    await browser.close();
    browser = null;
    
    console.log('✓ Conversion successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
    res.send(Buffer.from(pdfBuffer));
    
  } catch (error) {
    console.error('✗ Convert error:', error.message);
    if (browser) {
      await browser.close(); // Ensure browser is closed on error
    }
    res.status(500).json({ error: 'Failed to convert to PDF: ' + error.message });
  } finally {
    // 5. Always cleanup the uploaded file
    await cleanupFiles(uploadedFile);
  }
});

// COMPRESS PDF (using pdf-lib)
app.post('/api/compress', upload.single('file'), async (req, res) => {
  console.log('→ Compress endpoint called');
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    uploadedFile = req.file.path;
    
    const { level } = req.body;
    console.log(`  Compression level: ${level}`);
    
    const pdfBytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFLib.load(pdfBytes, { ignoreEncryption: true });
    
    if (pdfDoc.isEncrypted) {
      throw new Error("Cannot compress a password-protected PDF. Please unlock it first.");
    }
    
    // --- THIS IS THE FIXED LOGIC ---
    // 'low' = best quality, no object stream compression
    // 'medium' and 'high' = best compression
    let useObjectStreams = true;
    if (level === 'low') {
      useObjectStreams = false;
      console.log('  Using "Low" compression (useObjectStreams: false)');
    } else {
      // For 'medium' and 'high', we use compression
      console.log(`  Using "${level}" compression (useObjectStreams: true)`);
    }
    // -----------------------------

    const compressedBytes = await pdfDoc.save({ 
      useObjectStreams: useObjectStreams, // Set based on the level
    });
    
    const originalSize = pdfBytes.length;
    const compressedSize = compressedBytes.length;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✓ Compressed by ${reduction}% (Original: ${originalSize} bytes, New: ${compressedSize} bytes)`);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=compressed.pdf');
    res.send(Buffer.from(compressedBytes));
  } catch (error) {
    console.error('✗ Compress error:', error.message);
    res.status(500).json({ error: 'Failed to compress PDF: ' + error.message });
  } finally {
    await cleanupFiles(uploadedFile);
  }
});

// Unlock PDF
app.post('/api/unlock', upload.single('file'), async (req, res) => {
  console.log('→ Unlock endpoint called');
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    uploadedFile = req.file.path;
    
    // Get password from the request body
    const { password } = req.body;
    if (!password) {
      console.log('✗ No password provided');
      return res.status(400).json({ error: 'Password is required to unlock' });
    }

    const pdfBytes = await fs.readFile(req.file.path);
    
    let pdfDoc;
    try {
      // Try loading with the provided password
      pdfDoc = await PDFLib.load(pdfBytes, { 
        password: password 
      });
    } catch (err) {
      if (err instanceof DecryptionError) {
        // This specific error means the password was wrong
        console.log('✗ Failed to unlock: Incorrect password');
        return res.status(401).json({ error: 'Incorrect password' });
      }
      // Other errors (e.g., corrupted file)
      console.log('✗ Failed to load PDF:', err.message);
      throw new Error('Failed to load PDF, it may be corrupted.');
    }
    
    // If we're here, the password was correct. Now save without encryption.
    const unlockedBytes = await pdfDoc.save();
    
    console.log('✓ Unlock successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=unlocked.pdf');
    res.send(Buffer.from(unlockedBytes));
  } catch (error) {
    console.error('✗ Unlock error:', error.message);
    res.status(500).json({ error: 'Failed to unlock PDF: ' + error.message });
  } finally {
    await cleanupFiles(uploadedFile);
  }
});

// *** NEW ANNOTATE PDF ROUTE ***
app.post('/api/annotate', upload.single('file'), async (req, res) => {
  console.log('→ Annotate endpoint called');
  let uploadedFile = null;

  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    uploadedFile = req.file.path;
    
    const annotations = JSON.parse(req.body.annotations);
    if (!annotations || !Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Invalid annotations data' });
    }

    const pdfBytes = await fs.readFile(uploadedFile);
    const pdfDoc = await PDFLib.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const ann of annotations) {
      if (ann.page < 0 || ann.page >= pages.length) {
        console.warn(`Skipping annotation for invalid page index: ${ann.page}`);
        continue;
      }
      
      const page = pages[ann.page];
      const { width: pdfPageWidth, height: pdfPageHeight } = page.getSize();
      const { width: canvasWidth, height: canvasHeight } = ann.canvasSize;
      
      const color = hexToRgb(ann.color);

      // --- Coordinate Conversion ---
      // Convert frontend canvas (top-left origin) to PDF (bottom-left origin)
      const convertCoords = (x, y) => {
        const pdfX = (x / canvasWidth) * pdfPageWidth;
        const pdfY = pdfPageHeight - ((y / canvasHeight) * pdfPageHeight);
        return { x: pdfX, y: pdfY };
      };

      if (ann.type === 'highlight') {
        const { x, y, width, height } = ann.rect;
        
        // Convert top-left corner
        const { x: pdfX, y: pdfY1 } = convertCoords(x, y);
        // Convert bottom-right corner to get height
        const { y: pdfY2 } = convertCoords(x + width, y + height);

        const pdfWidth = (width / canvasWidth) * pdfPageWidth;
        const pdfHeight = pdfY1 - pdfY2; // Height in PDF coords
        
        page.drawRectangle({
          x: pdfX,
          y: pdfY2, // Use the bottom-left Y
          width: pdfWidth,
          height: pdfHeight,
          color: color,
          opacity: 0.3,
        });

      } else if (ann.type === 'draw') {
        if (ann.paths.length < 2) continue;
        
        // Convert all points in the path
        const convertedPath = ann.paths.map(([x, y]) => {
          const { x: pdfX, y: pdfY } = convertCoords(x, y);
          return `${pdfX} ${pdfY}`;
        });
        
        // Create an SVG path string
        const svgPath = `M ${convertedPath[0]} L ${convertedPath.slice(1).join(' ')}`;

        page.drawSvgPath(svgPath, {
          borderColor: color,
          borderWidth: ann.strokeWidth || 3,
          borderLineCap: LineCapStyle.Round,
        });
      }
    }

    const annotatedPdfBytes = await pdfDoc.save();
    console.log(`✓ Annotation successful, ${annotations.length} annotations added.`);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=annotated.pdf');
    res.send(Buffer.from(annotatedPdfBytes));

  } catch (error) {
    console.error('✗ Annotate error:', error.message);
    res.status(500).json({ error: 'Failed to annotate PDF: ' + error.message });
  } finally {
    await cleanupFiles(uploadedFile);
  }
});


// --- Error Handling Middleware ---
// This should be after all your routes
app.use((err, req, res, next) => {
  console.error('✗ Server error:', err.stack);
  if (err instanceof multer.MulterError) {
    return res.status(422).json({ error: `File upload error: ${err.message}` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// --- 404 Handler ---
// This should be the very last `app.use`
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.path}` });
});

// Start server
app.listen(PORT, () => {
  console.log(`
========================================
  PDF Suite Backend Server
========================================
  Status: ✓ Running
  Port: ${PORT}
  URL: http://localhost:${PORT}
========================================
  Endpoints ready:
  - GET  /api/health
  - POST /api/merge
  - POST /api/split
  - POST /api/convert-to-pdf
  - POST /api/compress
  - POST /api/unlock
  - POST /api/annotate
========================================
Press Ctrl+C to stop
  `);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ ERROR: Port ${PORT} is already in use!`);
    console.error('Please close the other application or change the PORT.\n');
  } else {
    console.error('✗ Server error:', err);
  }
  process.exit(1);
});
