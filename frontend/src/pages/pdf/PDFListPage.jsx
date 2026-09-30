import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, FileText, Trash2, Download, Eye,
  Search, Filter, Plus, CheckCircle, XCircle,
  Clock, AlertCircle,
} from 'lucide-react';
import { pdfAPI } from '../../api/pdf.api.js';
import { useAuthStore } from '../../store/auth.store.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Modal from '../../components/common/Modal.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import PDFUploader from '../../components/pdf/PDFUploader.jsx';
import { formatFileSize, formatRelativeTime } from '../../utils/formatters.js';
import { cn } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page PDFListPage
 * @description PDF management page with upload, list, and delete functionality.
 */
const PDFListPage = () => {
  const { user } = useAuthStore();

  const [pdfs, setPdfs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | ready | processing | failed
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ─── Fetch PDFs ───────────────────────────────────────────────────────────
  const fetchPDFs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await pdfAPI.getAll({
        search: searchQuery,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      const pdfList = Array.isArray(response.data)
        ? response.data
        : (response.data?.data?.pdfs || response.data?.pdfs || response.data?.data || []);
      setPdfs(pdfList);
    } catch (error) {
      toast.error('Failed to load PDFs.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchPDFs();
  }, [fetchPDFs]);

  // ─── Delete PDF ───────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this PDF?')) return;

    setDeletingId(id);
    try {
      await pdfAPI.delete(id);
      toast.success('PDF deleted successfully.');
      fetchPDFs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete PDF.');
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Upload Success Handler ───────────────────────────────────────────────
  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    fetchPDFs();
  };

  // ─── Status Badge Component ───────────────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const config = {
      ready: {
        label: 'Ready',
        icon: CheckCircle,
        color: 'text-secondary-400',
        bg: 'bg-secondary-500/10',
        border: 'border-secondary-500/30',
      },
      processing: {
        label: 'Processing',
        icon: Clock,
        color: 'text-accent-400',
        bg: 'bg-accent-500/10',
        border: 'border-accent-500/30',
      },
      failed: {
        label: 'Failed',
        icon: XCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
      },
    };

    const { label, icon: Icon, color, bg, border } = config[status] || config.processing;

    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        color, bg, border
      )}>
        <Icon size={12} />
        {label}
      </span>
    );
  };

  // ─── Filtered PDFs ────────────────────────────────────────────────────────
  const filteredPDFs = pdfs.filter((pdf) => {
    const matchesSearch = pdf.originalName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pdf.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-dark-50">My PDFs</h1>
          <p className="text-dark-400 mt-1">
            Upload and manage your study materials
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={18} />}
          onClick={() => setShowUploadModal(true)}
        >
          Upload PDF
        </Button>
      </motion.div>

      {/* ─── Filters & Search ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search PDFs..."
              leftIcon={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-base sm:w-40"
            >
              <option value="all">All Status</option>
              <option value="ready">Ready</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </Card>
      </motion.div>

      {/* ─── PDF List ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : filteredPDFs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No PDFs found"
            description={searchQuery
              ? 'Try adjusting your search or filters.'
              : 'Upload your first PDF to get started.'
            }
            action={
              !searchQuery && (
                <Button
                  variant="primary"
                  onClick={() => setShowUploadModal(true)}
                  leftIcon={<Upload size={18} />}
                >
                  Upload PDF
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPDFs.map((pdf, index) => (
              <motion.div
                key={pdf._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hover padding="md" className="group h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl
                                    flex items-center justify-center flex-shrink-0">
                      <FileText size={24} className="text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-dark-50 truncate mb-1">
                        {pdf.originalName}
                      </h3>
                      <StatusBadge status={pdf.status} />
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="space-y-2 mb-4 text-sm text-dark-400">
                    <div className="flex items-center justify-between">
                      <span>Size:</span>
                      <span className="font-medium text-dark-300">
                        {formatFileSize(pdf.fileSize)}
                      </span>
                    </div>
                    {pdf.totalPages && (
                      <div className="flex items-center justify-between">
                        <span>Pages:</span>
                        <span className="font-medium text-dark-300">
                          {pdf.totalPages}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Uploaded:</span>
                      <span className="font-medium text-dark-300">
                        {formatRelativeTime(pdf.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2">
                    {pdf.status === 'ready' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          // Navigate to quiz generation or detail
                          window.location.href = `/pdfs/${pdf._id}`;
                        }}
                      >
                        Generate Quiz
                      </Button>
                    )}
                    {pdf.status === 'processing' && (
                      <div className="flex-1 flex items-center justify-center gap-2 py-2
                                      text-accent-400 text-sm">
                        <Spinner size="xs" color="primary" />
                        Processing...
                      </div>
                    )}
                    {pdf.status === 'failed' && (
                      <div className="flex-1 flex items-center justify-center gap-2
                                      text-red-400 text-sm">
                        <AlertCircle size={14} />
                        Upload failed
                      </div>
                    )}
                    <button
                      onClick={() => handleDelete(pdf._id)}
                      disabled={deletingId === pdf._id}
                      className="p-2 rounded-lg text-dark-400 hover:text-red-400
                                 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === pdf._id ? (
                        <Spinner size="xs" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ─── Upload Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload PDF"
        size="lg"
      >
        <PDFUploader onSuccess={handleUploadSuccess} />
      </Modal>
    </div>
  );
};

export default PDFListPage;