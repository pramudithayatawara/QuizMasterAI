import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Download, ExternalLink, Brain,
  Layers, Search, CheckCircle, Database, Calendar,
  AlertCircle, Loader2, Sparkles, Copy, Check
} from 'lucide-react';
import { pdfAPI } from '../../api/pdf.api.js';
import { useTheme } from '../../hooks/useTheme.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import toast from 'react-hot-toast';

/**
 * @page PDFDetailPage
 * @description Dedicated full-page viewer for PDF documents, metadata, and persistent RAG vector chunks.
 */
const PDFDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [pdf, setPdf] = useState(null);
  const [chunksData, setChunksData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'chunks' | 'info'
  const [chunkSearch, setChunkSearch] = useState('');
  const [copiedChunkId, setCopiedChunkId] = useState(null);

  useEffect(() => {
    if (id) {
      loadPDFDetails(id);
      loadChunks(id);
    }
  }, [id]);

  const loadPDFDetails = async (pdfId) => {
    setIsLoading(true);
    try {
      const res = await pdfAPI.getPdfById(pdfId);
      const data = res.data || res;
      setPdf(data);
    } catch (err) {
      console.error('Failed to load PDF details:', err);
      toast.error('Could not load PDF document.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadChunks = async (pdfId) => {
    setIsLoadingChunks(true);
    try {
      const res = await pdfAPI.getPdfChunks(pdfId);
      const data = res.data || res;
      setChunksData(data);
    } catch (err) {
      console.warn('Failed to load chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

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

  const handleCopyChunk = (text, chunkId) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(chunkId);
    toast.success('Chunk text copied to clipboard!');
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-slate-400 text-sm">Loading PDF document...</p>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">PDF Document Not Found</h2>
        <p className="text-slate-400 mb-6">The requested PDF may have been deleted or does not exist.</p>
        <Link
          to="/pdfs"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
        >
          <ArrowLeft size={18} />
          Back to PDF Management
        </Link>
      </div>
    );
  }

  const pdfUrl = pdfAPI.getFileUrl(pdf.id);
  const downloadUrl = pdfAPI.getFileUrl(pdf.id, true);
  const pdfTitle = pdf.original_name || pdf.name || 'Document.pdf';
  const chunksList = chunksData?.chunks || [];
  const filteredChunks = chunksList.filter((c) => {
    if (!chunkSearch.trim()) return true;
    const text = (c.content || c.text || '').toLowerCase();
    return text.includes(chunkSearch.toLowerCase()) || String(c.chunk_index).includes(chunkSearch);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/pdfs')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to All PDFs</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(`/quizzes/ai-generate?pdfId=${pdf.id || pdf._id}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Sparkles size={16} />
            <span>Generate AI Quiz</span>
          </button>

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
          >
            <ExternalLink size={16} />
            <span>Open in New Tab</span>
          </a>

          <a
            href={downloadUrl}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors"
          >
            <Download size={16} />
            <span>Download</span>
          </a>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className={`p-6 rounded-2xl border backdrop-blur-md ${
        isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <FileText className="w-7 h-7 text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white truncate" title={pdfTitle}>
                {pdfTitle}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle size={12} /> Ready for RAG
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs sm:text-sm text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {formatDate(pdf.created_at || pdf.createdAt)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Layers size={14} /> {formatFileSize(pdf.file_size || pdf.fileSize)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Database size={14} /> {pdf.chunk_count || chunksList.length || 0} Persistent Vector Chunks
              </span>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-4 mt-6 border-b border-white/10 pt-2">
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
            <span>RAG Vector Chunks ({chunksList.length})</span>
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
            <span>Document Metadata</span>
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'preview' && (
        <div className="space-y-3">
          <div className="w-full h-[750px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl">
            <iframe
              src={pdfUrl}
              title={pdfTitle}
              className="w-full h-full rounded-2xl border-none"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span>Built-in PDF interactive reader. Use zoom, rotate, and search within viewer.</span>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1"
            >
              Open in external window <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {activeTab === 'chunks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Database className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Persistent SQLite Vector Store</h3>
                <p className="text-xs text-slate-400">
                  {chunksList.length} indexed chunks with 512-dimensional semantic embeddings
                </p>
              </div>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search chunks text..."
                value={chunkSearch}
                onChange={(e) => setChunkSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-800 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {isLoadingChunks ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto mb-2" />
              <p className="text-sm">Fetching vector chunks from database...</p>
            </div>
          ) : filteredChunks.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Layers className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">No chunks found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredChunks.map((chunk, idx) => {
                const text = chunk.content || chunk.text || '';
                const isCopied = copiedChunkId === chunk.id;
                return (
                  <div
                    key={chunk.id || idx}
                    className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                          Chunk #{chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {chunk.token_count && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              {chunk.token_count} tokens
                            </span>
                          )}
                          <button
                            onClick={() => handleCopyChunk(text, chunk.id)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Copy text"
                          >
                            {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/60 p-3 rounded-xl border border-white/5">
                        {text}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-white/5 pt-2">
                      <span>Vector Status: Embedded & Indexed</span>
                      <span className="text-cyan-400 font-mono">512-dim</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'info' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database size={18} className="text-indigo-400" /> Technical Details
            </h3>

            <div className="divide-y divide-white/5 text-sm text-slate-300">
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">Database Record ID:</span>
                <span className="font-mono text-cyan-300">#{pdf.id}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">Original Filename:</span>
                <span className="font-semibold text-white">{pdf.original_name || pdf.name}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">Server Filename:</span>
                <span className="font-mono text-xs text-slate-400">{pdf.name}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">File Size:</span>
                <span>{formatFileSize(pdf.file_size || pdf.fileSize)}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">Chunk Count:</span>
                <span className="text-cyan-400 font-bold">{pdf.chunk_count || chunksList.length || 0} chunks</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">Upload Date:</span>
                <span>{formatDate(pdf.created_at || pdf.createdAt)}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-medium capitalize">{pdf.status || 'Completed'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFDetailPage;
