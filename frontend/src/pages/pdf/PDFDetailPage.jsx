import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Brain, Play, Clock, CheckCircle,
  AlertCircle, Loader2, Layers, Calendar, Hash, ExternalLink, Eye
} from 'lucide-react';
import { pdfAPI } from '../../api/pdf.api.js';
import { quizAPI } from '../../api/quiz.api.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import QuizView from '../../components/quiz/QuizView.jsx';
import toast from 'react-hot-toast';

/**
 * @page PDFDetailPage
 * @description Shows PDF details and its generated quizzes.
 */
const PDFDetailPage = () => {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [pdf,    setPdf]    = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch PDF details
      const pdfRes = await pdfAPI.getPdfById(id);
      setPdf(pdfRes.data.data);

      // Fetch quizzes linked to this PDF
      const quizRes = await quizAPI.getQuizzesByPdf(id);
      setQuizzes(quizRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load PDF details');
      navigate('/pdfs');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setGenerating(true);
    const loadingToast = toast.loading('Generating quiz... This may take 10-15 seconds.');
    try {
      await quizAPI.generateQuiz({ pdfId: id, questionCount: 10 });
      toast.dismiss(loadingToast);
      toast.success('Quiz generated successfully!');
      // Refresh quizzes list
      const quizRes = await quizAPI.getQuizzesByPdf(id);
      setQuizzes(quizRes.data.data || []);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err.response?.data?.message || 'Failed to generate quiz');
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusConfig = {
    completed:  { icon: CheckCircle, color: 'text-secondary-400', bg: 'bg-secondary-500/10', label: 'Ready' },
    processing: { icon: Loader2,     color: 'text-accent-400',    bg: 'bg-accent-500/10',    label: 'Processing' },
    pending:    { icon: Clock,       color: 'text-dark-400',      bg: 'bg-dark-700',         label: 'Pending' },
    failed:     { icon: AlertCircle, color: 'text-red-400',       bg: 'bg-red-500/10',       label: 'Failed' },
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!pdf) return null;

  const status = statusConfig[pdf.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {selectedQuizId ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedQuizId(null)}
            className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors"
          >
            <ArrowLeft size={18} />
            Back to PDF Details & Quizzes
          </button>
          <QuizView
            quizId={selectedQuizId}
            pdfId={id}
            onClose={() => setSelectedQuizId(null)}
          />
        </div>
      ) : (
        <>
          {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/pdfs')}
          className="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 transition-colors text-dark-400 hover:text-dark-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-dark-50">PDF Details</h1>
          <p className="text-sm text-dark-400">View file info and manage quizzes</p>
        </div>
      </div>

      {/* ─── PDF Info Card ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card padding="lg">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-14 h-14 rounded-2xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
              <FileText size={28} className="text-primary-400" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-dark-50 truncate">
                    {pdf.originalName || pdf.fileName}
                  </h2>
                  <p className="text-sm text-dark-400 mt-1">{pdf.description || 'No description provided'}</p>
                </div>

                {/* Status Badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${status.bg} flex-shrink-0`}>
                  <StatusIcon
                    size={14}
                    className={`${status.color} ${pdf.status === 'processing' ? 'animate-spin' : ''}`}
                  />
                  <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                </div>
              </div>

              {/* Metadata row */}
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-dark-400">
                  <Hash size={14} />
                  <span>{formatSize(pdf.fileSize)}</span>
                </div>
                {pdf.pageCount && (
                  <div className="flex items-center gap-2 text-sm text-dark-400">
                    <FileText size={14} />
                    <span>{pdf.pageCount} pages</span>
                  </div>
                )}
                {pdf.chunkCount && (
                  <div className="flex items-center gap-2 text-sm text-dark-400">
                    <Layers size={14} />
                    <span>{pdf.chunkCount} chunks indexed</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-dark-400">
                  <Calendar size={14} />
                  <span>Uploaded {formatDate(pdf.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Generate Quiz Button */}
          {pdf.status === 'completed' && (
            <div className="mt-6 pt-4 border-t border-dark-700">
              <Button
                variant="primary"
                onClick={handleGenerateQuiz}
                disabled={generating}
                leftIcon={generating ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
              >
                {generating ? 'Generating Quiz...' : 'Generate New Quiz from this PDF'}
              </Button>
              <p className="text-xs text-dark-500 mt-2">
                AI will create 10 questions based on the PDF content. Takes ~15 seconds.
              </p>
            </div>
          )}

          {pdf.status === 'processing' && (
            <div className="mt-4 p-3 rounded-xl bg-accent-500/10 border border-accent-500/20">
              <p className="text-sm text-accent-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                PDF is still being processed. Quiz generation will be available once complete.
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ─── Quizzes Section ─────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-dark-100 mb-4 flex items-center gap-2">
          <Brain size={20} className="text-primary-400" />
          Generated Quizzes
          <span className="text-sm font-normal text-dark-500 ml-1">({quizzes.length})</span>
        </h2>

        {quizzes.length === 0 ? (
          <Card padding="lg" className="text-center py-12">
            <Brain size={40} className="text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-semibold">No quizzes yet</p>
            <p className="text-dark-500 text-sm mt-1">
              {pdf.status === 'completed'
                ? 'Click "Generate New Quiz" above to create one.'
                : 'Wait for the PDF to finish processing.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {quizzes.map((quiz, i) => (
              <motion.div
                key={quiz._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card padding="md" className="hover:border-primary-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    {/* Quiz icon */}
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                      <Brain size={20} className="text-primary-400" />
                    </div>

                    {/* Quiz info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-dark-100 truncate">
                        {quiz.title || 'Generated Quiz'}
                      </h3>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="text-xs text-dark-400 flex items-center gap-1">
                          <Hash size={11} /> {quiz.questions?.length || quiz.questionCount || '?'} questions
                        </span>
                        <span className="text-xs text-dark-400 capitalize flex items-center gap-1">
                          <Clock size={11} /> {quiz.difficulty || 'medium'}
                        </span>
                        <span className="text-xs text-dark-500 flex items-center gap-1">
                          <Calendar size={11} /> {formatDate(quiz.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedQuizId(quiz._id)}
                        leftIcon={<Eye size={14} />}
                      >
                        View & Test
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/quizzes/${quiz._id}/play`)}
                        leftIcon={<Play size={14} />}
                      >
                        Play
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default PDFDetailPage;
