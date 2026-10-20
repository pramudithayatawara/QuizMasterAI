import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ExternalLink, Download, Brain, FileText,
  Layers, Search, CheckCircle, Clock, AlertCircle,
  Copy, Check, Database, Sparkles, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pdfAPI } from '../../api/pdf.api.js';
import { useTheme } from '../../hooks/useTheme.js';
import toast from 'react-hot-toast';

/**
 * @component PdfViewModal
 * @description Rich interactive modal for previewing PDFs and inspecting RAG vector chunks.
 */
const PdfViewModal = ({ pdf, isOpen, onClose, onGenerateQuiz }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'chunks' | 'info'
  const [chunksData, setChunksData] = useState(null);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [chunkSearch, setChunkSearch] = useState('');
  const [copiedChunkId, setCopiedChunkId] = useState(null);

  useEffect(() => {
    if (isOpen && pdf?.id) {
      setActiveTab('preview');
      fetchChunks(pdf.id);
    } else {
      setChunksData(null);
      setChunkSearch('');
    }
  }, [isOpen, pdf?.id]);

  const fetchChunks = async (pdfId) => {
    setIsLoadingChunks(true);
    try {
      const res = await pdfAPI.getPdfChunks(pdfId);
      const data = res.data || res;
      setChunksData(data);
    } catch (err) {
      console.warn('Could not fetch PDF chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

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

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateString);
    }
  };

  const handleCopyChunk = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    toast.success('Chunk text copied to clipboard!');
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  const handleNavigateToGenerator = () => {
    onClose();
    if (onGenerateQuiz) {
      onGenerateQuiz(pdf.id);
    } else {
      navigate(`/quizzes/ai-generate?pdfId=${pdf.id}`);
    }
  };

  const chunksList = chunksData?.chunks || [];
  const filteredChunks = chunksList.filter((c) => {
    if (!chunkSearch.trim()) return true;
    const text = (c.content || c.text || '').toLowerCase();
    return text.includes(chunkSearch.toLowerCase()) || String(c.chunk_index).includes(chunkSearch);
  });

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
          className={`relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${
            isDark 
              ? 'bg-[#0b101b] border-white/10 text-white shadow-cyan-950/20' 
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
          }`}
        >
          {/* Header Bar */}
          <div className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 ${
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
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle size={12} /> Ready
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(pdf.file_size || pdf.fileSize)}</span>
                  <span>•</span>
                  <span>{(pdf.chunk_count || pdf.chunkCount || chunksList.length || 0)} RAG chunks</span>
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

          {/* Navigation Tabs */}
          <div className={`px-4 sm:px-6 pt-3 border-b flex gap-4 ${
            isDark ? 'border-white/10 bg-[#0d1424]' : 'border-slate-100 bg-slate-100/50'
          }`}>
            <button
              onClick={() => setActiveTab('preview')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'preview'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={16} />
              <span>Document Preview</span>
            </button>

            <button
              onClick={() => setActiveTab('chunks')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'chunks'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers size={16} />
              <span>RAG Vector Chunks</span>
              {chunksList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                  {chunksList.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'info'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database size={16} />
              <span>Details & Metadata</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[480px]">
            {/* ─── TAB 1: PDF PREVIEW ─────────────────────────────────── */}
            {activeTab === 'preview' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center">
                  <iframe
                    src={pdfUrl}
                    title={pdfTitle}
                    className="w-full h-full rounded-xl border-none"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span>Viewing PDF via built-in secure viewer.</span>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    Open in separate tab if not rendering properly <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            {/* ─── TAB 2: RAG VECTOR CHUNKS ────────────────────────────── */}
            {activeTab === 'chunks' && (
              <div className="space-y-4">
                {/* Search & Info Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-white/5">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-cyan-400" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">Persistent SQLite Vector Store</h4>
                      <p className="text-xs text-slate-400">
                        {chunksList.length} total indexed chunks ready for semantic RAG retrieval
                      </p>
                    </div>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search within chunks..."
                      value={chunkSearch}
                      onChange={(e) => setChunkSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {isLoadingChunks ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
                    <p className="text-sm">Loading persistent vector chunks...</p>
                  </div>
                ) : filteredChunks.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Layers className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No chunks found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {chunkSearch ? 'No chunks matched your search keyword.' : 'This PDF has not been chunked yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                    {filteredChunks.map((chunk, idx) => {
                      const text = chunk.content || chunk.text || '';
                      const isCopied = copiedChunkId === chunk.id;
                      return (
                        <div
                          key={chunk.id || idx}
                          className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                Chunk #{chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : idx + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                {chunk.token_count && (
                                  <span className="text-[11px] text-slate-500">
                                    {chunk.token_count} tokens
                                  </span>
                                )}
                                <button
                                  onClick={() => handleCopyChunk(text, chunk.id)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                  title="Copy text"
                                >
                                  {isCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-mono line-clamp-6 bg-slate-950/40 p-2.5 rounded-lg border border-white/5">
                              {text}
                            </p>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
                            <span>Status: Persistent Embedding Active</span>
                            <span>512-dim Cosine Ready</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 3: DETAILS & METADATA ──────────────────────────── */}
            {activeTab === 'info' && (
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database size={16} className="text-indigo-400" /> Document Specifications
                  </h3>

                  <div className="divide-y divide-white/5 text-xs text-slate-300">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Document ID:</span>
                      <span className="font-mono text-cyan-300">#{pdf.id}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Original Name:</span>
                      <span className="font-semibold text-white">{pdf.original_name || pdf.name}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">File Size:</span>
                      <span>{formatFileSize(pdf.file_size || pdf.fileSize)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className="text-emerald-400 font-medium capitalize">{pdf.status || 'Completed'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Extracted Chunks:</span>
                      <span className="text-cyan-400 font-bold">{pdf.chunk_count || chunksList.length || 0} chunks</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-400">Uploaded Date:</span>
                      <span>{formatDate(pdf.created_at || pdf.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-3">
                  <Brain className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-white mb-0.5">RAG Quiz Readiness</h5>
                    <p className="text-indigo-200/80">
                      This document has been fully parsed and indexed into persistent SQLite vector storage. You can immediately generate AI-adaptive quizzes, battle mode topics, or review specific lecture notes.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PdfViewModal;
