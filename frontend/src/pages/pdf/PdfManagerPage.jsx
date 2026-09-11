import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Upload, Trash2, Eye, Clock, CheckCircle, 
  AlertCircle, Loader2, Plus, Calendar, Layers, Brain
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { pdfAPI } from '../../api/pdf.api.js';
import { quizAPI } from '../../api/quiz.api.js';
import PdfUploadModal from '../../components/pdf/PdfUploadModal.jsx';
import toast from 'react-hot-toast';

/**
 * @page PdfManagerPage
 * @description PDF management page with upload, list, and delete functionality.
 */
const PdfManagerPage = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [pdfs, setPdfs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deletingPdfId, setDeletingPdfId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPdfs();
  }, [statusFilter]);

  const fetchPdfs = async () => {
    setIsLoading(true);
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await pdfAPI.getPdfs(params);
      setPdfs(response.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch PDFs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePdf = async (pdfId) => {
    if (!confirm('Are you sure you want to delete this PDF? This action cannot be undone.')) {
      return;
    }

    setDeletingPdfId(pdfId);
    try {
      await pdfAPI.deletePdf(pdfId);
      toast.success('PDF deleted successfully');
      fetchPdfs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete PDF');
    } finally {
      setDeletingPdfId(null);
    }
  };

  const handleUploadSuccess = () => {
    fetchPdfs();
  };

  const handleGenerateQuiz = async (pdfId) => {
    try {
      toast.loading('Generating quiz... This may take 10-15 seconds.');
      const response = await quizAPI.generateQuiz({ pdfId, questionCount: 10 });
      toast.dismiss();
      toast.success('Quiz generated! Redirecting...');
      // Navigate to quiz list so user can see and play the new quiz
      navigate('/quizzes');
    } catch (error) {
      toast.dismiss();
      toast.error(error.response?.data?.message || 'Failed to generate quiz');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      processing: {
        icon: Loader2,
        label: 'Processing',
        className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        animate: true,
      },
      completed: {
        icon: CheckCircle,
        label: 'Completed',
        className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        animate: false,
      },
      failed: {
        icon: AlertCircle,
        label: 'Failed',
        className: 'bg-red-500/20 text-red-400 border-red-500/30',
        animate: false,
      },
    };

    const config = statusConfig[status] || statusConfig.processing;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.className}`}>
        {config.animate && <Icon size={12} className="animate-spin" />}
        {!config.animate && <Icon size={12} />}
        <span>{config.label}</span>
      </div>
    );
  };

  const filteredPdfs = statusFilter === 'all' 
    ? pdfs 
    : pdfs.filter(pdf => pdf.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>PDF Management</h1>
          <p className={`${isDark ? 'text-slate-400' : 'text-light-600'} mt-1`}>
            Upload and manage your educational PDFs for quiz generation
          </p>
        </div>
        
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
        >
          <Plus size={20} />
          Upload PDF
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total PDFs', value: pdfs.length, icon: FileText, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
          { label: 'Completed', value: pdfs.filter(p => p.status === 'completed').length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
          { label: 'Processing', value: pdfs.filter(p => p.status === 'processing').length, icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
          { label: 'Failed', value: pdfs.filter(p => p.status === 'failed').length, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-6`}
          >
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-light-900'}`}>{stat.value}</p>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'completed', 'processing', 'failed'].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === filter
                ? 'bg-indigo-500/20 text-indigo-400'
                : `${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-light-600 hover:text-light-900 hover:bg-light-200'}`
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* PDF List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : filteredPdfs.length === 0 ? (
        <div className="text-center py-16">
          <div className={`w-20 h-20 ${isDark ? 'bg-slate-800' : 'bg-light-200'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <FileText className={`w-10 h-10 ${isDark ? 'text-slate-600' : 'text-light-400'}`} />
          </div>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-light-900'} mb-2`}>No PDFs Found</h3>
          <p className={`${isDark ? 'text-slate-400' : 'text-light-600'} mb-6`}>
            {statusFilter === 'all' 
              ? 'Upload your first PDF to get started' 
              : `No PDFs with status "${statusFilter}"`}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-colors"
            >
              <Upload size={20} />
              Upload Your First PDF
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredPdfs.map((pdf, index) => (
              <motion.div
                key={pdf._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={`${isDark ? 'bg-slate-800/40 border-white/10 hover:bg-slate-800/60' : 'bg-white/40 border-light-300 hover:bg-white/60'} backdrop-blur-md rounded-2xl p-6 transition-all group`}
              >
                {/* PDF Icon */}
                <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-indigo-400" />
                </div>

                {/* PDF Name */}
                <h3 className={`font-medium mb-1 truncate ${isDark ? 'text-white' : 'text-light-900'}`} title={pdf.originalName}>
                  {pdf.originalName}
                </h3>

                {/* Status Badge */}
                <div className="mb-4">
                  {getStatusBadge(pdf.status)}
                </div>

                {/* PDF Details */}
                <div className="space-y-2 mb-4">
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                    <Calendar size={14} />
                    <span>{formatDate(pdf.uploadDate)}</span>
                  </div>
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                    <Layers size={14} />
                    <span>{formatFileSize(pdf.fileSize)}</span>
                  </div>
                  {pdf.chunkCount > 0 && (
                    <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
                      <FileText size={14} />
                      <span>{pdf.chunkCount} chunks</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={`flex gap-2 pt-4 border-t ${isDark ? 'border-white/10' : 'border-light-300'}`}>
                  {pdf.status === 'completed' && (
                    <button
                      onClick={() => handleGenerateQuiz(pdf._id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-sm transition-colors"
                      title="Generate Quiz"
                    >
                      <Brain size={16} />
                      <span>Generate Quiz</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/pdfs/${pdf._id}`)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-slate-700/50 hover:bg-slate-700 text-slate-300' : 'bg-light-200 hover:bg-light-300 text-light-700'} text-sm transition-colors`}
                    title="View details"
                  >
                    <Eye size={16} />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleDeletePdf(pdf._id)}
                    disabled={deletingPdfId === pdf._id}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete PDF"
                  >
                    {deletingPdfId === pdf._id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Upload Modal */}
      <PdfUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default PdfManagerPage;
