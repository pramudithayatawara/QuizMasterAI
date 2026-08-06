import React, { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';
import { pdfAPI } from '../../api/pdf.api.js';
import Button from '../common/Button.jsx';
import ProgressBar from '../common/ProgressBar.jsx';
import { cn } from '../../utils/helpers.js';
import { formatFileSize } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

/**
 * @component PDFUploader
 * @description Drag-and-drop PDF upload component with progress tracking.
 */
const PDFUploader = ({ onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ─── File Validation ──────────────────────────────────────────────────────
  const validateFile = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    if (!file.type.includes('pdf')) {
      toast.error('Only PDF files are allowed.');
      return false;
    }

    if (file.size > MAX_SIZE) {
      toast.error('File size must be less than 10MB.');
      return false;
    }

    return true;
  };

  // ─── Handle File Selection ────────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      setUploadProgress(0);
      setUploadComplete(false);
    }
  };

  // ─── Drag and Drop Handlers ───────────────────────────────────────────────
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

    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  // ─── Upload Handler ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    setIsUploading(true);
    try {
      await pdfAPI.upload(formData, (progress) => {
        setUploadProgress(progress);
      });

      setUploadComplete(true);
      toast.success('PDF uploaded successfully! Processing...');
      setTimeout(() => {
        onSuccess?.();
      }, 1500);

    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed.');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Clear Selection ──────────────────────────────────────────────────────
  const handleClear = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadComplete(false);
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-2xl p-12 text-center transition-all',
            isDragging
              ? 'border-primary-500 bg-primary-500/5 scale-[1.02]'
              : 'border-dark-600 hover:border-dark-500'
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center transition-colors',
              isDragging
                ? 'bg-primary-500/20 text-primary-400'
                : 'bg-dark-700 text-dark-400'
            )}>
              <Upload size={32} />
            </div>

            <div>
              <p className="text-dark-50 font-medium mb-1">
                {isDragging ? 'Drop your PDF here' : 'Drag and drop your PDF'}
              </p>
              <p className="text-sm text-dark-400">
                or click to browse (max 10MB)
              </p>
            </div>

            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload">
              <Button variant="secondary" as="span">
                Choose File
              </Button>
            </label>
          </div>
        </div>
      ) : (
        // Selected File Preview
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-primary-500/10 rounded-xl
                            flex items-center justify-center flex-shrink-0">
              <FileText size={28} className="text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dark-50 truncate">
                {selectedFile.name}
              </p>
              <p className="text-sm text-dark-400 mt-1">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            {!isUploading && !uploadComplete && (
              <button
                onClick={handleClear}
                className="p-2 rounded-lg text-dark-400 hover:text-dark-100
                           hover:bg-dark-700 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Upload Progress */}
          {(isUploading || uploadComplete) && (
            <div className="space-y-2">
              <ProgressBar
                value={uploadProgress}
                max={100}
                color={uploadComplete ? 'green' : 'primary'}
                size="md"
                showLabel
                label={uploadComplete ? 'Upload Complete' : 'Uploading...'}
                animated
              />
              {uploadComplete && (
                <div className="flex items-center gap-2 text-secondary-400 text-sm">
                  <CheckCircle size={16} />
                  Processing your PDF...
                </div>
              )}
            </div>
          )}

          {/* Upload Button */}
          {!isUploading && !uploadComplete && (
            <Button
              variant="primary"
              className="w-full"
              onClick={handleUpload}
              leftIcon={<Upload size={18} />}
            >
              Upload PDF
            </Button>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-dark-500 space-y-1">
        <p>✓ Only PDF files are supported</p>
        <p>✓ Maximum file size: 10MB</p>
        <p>✓ Processing typically takes 30-60 seconds</p>
      </div>
    </div>
  );
};

export default PDFUploader;