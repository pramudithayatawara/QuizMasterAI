import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, X, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { pdfAPI } from '../../api/pdf.api.js';
import toast from 'react-hot-toast';

/**
 * @component PdfUploadModal
 * @description Modal for uploading PDF files with drag-and-drop support.
 */
const PdfUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  };

  const validateAndSelectFile = (file) => {
    // Check file type
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      toast.error('Only PDF files are allowed');
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`File size (${sizeInMB}MB) exceeds the 10MB limit`);
      return;
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setErrorMessage('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      await pdfAPI.uploadPdf(selectedFile, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadProgress(100);
      setUploadStatus('completed');
      
      toast.success('PDF uploaded and processed successfully!');
      
      setTimeout(() => {
        onClose();
        setSelectedFile(null);
        setUploadStatus('idle');
        setUploadProgress(0);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }, 1500);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error.response?.data?.detail || error.message || 'Upload failed. Please try again.');
      toast.error(errorMessage);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
  };

  const handleClose = () => {
    if (uploadStatus === 'uploading' || uploadStatus === 'processing') {
      toast.warning('Please wait for the upload to complete');
      return;
    }
    onClose();
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getProgressStatus = () => {
    if (uploadProgress < 30) return 'Uploading...';
    if (uploadProgress < 60) return 'Extracting Text...';
    if (uploadProgress < 90) return 'Generating AI Vectors...';
    return 'Finalizing...';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={`${isDark ? 'bg-dark-800 border-white/10' : 'bg-white border-light-300'} rounded-2xl w-full max-w-lg p-6 relative`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>Upload PDF</h2>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-light-600 hover:text-light-900 hover:bg-light-200'} transition-colors`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Upload Area */}
            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : `${isDark ? 'border-slate-600 hover:border-indigo-500 hover:bg-slate-800/50' : 'border-light-300 hover:border-indigo-500 hover:bg-light-200'}`
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isDragging ? 'bg-indigo-500/20' : isDark ? 'bg-slate-700' : 'bg-light-200'
                  }`}>
                    <UploadCloud className={`w-8 h-8 ${isDragging ? 'text-indigo-400' : isDark ? 'text-slate-400' : 'text-light-600'}`} />
                  </div>
                  
                  <div>
                    <p className={`font-medium mb-1 ${isDark ? 'text-white' : 'text-light-900'}`}>
                      {isDragging ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                      or click to browse files
                    </p>
                  </div>
                  
                  <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-500' : 'text-light-500'}`}>
                    <FileText size={14} />
                    <span>PDF files only • Max 10MB</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Selected File Preview */
              <div className="space-y-4">
                <div className={`${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-light-100 border-light-300'} rounded-xl p-4`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-indigo-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-light-900'}`}>
                        {selectedFile.name}
                      </p>
                      <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    
                    {uploadStatus === 'idle' && (
                      <button
                        onClick={handleRemoveFile}
                        className={`p-2 rounded-lg ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-light-600 hover:text-red-400 hover:bg-light-200'} transition-colors`}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {uploadStatus !== 'idle' && uploadStatus !== 'error' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className={isDark ? 'text-slate-400' : 'text-light-600'}>
                        {uploadStatus === 'completed' ? 'Completed!' : getProgressStatus()}
                      </span>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>
                        {uploadProgress}%
                      </span>
                    </div>
                    
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-light-300'}`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          uploadStatus === 'completed'
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Error State */}
                {uploadStatus === 'error' && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-400 font-medium mb-1">Upload Failed</p>
                        <p className="text-red-300/80 text-sm">{errorMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success State */}
                {uploadStatus === 'completed' && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <p className="text-emerald-400 font-medium">
                        PDF uploaded and processed successfully!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className={`flex-1 px-4 py-3 rounded-xl border ${isDark ? 'border-white/10 text-slate-300 hover:bg-slate-700/50' : 'border-light-300 text-light-600 hover:bg-light-200'} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Cancel
              </button>
              
              {selectedFile && uploadStatus === 'idle' && (
                <button
                  onClick={handleUpload}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  Upload PDF
                </button>
              )}
              
              {uploadStatus === 'uploading' || uploadStatus === 'processing' && (
                <button
                  disabled
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-medium opacity-75 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </button>
              )}
              
              {uploadStatus === 'error' && (
                <button
                  onClick={handleUpload}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PdfUploadModal;
