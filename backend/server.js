const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PDFDocument: PDFLib, StandardFonts, rgb } = require('pdf-lib');
const PDFKit = require('pdfkit'); // Different name for PDFKit
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

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
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper functions
function parsePageRange(range, maxPages) {
  const pages = [];
  const parts = range.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
      for (let i = start; i <= Math.min(end, maxPages); i++) {
        if (i > 0 && !pages.includes(i)) {
          pages.push(i);
        }
      }
    } else {
      const pageNum = parseInt(trimmed);
      if (pageNum > 0 && pageNum <= maxPages && !pages.includes(pageNum)) {
        pages.push(pageNum);
      }
    }
  }
  
  return pages.sort((a, b) => a - b);
}

async function cleanupFiles(files) {
  for (const file of files) {
    try {
      await fs.unlink(file);
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
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
      'POST /api/unlock'
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
      const pdf = await PDFLib.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    await cleanupFiles(uploadedFiles);
    
    console.log('✓ Merge successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error) {
    console.error('✗ Merge error:', error.message);
    await cleanupFiles(uploadedFiles);
    res.status(500).json({ error: 'Failed to merge PDFs: ' + error.message });
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
    const pdfDoc = await PDFLib.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    
    console.log(`  Total pages: ${totalPages}`);
    
    const pages = parsePageRange(range, totalPages);
    console.log(`  Extracting pages: ${pages.join(', ')}`);
    
    if (pages.length === 0) {
      throw new Error('No valid pages in range');
    }
    
    const newPdf = await PDFLib.create();
    const copiedPages = await newPdf.copyPages(pdfDoc, pages.map(p => p - 1));
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    const newPdfBytes = await newPdf.save();
    await cleanupFiles([uploadedFile]);
    
    console.log('✓ Split successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=split_pages_${range}.pdf`);
    res.send(Buffer.from(newPdfBytes));
  } catch (error) {
    console.error('✗ Split error:', error.message);
    if (uploadedFile) await cleanupFiles([uploadedFile]);
    res.status(500).json({ error: 'Failed to split PDF: ' + error.message });
  }
});

// Convert Word to PDF - FIXED VERSION using PDFKit
app.post('/api/convert-to-pdf', upload.single('file'), async (req, res) => {
  console.log('→ Convert endpoint called');
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    uploadedFile = req.file.path;
    console.log('  Converting Word to PDF...');
    
    const buffer = await fs.readFile(req.file.path);
    
    // Convert Word to HTML using Mammoth
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;
    
    // Extract text content from HTML and clean it up
    let text = html
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
      .replace(/&nbsp;/g, ' ')  // Replace non-breaking spaces
      .replace(/&amp;/g, '&')   // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // If no text content, use a default message
    if (!text || text.length === 0) {
      text = "Document converted from Word to PDF. No readable text content found. This may be due to complex formatting, images, or tables in the original document.";
    }

    console.log(`  Extracted text length: ${text.length} characters`);
    
    // Create PDF using PDFKit
    const pdfDoc = new PDFKit();
    const chunks = [];
    
    // Collect PDF data
    pdfDoc.on('data', chunk => chunks.push(chunk));
    
    pdfDoc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        await cleanupFiles([uploadedFile]);
        
        console.log('✓ Conversion successful!');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=converted.pdf');
        res.send(pdfBuffer);
      } catch (error) {
        console.error('✗ Error in PDF generation:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
      }
    });

    // Handle errors during PDF generation
    pdfDoc.on('error', (error) => {
      console.error('✗ PDF generation error:', error);
      res.status(500).json({ error: 'PDF generation failed' });
    });
    
    // Add content to PDF
    pdfDoc.fontSize(20).font('Helvetica-Bold').text('Converted Document', { align: 'center' });
    pdfDoc.moveDown(0.5);
    
    pdfDoc.fontSize(10).font('Helvetica').text(`Original file: ${req.file.originalname}`, { align: 'center' });
    pdfDoc.text(`Conversion date: ${new Date().toLocaleString()}`, { align: 'center' });
    pdfDoc.text(`Content length: ${text.length} characters`, { align: 'center' });
    
    pdfDoc.moveDown(1);
    
    // Add a horizontal line
    pdfDoc.moveTo(50, pdfDoc.y).lineTo(545, pdfDoc.y).stroke();
    
    pdfDoc.moveDown(1);
    
    // Add the main content
    pdfDoc.fontSize(12).font('Helvetica');
    
    // Split text into paragraphs for better formatting
    const paragraphs = text.split(/(?:\r?\n){2,}/).filter(p => p.trim().length > 0);
    
    if (paragraphs.length > 0) {
      paragraphs.forEach((paragraph, index) => {
        // Add some spacing between paragraphs
        if (index > 0) {
          pdfDoc.moveDown(0.5);
        }
        
        pdfDoc.text(paragraph.trim(), {
          align: 'left',
          width: 500,
          indent: 20,
          lineGap: 2
        });
      });
    } else {
      // Fallback if no paragraphs detected
      pdfDoc.text(text, {
        align: 'left',
        width: 500,
        indent: 20,
        lineGap: 2
      });
    }
    
    // Finalize PDF
    pdfDoc.end();
    
  } catch (error) {
    console.error('✗ Convert error:', error.message);
    if (uploadedFile) await cleanupFiles([uploadedFile]);
    res.status(500).json({ error: 'Failed to convert to PDF: ' + error.message });
  }
});

// Compress PDF
app.post('/api/compress', upload.single('file'), async (req, res) => {
  console.log('→ Compress endpoint called');
  let uploadedFile = null;
  
  try {
    if (!req.file) {
      console.log('✗ No file uploaded');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    uploadedFile = req.file.path;
    const { level } = req.body;
    
    console.log(`  Compression level: ${level}`);
    
    const pdfBytes = await fs.readFile(req.file.path);
    const pdfDoc = await PDFLib.load(pdfBytes);
    
    const compressedBytes = await pdfDoc.save({ 
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: level === 'high' ? 100 : level === 'medium' ? 50 : 25
    });
    
    const originalSize = pdfBytes.length;
    const compressedSize = compressedBytes.length;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    console.log(`✓ Compressed by ${reduction}%`);
    
    await cleanupFiles([uploadedFile]);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=compressed.pdf');
    res.send(Buffer.from(compressedBytes));
  } catch (error) {
    console.error('✗ Compress error:', error.message);
    if (uploadedFile) await cleanupFiles([uploadedFile]);
    res.status(500).json({ error: 'Failed to compress PDF: ' + error.message });
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
    
    const pdfBytes = await fs.readFile(req.file.path);
    
    let pdfDoc;
    try {
      pdfDoc = await PDFLib.load(pdfBytes, { 
        ignoreEncryption: true 
      });
    } catch (error) {
      await cleanupFiles([uploadedFile]);
      console.log('✗ Failed to unlock');
      return res.status(401).json({ error: 'Incorrect password or unable to unlock' });
    }
    
    const unlockedBytes = await pdfDoc.save();
    await cleanupFiles([uploadedFile]);
    
    console.log('✓ Unlock successful!');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=unlocked.pdf');
    res.send(Buffer.from(unlockedBytes));
  } catch (error) {
    console.error('✗ Unlock error:', error.message);
    if (uploadedFile) await cleanupFiles([uploadedFile]);
    res.status(500).json({ error: 'Failed to unlock PDF: ' + error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('✗ Server error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
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