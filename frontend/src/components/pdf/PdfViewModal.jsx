import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ExternalLink, Download, FileText,
  CheckCircle, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pdfAPI } from '../../api/pdf.api.js';
import { useTheme } from '../../hooks/useTheme.js';

/**
 * @component PdfViewModal
 * @description Clean interactive modal for previewing PDFs.
 */
const PdfViewModal = ({ pdf, isOpen, onClose, onGenerateQuiz }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  if (!isOpen || !pdf) return null;

  const pdfUrl = pdfAPI.getFileUrl(pdf.id);
  const downloadUrl = pdfAPI.getFileUrl(pdf.id, true);
  const pdfTitle = pdf.original_name || pdf.name || 'Educational Document.pdf';

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleNavigateToGenerator = () => {
    onClose();
    const targetId = pdf.id || pdf._id;
    if (onGenerateQuiz) {
      onGenerateQuiz(targetId);
    } else {
      navigate(`/quizzes/ai-generate?pdfId=${targetId}`);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
            isDark 
              ? 'bg-[#0b101b] border-white/10 text-white shadow-cyan-950/20' 
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
          }`}
        >
          {/* Header Bar */}
          <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
            isDark ? 'border-white/10 bg-slate-900/60' : 'border-slate-100 bg-slate-50'
          }`}>
            <div className="flex items-center gap-3 min-w-0 max-w-full sm:max-w-xl">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold truncate text-slate-100" title={pdfTitle}>
                  {pdfTitle}
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle size={12} /> Ready
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(pdf.file_size || pdf.fileSize)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleNavigateToGenerator}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                title="Generate AI Quiz from this PDF"
              >
                <Sparkles size={15} />
                <span>Generate Quiz</span>
              </button>

              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
                title="Open in new window"
              >
                <ExternalLink size={15} />
                <span className="hidden sm:inline">New Tab</span>
              </a>

              <a
                href={downloadUrl}
                download
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
                title="Download original PDF"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Download</span>
              </a>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Full-Height PDF Viewer Body */}
          <div className="flex-1 flex flex-col p-3 sm:p-4 min-h-0 bg-slate-950/40">
            <div className="relative w-full flex-1 rounded-xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center min-h-0 shadow-inner">
              <iframe
                src={pdfUrl}
                title={pdfTitle}
                className="w-full h-full rounded-xl border-none"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 px-1 shrink-0">
              <span>Viewing PDF document via built-in viewer.</span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                Open in separate tab <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PdfViewModal;
