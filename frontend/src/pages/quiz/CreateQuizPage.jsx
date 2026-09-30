import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, FileText, Brain, Clock, Layers, Settings,
  Search, CheckCircle, AlertCircle, Sparkles, Zap,
  BookOpen, BarChart3, Play, ChevronRight, Loader2
} from 'lucide-react';
import { ROUTES } from '../../constants/routes.js';
import { pdfAPI } from '../../api/pdf.api.js';
import { quizAPI } from '../../api/quiz.api.js';
import { DIFFICULTY_CONFIG } from '../../constants/difficulty.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { cn, normalizePath } from '../../utils/helpers.js';
import toast from 'react-hot-toast';

/**
 * @page CreateQuizPage
 * @description Create new quiz with AI-powered generation and Module 04 difficulty classification
 */
const CreateQuizPage = () => {
  const navigate = useNavigate();
  
  // State for PDFs
  const [pdfs, setPdfs] = useState([]);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfSearchQuery, setPdfSearchQuery] = useState('');
  const [isLoadingPdfs, setIsLoadingPdfs] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  
  // State for quiz configuration
  const [quizConfig, setQuizConfig] = useState({
    title: '',
    difficulty: 'random',
    questionCount: 10,
    timeLimit: 20,
    adaptiveMode: false,
  });
  
  // State for generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  
  // Load PDFs on mount
  useEffect(() => {
    const fetchPdfs = async () => {
      setIsLoadingPdfs(true);
      try {
        const response = await pdfAPI.getAll();
        console.log('PDF API Response:', response);
        
        // Handle different response structures safely
        let pdfArray = [];
        if (response?.data) {
          if (Array.isArray(response.data)) {
            pdfArray = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            pdfArray = response.data.data;
          } else if (response.data.data?.pdfs && Array.isArray(response.data.data.pdfs)) {
            pdfArray = response.data.data.pdfs;
          } else if (response.data.pdfs && Array.isArray(response.data.pdfs)) {
            pdfArray = response.data.pdfs;
          }
        }
        
        // Normalize PDF fields to match backend response
        const normalizedPdfs = pdfArray.map(pdf => ({
          _id: pdf._id || pdf.id,
          id: pdf.id || pdf._id,
          originalName: pdf.originalName || pdf.original_name || pdf.name,
          name: pdf.name || pdf.original_name || pdf.originalName,
          fileSize: pdf.fileSize || pdf.file_size,
          chunkCount: pdf.chunkCount || pdf.chunk_count || 0,
          status: pdf.status || 'completed',
          createdAt: pdf.createdAt || pdf.created_at,
          filePath: pdf.filePath || pdf.file_path,
        }));
        
        console.log('Extracted PDF Array:', normalizedPdfs);
        setPdfs(normalizedPdfs);
        setPdfError(null);
      } catch (error) {
        console.error('PDF fetch error:', error);
        setPdfs([]); // Set empty array on error
        setPdfError(error.response?.data?.detail || error.message || 'Failed to load PDFs');
        toast.error('Failed to load PDFs. Please try again.');
      } finally {
        setIsLoadingPdfs(false);
      }
    };
    
    fetchPdfs();
  }, []); // Load PDFs only on mount
  
  // Retry PDF fetch
  const handleRetryPdfs = () => {
    const fetchPdfs = async () => {
      setIsLoadingPdfs(true);
      setPdfError(null);
      try {
        const response = await pdfAPI.getAll();
        console.log('PDF API Response:', response);
        
        let pdfArray = [];
        if (response?.data) {
          if (Array.isArray(response.data)) {
            pdfArray = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            pdfArray = response.data.data;
          } else if (response.data.data?.pdfs && Array.isArray(response.data.data.pdfs)) {
            pdfArray = response.data.data.pdfs;
          } else if (response.data.pdfs && Array.isArray(response.data.pdfs)) {
            pdfArray = response.data.pdfs;
          }
        }
        
        const normalizedPdfs = pdfArray.map(pdf => ({
          _id: pdf._id || pdf.id,
          id: pdf.id || pdf._id,
          originalName: pdf.originalName || pdf.original_name || pdf.name,
          name: pdf.name || pdf.original_name || pdf.originalName,
          fileSize: pdf.fileSize || pdf.file_size,
          chunkCount: pdf.chunkCount || pdf.chunk_count || 0,
          status: pdf.status || 'completed',
          createdAt: pdf.createdAt || pdf.created_at,
          filePath: pdf.filePath || pdf.file_path,
        }));
        
        console.log('Extracted PDF Array:', normalizedPdfs);
        setPdfs(normalizedPdfs);
        setPdfError(null);
      } catch (error) {
        console.error('PDF fetch error:', error);
        setPdfs([]);
        setPdfError(error.response?.data?.detail || error.message || 'Failed to load PDFs');
        toast.error('Failed to load PDFs. Please try again.');
      } finally {
        setIsLoadingPdfs(false);
      }
    };
    
    fetchPdfs();
  };
  
  // Auto-fill title when PDF is selected
  useEffect(() => {
    if (selectedPdf?.originalName && !quizConfig.title) {
      const baseTitle = selectedPdf.originalName.replace('.pdf', '').replace(/_/g, ' ');
      setQuizConfig(prev => ({
        ...prev,
        title: `${baseTitle} Quiz`
      }));
    }
  }, [selectedPdf]);
  
  // Update time limit based on difficulty
  useEffect(() => {
    if (!quizConfig.adaptiveMode) {
      const timeLimit = DIFFICULTY_CONFIG[quizConfig.difficulty]?.timeLimit || 20;
      setQuizConfig(prev => ({ ...prev, timeLimit }));
    }
  }, [quizConfig.difficulty, quizConfig.adaptiveMode]);
  
  const handlePdfSelect = (pdf) => {
    setSelectedPdf(pdf);
  };
  
  const handleConfigChange = (field, value) => {
    setQuizConfig(prev => ({ ...prev, [field]: value }));
  };
  
  const handleGenerateQuiz = async () => {
    if (!selectedPdf) {
      toast.error('Please select a PDF first.');
      return;
    }
    
    if (!quizConfig.title.trim()) {
      toast.error('Please enter a quiz title.');
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    
    try {
      // Simulate progress steps
      const steps = [
        { step: 'Analyzing PDF content...', progress: 20 },
        { step: 'Retrieving relevant chunks...', progress: 40 },
        { step: 'Generating questions with AI...', progress: 60 },
        { step: 'Classifying difficulty levels...', progress: 80 },
        { step: 'Finalizing quiz...', progress: 90 },
      ];
      
      for (const { step, progress } of steps) {
        setGenerationStep(step);
        setGenerationProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Call API
      const response = await quizAPI.generateQuiz({
        pdfId: selectedPdf?._id || selectedPdf?.id,
        title: quizConfig.title,
        difficulty: quizConfig.difficulty,
        questionCount: quizConfig.questionCount,
        timeLimit: quizConfig.timeLimit,
        adaptiveMode: quizConfig.adaptiveMode,
      });
      
      setGenerationProgress(100);
      setGenerationStep('Quiz created successfully!');
      
      toast.success('Quiz generated successfully!');
      
      // Navigate to quiz play page
      setTimeout(() => {
        const quizId = response?.data?.data?.quiz?._id || response?.data?.quiz?._id || response?.data?.data?.id;
        if (quizId) {
          navigate(normalizePath(ROUTES.QUIZ_PLAY.replace(':id', quizId)));
        } else {
          toast.error('Failed to navigate to quiz. Please try again.');
          setIsGenerating(false);
        }
      }, 500);
      
    } catch (error) {
      console.error('Quiz generation error:', error);
      toast.error(error.response?.data?.message || 'Failed to generate quiz. Please try again.');
      setGenerationProgress(0);
      setGenerationStep('');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const filteredPdfs = (pdfs || []).filter(pdf =>
    (pdf?.originalName || pdf?.name || '')?.toLowerCase().includes(pdfSearchQuery.toLowerCase())
  );
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Link to={ROUTES.QUIZ_LIST}>
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />}>
            Back to Quizzes
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-dark-50">Create New Quiz</h1>
          <p className="text-dark-400 mt-1">
            Generate AI-powered quizzes with automatic difficulty classification
          </p>
        </div>
      </motion.div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PDF Selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card padding="md" className="h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-primary-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-dark-50">Select PDF</h2>
                <p className="text-xs text-dark-400">Choose a source document</p>
              </div>
            </div>
            
            {/* Search */}
            <div className="mb-4">
              <Input
                placeholder="Search PDFs..."
                leftIcon={<Search size={16} />}
                value={pdfSearchQuery}
                onChange={(e) => setPdfSearchQuery(e.target.value)}
              />
            </div>
            
            {/* PDF List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {isLoadingPdfs ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner size="md" />
                </div>
              ) : pdfError ? (
                <EmptyState
                  icon={AlertCircle}
                  title="Error loading PDFs"
                  description={pdfError || 'Something went wrong. Please try again.'}
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Loader2 size={18} className="animate-spin" />}
                      onClick={handleRetryPdfs}
                    >
                      Retry
                    </Button>
                  }
                />
              ) : filteredPdfs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No PDFs found"
                  description={pdfSearchQuery ? 'Try adjusting your search.' : 'Upload a PDF to get started.'}
                  action={
                    !pdfSearchQuery && (
                      <Link to={ROUTES.PDF_LIST}>
                        <Button variant="primary" size="sm">
                          Upload PDF
                        </Button>
                      </Link>
                    )
                  }
                />
              ) : (
                filteredPdfs.map((pdf) => (
                  <motion.div
                    key={pdf._id || pdf.id || Math.random()}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handlePdfSelect(pdf)}
                    className={cn(
                      'p-4 rounded-xl border cursor-pointer transition-all',
                      (selectedPdf?._id === pdf._id || selectedPdf?.id === pdf.id)
                        ? 'bg-primary-500/10 border-primary-500/50'
                        : 'bg-dark-800/40 border-dark-700 hover:border-primary-500/30 hover:bg-dark-800/60'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        (selectedPdf?._id === pdf._id || selectedPdf?.id === pdf.id)
                          ? 'bg-primary-500/20'
                          : 'bg-dark-700'
                      )}>
                        <FileText size={18} className={cn(
                          (selectedPdf?._id === pdf._id || selectedPdf?.id === pdf.id) ? 'text-primary-400' : 'text-dark-400'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          'font-medium truncate',
                          (selectedPdf?._id === pdf._id || selectedPdf?.id === pdf.id) ? 'text-primary-400' : 'text-dark-200'
                        )}>
                          {pdf.originalName || pdf.name || 'Untitled PDF'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-dark-400">
                            {pdf.chunkCount || 0} chunks
                          </span>
                          {pdf.status === 'completed' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle size={12} />
                              Ready
                            </span>
                          )}
                        </div>
                      </div>
                      {(selectedPdf?._id === pdf._id || selectedPdf?.id === pdf.id) && (
                        <CheckCircle size={20} className="text-primary-400 flex-shrink-0" />
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
        
        {/* Quiz Configuration */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card padding="md" className="h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-accent-500/10 rounded-xl flex items-center justify-center">
                <Settings size={20} className="text-accent-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-dark-50">Quiz Configuration</h2>
                <p className="text-xs text-dark-400">Customize your quiz settings</p>
              </div>
            </div>
            
            <div className="space-y-5">
              {/* Quiz Title */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Quiz Title
                </label>
                <Input
                  placeholder="Enter quiz title..."
                  value={quizConfig.title}
                  onChange={(e) => handleConfigChange('title', e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              
              {/* Difficulty Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Target Difficulty
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(DIFFICULTY_CONFIG || {}).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => handleConfigChange('difficulty', key)}
                      disabled={isGenerating}
                      className={cn(
                        'p-3 rounded-xl border transition-all text-center',
                        quizConfig.difficulty === key
                          ? (config.bgColor || config.bgClass || 'bg-primary-500/10') + ' ' + (config.color || config.textClass || 'text-primary-400') + ' ' + (config.border || config.borderClass || 'border-primary-500/50')
                          : 'bg-dark-800/40 border-dark-700 text-dark-400 hover:border-dark-600'
                      )}
                    >
                      <div className="text-2xl mb-1">{config.icon || '📝'}</div>
                      <div className="text-sm font-medium">{config.label || key}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Question Count */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Number of Questions
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="20"
                    value={quizConfig.questionCount}
                    onChange={(e) => handleConfigChange('questionCount', parseInt(e.target.value))}
                    disabled={isGenerating}
                    className="flex-1 accent-primary-500"
                  />
                  <div className="w-16 text-center">
                    <span className="text-lg font-bold text-dark-50">
                      {quizConfig.questionCount}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Time Limit */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Time Limit (minutes)
                </label>
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-dark-400" />
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={quizConfig.timeLimit}
                    onChange={(e) => handleConfigChange('timeLimit', parseInt(e.target.value))}
                    disabled={isGenerating || quizConfig.adaptiveMode}
                    className="input-base flex-1"
                  />
                </div>
                {quizConfig.adaptiveMode && (
                  <p className="text-xs text-dark-500 mt-1">
                    Time limit will be adjusted automatically based on adaptive difficulty
                  </p>
                )}
              </div>
              
              {/* Adaptive Mode Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Sparkles size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-400">Adaptive Mode</h4>
                    <p className="text-xs text-dark-400">AI adjusts difficulty based on performance</p>
                  </div>
                </div>
                <button
                  onClick={() => handleConfigChange('adaptiveMode', !quizConfig.adaptiveMode)}
                  disabled={isGenerating}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    quizConfig.adaptiveMode ? 'bg-purple-600' : 'bg-dark-700'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    quizConfig.adaptiveMode ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
              
              {/* Module 04 Info */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <Brain size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-400 mb-1">AI Difficulty Classification</h4>
                    <p className="text-xs text-dark-400">
                      Each question will be automatically classified as Easy, Medium, or Hard based on concept complexity, context length, reasoning required, and Bloom's taxonomy level.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Generate Button */}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                leftIcon={isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                onClick={handleGenerateQuiz}
                disabled={!selectedPdf || isGenerating}
              >
                {isGenerating ? 'Generating Quiz...' : 'Generate Quiz with AI'}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
      
      {/* Generation Progress Modal */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <Card padding="lg" className="max-w-md w-full">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center">
                <Brain size={36} className="text-white animate-pulse" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-dark-50 mb-2">
                  Creating Your Quiz
                </h3>
                <p className="text-dark-400 text-sm">
                  {generationStep}
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-3 bg-dark-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${generationProgress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                  />
                </div>
                <div className="flex justify-between text-xs text-dark-400">
                  <span>AI Processing</span>
                  <span>{generationProgress}%</span>
                </div>
              </div>
              
              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-dark-400">
                  <Zap size={14} className="text-yellow-400" />
                  <span>RAG Analysis</span>
                </div>
                <div className="flex items-center gap-2 text-dark-400">
                  <BookOpen size={14} className="text-blue-400" />
                  <span>Context Extraction</span>
                </div>
                <div className="flex items-center gap-2 text-dark-400">
                  <Brain size={14} className="text-purple-400" />
                  <span>AI Generation</span>
                </div>
                <div className="flex items-center gap-2 text-dark-400">
                  <BarChart3 size={14} className="text-emerald-400" />
                  <span>Difficulty Classification</span>
                </div>
              </div>
              
              <p className="text-xs text-dark-500">
                This may take a moment as we analyze your PDF and generate intelligent questions.
              </p>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default CreateQuizPage;