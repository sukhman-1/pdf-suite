import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  Settings, 
  Scissors, 
  RefreshCw, 
  Unlock, 
  Minimize2, 
  Edit, 
  UploadCloud, 
  X, 
  File,
  GripVertical,
  ArrowRight,
  Download,
  Highlighter,
  Edit3
} from 'lucide-react';

// --- PDF.js Worker Setup (for react-pdf) ---
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Simple reliable worker configuration
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

// --- Constants ---
const APP_TITLE = "PDFSuite";
const API_URL = "http://localhost:5000/api";

const TOOLS = [
  { id: 'merge', name: 'Merge PDF', icon: Settings, description: 'Combine multiple PDFs into one document.' },
  { id: 'split', name: 'Split PDF', icon: Scissors, description: 'Extract pages from a PDF.' },
  { id: 'convert', name: 'Word to PDF', icon: RefreshCw, description: 'Convert .docx files to PDF.' },
  { id: 'compress', name: 'Compress PDF', icon: Minimize2, description: 'Reduce the file size of your PDF.' },
  { id: 'unlock', name: 'Unlock PDF', icon: Unlock, description: 'Remove password protection from a PDF.' },
  { id: 'annotate', name: 'Annotate PDF', icon: Edit, description: 'Add notes and highlights to your PDF.' },
];

