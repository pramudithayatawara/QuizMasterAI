import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, Search, Trash2, PlusCircle,
  RefreshCw, Clock, Users, HardDrive
} from 'lucide-react';
import { adminAPI } from '../../api/admin.api.js';
import { ROUTES } from '../../constants/routes.js';
import Card from '../../components/common/Card.jsx';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime } from '../../utils/formatters.js';
import toast from 'react-hot-toast';

/**
 * @page AdminPDFsPage
 * @description Centralized PDF documents registry and storage administration
 */
const AdminPDFsPage = () => {
  const [pdfs, setPdfs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPDFs = async (pageNum = 1, showToast = false) => {
    setIsLoading(true);
    if (showToast) setIsRefreshing(true);
    try {
      const response = await adminAPI.getPDFs({
        page: pageNum,
        limit: 20,
        search: searchQuery,
      });
      const data = response.data?.data || response.data || {};
      const list = data.pdfs || response.data?.pdfs || [];
      setPdfs(list);
      const pagination = response.data?.pagination || {};
      setTotalPages(pagination.totalPages || 1);
      setTotalCount(pagination.total || list.length);
      if (showToast) toast.success('PDF documents refreshed!');
    } catch (error) {
      console.error('Failed to load PDFs:', error);
      toast.error('Failed to load PDFs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPDFs(page);
  }, [page, searchQuery]);

  const handleDeletePDF = async (pdfId, filename) => {
    if (!confirm(`Are you sure you want to permanently delete "${filename}"?`)) return;
    try {
      await adminAPI.deletePDF(pdfId);
      toast.success('PDF removed successfully.');
      fetchPDFs(page);
    } catch (error) {
      toast.error('Failed to delete PDF.');
    }
  };

  const filteredPdfs = pdfs.filter((p) =>
    (p.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-800 pb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">PDF Document Management</h1>
            <p className="text-dark-400 text-sm mt-0.5">
              Inspect and manage {totalCount} study documents uploaded across all users
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPDFs(page, true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white border border-dark-700 text-sm transition-all"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <Link
            to={ROUTES.PDF_LIST}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-lg shadow-emerald-600/25 transition-all"
          >
            <PlusCircle size={16} />
            <span>Upload Document</span>
          </Link>
        </div>
      </motion.div>

      {/* ─── Search ──────────────────────────────────────────────────────── */}
      <div className="max-w-md">
        <Input
          placeholder="Search documents by filename..."
          leftIcon={<Search size={16} />}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* ─── PDF List ────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="xl" />
            <p className="text-dark-400 text-sm">Querying document repository...</p>
          </div>
        ) : filteredPdfs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No PDF documents found"
            description="Upload study files to generate AI quizzes and build RAG knowledge."
          />
        ) : (
          <div className="space-y-3">
            {filteredPdfs.map((pdf) => (
              <Card
                key={pdf.id || pdf._id}
                padding="md"
                hover
                className="border-dark-700/60 bg-dark-900/60 backdrop-blur-sm"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="text-emerald-400" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <h3 className="font-bold text-white text-base">
                          {pdf.filename}
                        </h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          {pdf.pageCount || 1} Pages
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-dark-800 text-dark-300 border border-dark-700 flex items-center gap-1">
                          <HardDrive size={11} />
                          {formatFileSize(pdf.fileSize)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-dark-400 flex-wrap">
                        <span>Uploader: <strong className="text-white">{pdf.uploaderName || 'User'}</strong></span>
                        {pdf.createdAt && (
                          <span>Uploaded {formatRelativeTime(new Date(pdf.createdAt))}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Link
                      to={ROUTES.QUIZ_AI_GENERATE}
                      className="px-3.5 py-1.5 rounded-xl bg-dark-800 hover:bg-emerald-600 hover:text-white text-xs font-semibold text-dark-300 transition-colors flex items-center gap-1.5"
                    >
                      <span>Generate Quiz</span>
                    </Link>

                    <button
                      onClick={() => handleDeletePDF(pdf.id, pdf.filename)}
                      className="p-2 rounded-xl text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete PDF"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 p-4 rounded-xl border border-dark-800 bg-dark-900/60">
            <p className="text-xs text-dark-400">
              Page <span className="font-semibold text-white">{page}</span> of{' '}
              <span className="font-semibold text-white">{totalPages}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminPDFsPage;