// --- Main App Component ---
export default function App() {
  const [selectedTool, setSelectedTool] = useState(null);

  const renderTool = () => {
    switch (selectedTool) {
      case 'merge':
        return <MergeTool />;
      case 'split':
        return <SplitTool />;
      case 'convert':
        return <ConvertTool />;
      case 'compress':
        return <CompressTool />;
      case 'unlock':
        return <UnlockTool />;
      case 'annotate':
        return <AnnotateTool />;
      default:
        return <ToolSelection onSelectTool={setSelectedTool} />;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 font-inter">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div 
              className="flex items-center space-x-2 cursor-pointer"
              onClick={() => setSelectedTool(null)}
            >
              <FileText className="h-8 w-8 text-red-600" />
              <span className="text-2xl font-bold text-gray-800">{APP_TITLE}</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-600 hidden sm:block">Welcome, User!</span>
              <button className="text-sm font-medium text-red-600 hover:text-red-800">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {selectedTool && (
          <button
            onClick={() => setSelectedTool(null)}
            className="mb-8 flex items-center text-sm font-medium text-red-600 hover:text-red-800"
          >
            <ArrowRight className="h-4 w-4 mr-1 transform rotate-180" />
            Back to all tools
          </button>
        )}
        {renderTool()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} {APP_TITLE}. Based on UCS503 Software Engineering Project.
        </div>
      </footer>
    </div>
  );
}

// ToolSelection and ToolCard components
function ToolSelection({ onSelectTool }) {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-extrabold text-gray-900">Your All-in-One PDF Solution</h1>
      <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
        Select a tool below to manage, convert, and edit your PDF documents with ease.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onClick={() => onSelectTool(tool.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ToolCard({ tool, onClick }) {
  const Icon = tool.icon;
  return (
    <button
      onClick={onClick}
      className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 text-left flex flex-col items-start"
    >
      <div className="flex-shrink-0">
        <div className="h-12 w-12 rounded-md bg-red-600 text-white flex items-center justify-center">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-bold text-gray-900">{tool.name}</h3>
        <p className="mt-2 text-sm text-gray-600">{tool.description}</p>
      </div>
    </button>
  );
}

// FileUploadZone, FileListItem, ProcessingOverlay components
function FileUploadZone({ onDrop, accept, multiple = false, text = "Drag 'n' drop files here, or click to select" }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
      ${isDragActive ? 'border-red-600 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-12 w-12 mx-auto text-gray-400" />
      <p className="mt-2 font-semibold text-gray-700">{text}</p>
      <p className="text-sm text-gray-500">
        {multiple ? "Multiple files are allowed." : "Only one file is allowed."}
      </p>
    </div>
  );
}

function FileListItem({ file, onRemove }) {
  return (
    <li className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200">
      <div className="flex items-center min-w-0">
        <File className="h-5 w-5 text-red-600 flex-shrink-0" />
        <span className="ml-3 font-medium text-gray-700 truncate">{file.name}</span>
      </div>
      <button
        onClick={onRemove}
        className="ml-4 text-gray-400 hover:text-red-600 flex-shrink-0"
      >
        <X className="h-5 w-5" />
      </button>
    </li>
  );
}

function ProcessingOverlay({ message }) {
  return (
    <div className="absolute inset-0 bg-white bg-opacity-80 flex flex-col items-center justify-center rounded-lg z-10">
      <RefreshCw className="h-10 w-10 text-red-600 animate-spin" />
      <p className="mt-4 text-lg font-semibold text-gray-700">{message}</p>
    </div>
  );
}

// triggerDownload and DownloadResult components
function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function DownloadResult({ fileName, onReset, onDownload }) {
  return (
    <div className="text-center p-8 bg-green-50 rounded-lg border border-green-200">
      <h3 className="text-xl font-bold text-green-800">Success!</h3>
      <p className="mt-2 text-gray-700">Your file is ready for download.</p>
      <div className="flex items-center justify-center bg-white p-4 rounded-md border my-4 max-w-md mx-auto">
        <FileText className="h-6 w-6 text-red-600" />
        <span className="ml-3 font-medium text-gray-800">{fileName}</span>
      </div>
      <div className="flex justify-center space-x-4 mt-6">
        <button 
          onClick={onDownload}
          className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <Download className="h-5 w-5" />
          <span>Download File</span>
        </button>
        <button 
          onClick={onReset}
          className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
        >
          Process Another
        </button>
      </div>
    </div>
  );
}

// MergeTool, SplitTool, ConvertTool, CompressTool, UnlockTool components
function MergeTool() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    setError(null);
  }, []);

  const removeFile = (fileToRemove) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file !== fileToRemove));
  };
  
  const handleMerge = async () => {
    setIsProcessing(true);
    setError(null);
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await fetch(`${API_URL}/merge`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Merge failed');
      }
      
      const blob = await response.blob();
      setDownloadBlob(blob);
    } catch (error) {
      console.error('Merge Error:', error);
      setError(`Failed to merge: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = () => {
    if (downloadBlob) {
      triggerDownload(downloadBlob, 'merged_document.pdf');
    }
  };
  
  const resetTool = () => {
    setFiles([]);
    setIsProcessing(false);
    setDownloadBlob(null);
    setError(null);
  };

  if (downloadBlob) {
    return <DownloadResult fileName="merged_document.pdf" onReset={resetTool} onDownload={handleDownload} />;
  }

  return (
    <ToolWrapper title="Merge PDF" description="Combine multiple PDF files into a single document. Drag to reorder.">
      <div className="relative">
        {isProcessing && <ProcessingOverlay message="Merging files..." />}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        <FileUploadZone onDrop={onDrop} accept={{ 'application/pdf': ['.pdf'] }} multiple={true} />
        
        {files.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Files to Merge ({files.length})</h3>
            <ul className="space-y-3">
              {files.map((file, index) => (
                <li key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200 group">
                  <div className="flex items-center min-w-0">
                    <GripVertical className="h-5 w-5 text-gray-400 cursor-move mr-2 group-hover:text-gray-600" />
                    <File className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <span className="ml-3 font-medium text-gray-700 truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={() => removeFile(file)}
                    className="ml-4 text-gray-400 hover:text-red-600 flex-shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={handleMerge}
              disabled={isProcessing}
              className="w-full mt-8 px-6 py-4 bg-red-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-red-300"
            >
              Merge Files
            </button>
          </div>
        )}
      </div>
    </ToolWrapper>
  );
}

function SplitTool() {
  const [file, setFile] = useState(null);
  const [pageRange, setPageRange] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const handleSplit = async () => {
    if (!pageRange) {
      setError("Please enter a page range.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('range', pageRange);

    try {
      const response = await fetch(`${API_URL}/split`, { 
        method: 'POST', 
        body: formData 
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Split failed');
      }
      
      const blob = await response.blob();
      setDownloadBlob(blob);
    } catch (error) {
      console.error('Split Error:', error);
      setError(`Failed to split PDF: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = () => {
    if (downloadBlob) {
      triggerDownload(downloadBlob, `split_pages_${pageRange}.pdf`);
    }
  };
  
  const resetTool = () => {
    setFile(null);
    setPageRange('');
    setIsProcessing(false);
    setDownloadBlob(null);
    setError(null);
  };
  
  if (downloadBlob) {
    return <DownloadResult fileName={`split_pages_${pageRange}.pdf`} onReset={resetTool} onDownload={handleDownload} />;
  }

  return (
    <ToolWrapper title="Split PDF" description="Extract one or more pages from your PDF file.">
      <div className="relative">
        {isProcessing && <ProcessingOverlay message="Splitting PDF..." />}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        {!file ? (
          <FileUploadZone onDrop={onDrop} accept={{ 'application/pdf': ['.pdf'] }} />
        ) : (
          <div>
            <FileListItem file={file} onRemove={() => setFile(null)} />
            <div className="mt-6">
              <label htmlFor="pageRange" className="block text-sm font-bold text-gray-700">
                Page Range
              </label>
              <input
                type="text"
                id="pageRange"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="e.g., 1-5, 8, 11-13"
                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter page numbers or ranges separated by commas.
              </p>
            </div>
            <button
              onClick={handleSplit}
              disabled={isProcessing || !pageRange}
              className="w-full mt-6 px-6 py-4 bg-red-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-red-300"
            >
              Split PDF
            </button>
          </div>
        )}
      </div>
    </ToolWrapper>
  );
}

function ConvertTool() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const handleConvert = async () => {
    setIsProcessing(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/convert-to-pdf`, { 
        method: 'POST', 
        body: formData 
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Conversion failed');
      }
      
      const blob = await response.blob();
      setDownloadBlob(blob);
    } catch (error) {
      console.error('Convert Error:', error);
      setError(`Failed to convert: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = () => {
    if (downloadBlob) {
      const filename = file.name.replace(/\.(docx?|doc)$/i, '.pdf');
      triggerDownload(downloadBlob, filename);
    }
  };
  
  const resetTool = () => {
    setFile(null);
    setIsProcessing(false);
    setDownloadBlob(null);
    setError(null);
  };
  
  if (downloadBlob) {
    const filename = file.name.replace(/\.(docx?|doc)$/i, '.pdf');
    return <DownloadResult fileName={filename} onReset={resetTool} onDownload={handleDownload} />;
  }

  return (
    <ToolWrapper title="Word to PDF" description="Convert Microsoft Word documents (.doc, .docx) to PDF.">
      <div className="relative">
        {isProcessing && <ProcessingOverlay message="Converting file..." />}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        {!file ? (
          <FileUploadZone 
            onDrop={onDrop} 
            accept={{
              'application/msword': ['.doc'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            }}
            text="Drag 'n' drop Word file here, or click to select"
          />
        ) : (
          <div>
            <FileListItem file={file} onRemove={() => setFile(null)} />
            <button
              onClick={handleConvert}
              disabled={isProcessing}
              className="w-full mt-6 px-6 py-4 bg-red-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-red-300"
            >
              Convert to PDF
            </button>
          </div>
        )}
      </div>
    </ToolWrapper>
  );
}

function CompressTool() {
  const [file, setFile] = useState(null);
  const [compressionLevel, setCompressionLevel] = useState('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [error, setError] = useState(null);
  
  const levels = [
    { id: 'low', name: 'Low', description: 'Good quality, less compression.' },
    { id: 'medium', name: 'Medium', description: 'Balanced (Best for web).' },
    { id: 'high', name: 'High', description: 'Smallest size (Screen only).' },
  ];

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const handleCompress = async () => {
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('level', compressionLevel);

    try {
      const response = await fetch(`${API_URL}/compress`, { 
        method: 'POST', 
        body: formData 
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Compression failed');
      }
      
      const blob = await response.blob();
      setDownloadBlob(blob);
    } catch (error) {
      console.error('Compress Error:', error);
      setError(`Failed to compress: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = () => {
    if (downloadBlob) {
      const filename = file.name.replace('.pdf', '_compressed.pdf');
      triggerDownload(downloadBlob, filename);
    }
  };
  
  const resetTool = () => {
    setFile(null);
    setCompressionLevel('medium');
    setIsProcessing(false);
    setDownloadBlob(null);
    setError(null);
  };
  
  if (downloadBlob) {
    const filename = file.name.replace('.pdf', '_compressed.pdf');
    return <DownloadResult fileName={filename} onReset={resetTool} onDownload={handleDownload} />;
  }

  return (
    <ToolWrapper title="Compress PDF" description="Reduce the file size of your PDF while optimizing for quality.">
      <div className="relative">
        {isProcessing && <ProcessingOverlay message="Compressing PDF..." />}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        {!file ? (
          <FileUploadZone onDrop={onDrop} accept={{ 'application/pdf': ['.pdf'] }} />
        ) : (
          <div>
            <FileListItem file={file} onRemove={() => setFile(null)} />
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Compression Level</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {levels.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setCompressionLevel(level.id)}
                    className={`p-4 border rounded-lg text-left transition-colors
                    ${compressionLevel === level.id 
                      ? 'bg-red-50 border-red-600 ring-2 ring-red-500' 
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-gray-800">{level.name}</span>
                    <p className="text-sm text-gray-600">{level.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="w-full mt-6 px-6 py-4 bg-red-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-red-300"
            >
              Compress PDF
            </button>
          </div>
        )}
      </div>
    </ToolWrapper>
  );
}

function UnlockTool() {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
    setError(null);
  }, []);

  const handleUnlock = async () => {
    if (!password) {
      setError("Please enter the PDF password.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);

    try {
      const response = await fetch(`${API_URL}/unlock`, { 
        method: 'POST', 
        body: formData 
      });
      
      if (response.status === 401) {
        throw new Error('Incorrect password');
      }
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Unlock failed');
      }
      
      const blob = await response.blob();
      setDownloadBlob(blob);
    } catch (error) {
      console.error('Unlock Error:', error);
      setError(`Failed to unlock: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownload = () => {
    if (downloadBlob) {
      const filename = file.name.replace('.pdf', '_unlocked.pdf');
      triggerDownload(downloadBlob, filename);
    }
  };
  
  const resetTool = () => {
    setFile(null);
    setPassword('');
    setIsProcessing(false);
    setDownloadBlob(null);
    setError(null);
  };
  
  if (downloadBlob) {
    const filename = file.name.replace('.pdf', '_unlocked.pdf');
    return <DownloadResult fileName={filename} onReset={resetTool} onDownload={handleDownload} />;
  }

  return (
    <ToolWrapper title="Unlock PDF" description="Remove password and restrictions from a PDF file.">
      <div className="relative">
        {isProcessing && <ProcessingOverlay message="Unlocking PDF..." />}
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        {!file ? (
          <FileUploadZone onDrop={onDrop} accept={{ 'application/pdf': ['.pdf'] }} />
        ) : (
          <div>
            <FileListItem file={file} onRemove={() => setFile(null)} />
            <div className="mt-6">
              <label htmlFor="password" className="block text-sm font-bold text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter PDF password"
                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <button
              onClick={handleUnlock}
              disabled={isProcessing || !password}
              className="w-full mt-6 px-6 py-4 bg-red-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors disabled:bg-red-300"
            >
              Unlock PDF
            </button>
          </div>
        )}
      </div>
    </ToolWrapper>
  );
}

// AnnotateTool component (simplified for now)
function AnnotateTool() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    setFile(uploadedFile);
    setFileUrl(URL.createObjectURL(uploadedFile));
  }, []);

  return (
    <ToolWrapper title="Annotate PDF" description="Add notes, highlights, and drawings to your PDF.">
      {!fileUrl ? (
        <FileUploadZone onDrop={onDrop} accept={{ 'application/pdf': ['.pdf'] }} />
      ) : (
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <FileListItem file={file} onRemove={() => {
            setFile(null);
            setFileUrl(null);
            URL.revokeObjectURL(fileUrl);
          }} />
          <div className="mt-6 p-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
            <Edit className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-xl font-bold text-gray-800">PDF Annotator</h3>
            <p className="mt-2 text-gray-600">
              PDF loaded successfully. In a full implementation, an interactive PDF editor would open here.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              File: {file.name}
            </p>
          </div>
        </div>
      )}
    </ToolWrapper>
  );
}

// Tool Wrapper component
function ToolWrapper({ title, description, children }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900">{title}</h2>
        <p className="mt-3 text-md text-gray-600">{description}</p>
      </div>
      <div className="bg-white p-4 sm:p-8 rounded-lg shadow-xl">
        {children}
      </div>
    </div>
  );
}