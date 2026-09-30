import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  Loader2, 
  FileText, 
  Sparkles, 
  Send, 
  AlertCircle,
  CheckCircle,
  BookOpen,
  Upload,
  Trash2,
  Copy,
  Download,
  Save,
  Zap,
  Award,
  Filter,
  Sliders,
  Play
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { quizAPI } from '../../api/quiz.api.js';
import { extractErrorMessage, logErrorDetails } from '../../utils/errorUtils.js';
import toast from 'react-hot-toast';
import InteractiveMixedQuiz from '../../components/quiz/InteractiveMixedQuiz.jsx';
import { useAuthStore } from '../../store/auth.store.js';

/**
 * @component AIQuizGenerationPage
 * @description AI-powered quiz generation dashboard with PDF upload, mixed question generation, and Priority 30/31 integration
 */
const AIQuizGenerationPage = () => {
  const { theme } = useTheme();
  const { user } = useAuthStore();
  const isDark = theme === 'dark';

  // State management
  const [inputMode, setInputMode] = useState('pdf'); // 'text' or 'pdf'
  const [context, setContext] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPDF, setSelectedPDF] = useState(null);
  const [pdfs, setPdfs] = useState([]);
  const [isLoadingPDFs, setIsLoadingPDFs] = useState(false);
  
  // Quiz configuration state
  const [quizConfig, setQuizConfig] = useState({
    totalQuestions: 10,
    mcqPercentage: 0.7,
    difficulty: 'random',
    topic: '',
    enableValidation: true,
    enableDeduplication: true
  });

  // Priority 30 & 31 states
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [savedQuizId, setSavedQuizId] = useState(null);
  const [questionDifficulties, setQuestionDifficulties] = useState({});
  
  // Interactive quiz mode state
  const [showInteractiveQuiz, setShowInteractiveQuiz] = useState(false);

  // Fetch PDFs on component mount
  useEffect(() => {
    fetchPDFs();
  }, []);

  const fetchPDFs = async () => {
    setIsLoadingPDFs(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://127.0.0.1:8000/api/v1/pdfs', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await response.json();
      setPdfs(Array.isArray(data) ? data : []);
    } catch (error) {
      logErrorDetails(error, 'fetchPDFs');
      toast.error(extractErrorMessage(error) || 'Failed to load PDFs');
    } finally {
      setIsLoadingPDFs(false);
    }
  };

  const handleGenerateQuiz = async () => {
    // Handle PDF mode with mixed question generation
    if (inputMode === 'pdf' && selectedPDF) {
      await handleMixedPDFGeneration();
      return;
    }

    // Handle text mode
    if (!context.trim()) {
      toast.error('Please provide context');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedQuestions([]);

    try {
      // Use the RAG endpoint for text-based generation
      const requestData = {
        context: context.trim()
      };

      const response = await quizAPI.generateFromContext(requestData);
      
      if (response && response.data && response.data.question) {
        setGeneratedQuestions([{
          id: Date.now(),
          question: response.data.question,
          context: response.data.context,
          options: [],
          question_type: 'mcq',
          difficulty: 'medium',
          generatedAt: new Date().toISOString()
        }]);
        toast.success('Quiz question generated successfully!');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      logErrorDetails(error, 'handleGenerateQuiz (text mode)');
      setError(extractErrorMessage(error) || 'Failed to generate quiz');
      toast.error(extractErrorMessage(error) || 'Failed to generate quiz question');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMixedPDFGeneration = async () => {
    if (!selectedPDF) {
      toast.error('Please select a PDF');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedQuestions([]);

    try {
      // First, we need to fetch the PDF content
      console.log('📄 Fetching PDF content for:', selectedPDF.id);
      
      // Fetch PDF content from backend
      const pdfResponse = await fetch(`http://127.0.0.1:8000/api/v1/pdfs/${selectedPDF.id}/chunks`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF content: ${pdfResponse.status} ${pdfResponse.statusText}`);
      }

      const pdfData = await pdfResponse.json();
      console.log('📄 PDF chunks response:', pdfData);

      // Handle different response formats
      let pdfContent = '';
      
      if (pdfData.error) {
        console.warn('⚠️ PDF chunks error:', pdfData.error);
        // Try to use the PDF file path directly with the RAG endpoint
        console.log('🔄 Falling back to RAG endpoint with PDF ID');
        
        const ragResponse = await quizAPI.generateQuizFromPDF({
          pdf_id: selectedPDF.id,
          file_path: selectedPDF.file_path
        });
        
        console.log('🎯 RAG response:', ragResponse);
        
        if (ragResponse.data && ragResponse.data.questions) {
          const questions = ragResponse.data.questions.map((q, index) => ({
            id: Date.now() + index,
            question: q.question,
            context: q.context_snippet || selectedPDF.original_name,
            options: [],
            question_type: 'mcq',
            difficulty: 'medium',
            correct_answer: '',
            explanation: '',
            confidence_score: 0.8,
            relevance_score: 0.8,
            generatedAt: new Date().toISOString()
          }));

          setGeneratedQuestions(questions);
          toast.success(`Generated ${questions.length} questions using RAG fallback`);
          return;
        } else {
          throw new Error('Failed to generate questions with RAG fallback');
        }
      }

      // Process chunks if available
      if (Array.isArray(pdfData.chunks) && pdfData.chunks.length > 0) {
        pdfContent = pdfData.chunks
          .map(chunk => chunk.content || chunk.text || '')
          .filter(content => content && content.trim().length > 0)
          .join('\n\n');
      } else if (pdfData.content || pdfData.text) {
        pdfContent = pdfData.content || pdfData.text;
      }

      console.log('📄 Combined PDF content length:', pdfContent.length);

      // Reduce minimum content length requirement
      if (!pdfContent || pdfContent.length < 50) {
        console.warn('⚠️ PDF content is very short, trying with what we have:', pdfContent.length);
        if (pdfContent.length === 0) {
          throw new Error('PDF content is empty. Please select a PDF with extractable text.');
        }
      }

      // Use JSON body method (matches Pydantic model in backend)
      console.log('🔄 Using JSON body method for mixed generation');
      const response = await quizAPI.generateMixedFromPDF(pdfContent, {
        totalQuestions: quizConfig.totalQuestions,
        mcqPercentage: quizConfig.mcqPercentage,
        difficulty: quizConfig.difficulty,
        topic: quizConfig.topic || null,
        enableContentVerification: true
      });

      console.log('🎯 Mixed generation response:', response);

      if (response.data && response.data.questions) {
        const questions = response.data.questions.map((q, index) => ({
          id: Date.now() + index,
          question: q.question_text || q.question,
          context: selectedPDF.original_name || 'PDF Content',
          options: (() => {
            // Robust option extraction to handle different backend formats
            const isMCQ = q.type === 'mcq' || q.question_type === 'mcq' || q.question_type === 'multiple_choice';
            const isTrueFalse = q.type === 'true_false' || q.question_type === 'true_false' || q.question_type === 'true/false';
            
            if (isTrueFalse) {
              return ['True', 'False'];
            }
            
            if (!isMCQ) {
              return [];
            }
            
            // Try different possible keys that backend might send
            const possibleKeys = ['options', 'choices', 'answers', 'option_list', 'option_texts'];
            
            for (const key of possibleKeys) {
              if (q[key]) {
                const opts = q[key];
                
                // If it's an array of strings, use directly
                if (Array.isArray(opts) && opts.length > 0 && typeof opts[0] === 'string') {
                  return opts;
                }
                
                // If it's an array of objects with option_text property, extract the text
                if (Array.isArray(opts) && opts.length > 0 && typeof opts[0] === 'object') {
                  const extracted = opts.map(opt => opt.option_text || opt.text || opt.content || opt);
                  if (extracted.every(item => typeof item === 'string')) {
                    return extracted;
                  }
                }
              }
            }
            
            // Fallback: try to extract from raw options if they exist
            if (q.options) {
              const opts = q.options;
              if (Array.isArray(opts)) {
                // Handle both string arrays and object arrays
                return opts.map(opt => {
                  if (typeof opt === 'string') return opt;
                  if (typeof opt === 'object' && opt !== null) {
                    return opt.option_text || opt.text || opt.content || JSON.stringify(opt);
                  }
                  return String(opt);
                });
              }
            }
            
            // Final fallback
            return [];
          })(),
          question_type: q.type || q.question_type, // Use 'type' from backend or fallback to 'question_type'
          difficulty: q.difficulty || 'medium',
          correct_answer: q.correct_answer || '',
          explanation: q.explanation || '',
          confidence_score: q.confidence_score || 0.8,
          relevance_score: q.relevance_score || 0.8,
          generatedAt: new Date().toISOString()
        }));

        setGeneratedQuestions(questions);
        
        const mcqCount = questions.filter(q => q.question_type === 'mcq' || q.question_type === 'multiple_choice').length;
        const tfCount = questions.filter(q => q.question_type === 'true_false' || q.question_type === 'true/false').length;
        
        toast.success(`Generated ${questions.length} questions (${mcqCount} MCQ, ${tfCount} True/False)`);
      } else {
        throw new Error('Invalid response format from mixed generation');
      }
    } catch (error) {
      logErrorDetails(error, 'handleMixedPDFGeneration');
      
      // Detailed error logging
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
      }
      
      const errorMessage = extractErrorMessage(error) || 'Failed to generate mixed questions from PDF';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearInput = () => {
    setContext('');
    setSelectedPDF(null);
    setGeneratedQuestions([]);
    setError(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleCopyQuestion = (question) => {
    navigator.clipboard.writeText(question);
    toast.success('Question copied to clipboard');
  };

  const handleDownloadQuiz = () => {
    if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
      toast.error('No questions to download');
      return;
    }

    const quizText = generatedQuestions.map((q, index) => 
      `Q${index + 1}: ${q.question || 'No question text'}\nType: ${q.question_type || 'unknown'}\nDifficulty: ${q.difficulty || 'medium'}\n\n`
    ).join('---\n\n');
    
    const blob = new Blob([quizText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Quiz downloaded successfully');
  };

  // Priority 30: Save quiz handler
  const handleSaveQuiz = async () => {
    if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
      toast.error('No questions to save');
      return;
    }

    setIsSaving(true);
    try {
      const userId = user?.id || (user?.user && user.user.id) || localStorage.getItem('userId') || 1;
      
      const quizData = {
        user_id: parseInt(userId),
        quiz_title: `${inputMode === 'pdf' ? selectedPDF?.original_name || 'PDF Quiz' : 'Text Quiz'} - ${new Date().toLocaleDateString()}`,
        quiz_description: `AI-generated quiz with ${generatedQuestions.length} questions (${generatedQuestions.filter(q => q.question_type === 'mcq').length} MCQ, ${generatedQuestions.filter(q => q.question_type === 'true_false').length} True/False)`,
        questions: generatedQuestions.map((q, index) => ({
          question_text: q.question || '',
          question_type: q.question_type || 'mcq',
          options: Array.isArray(q.options) ? q.options : [],
          correct_answer: q.correct_answer || '',
          difficulty: q.difficulty || 'medium',
          source_chunk_index: index,
          confidence_score: q.confidence_score || 0.8,
          question_metadata: {
            relevance_score: q.relevance_score || 0.8,
            explanation: q.explanation || '',
            generated_at: q.generatedAt
          },
          tags: [q.question_type || 'mcq', q.difficulty || 'medium']
        })),
        pdf_id: selectedPDF?.id || null,
        category: inputMode === 'pdf' ? 'PDF-based' : 'Text-based',
        quiz_metadata: {
          generation_mode: inputMode,
          generated_at: new Date().toISOString(),
          total_questions: generatedQuestions.length,
          mcq_count: generatedQuestions.filter(q => q.question_type === 'mcq').length,
          tf_count: generatedQuestions.filter(q => q.question_type === 'true_false').length,
          validation_applied: quizConfig.enableValidation,
          deduplication_applied: quizConfig.enableDeduplication
        },
        tags: ['AI-generated', inputMode === 'pdf' ? 'PDF' : 'Text', 'mixed-questions']
      };

      const response = await quizAPI.storeQuiz(quizData);
      
      if (response.data && response.data.quiz_id) {
        setSavedQuizId(response.data.quiz_id);
        toast.success(`Quiz saved successfully! Quiz ID: ${response.data.quiz_id}`);
        
        // Trigger difficulty categorization
        await handleCategorizeDifficulty(response.data.quiz_id);
      } else {
        throw new Error('Failed to save quiz');
      }
    } catch (error) {
      logErrorDetails(error, 'handleSaveQuiz');
      toast.error(extractErrorMessage(error) || 'Failed to save quiz');
    } finally {
      setIsSaving(false);
    }
  };

  // Priority 31: Difficulty categorization handler
  const handleCategorizeDifficulty = async (quizId) => {
    if (!quizId) {
      toast.error('No quiz ID available for categorization');
      return;
    }

    setIsCategorizing(true);
    try {
      const response = await quizAPI.categorizeDifficulty(quizId);
      
      if (response.data) {
        const difficulties = {};
        response.data.categorizations?.forEach((cat, index) => {
          difficulties[cat.question_id] = {
            difficulty: cat.difficulty,
            cognitive_level: cat.cognitive_level,
            difficulty_score: cat.difficulty_score
          };
        });
        
        setQuestionDifficulties(difficulties);
        toast.success(`Difficulty categorized: ${response.data.easy_count} Easy, ${response.data.medium_count} Medium, ${response.data.hard_count} Hard`);
      }
    } catch (error) {
      logErrorDetails(error, 'handleCategorizeDifficulty');
      toast.error(extractErrorMessage(error) || 'Failed to categorize difficulty');
    } finally {
      setIsCategorizing(false);
    }
  };

  // Get difficulty badge component
  const getDifficultyBadge = (difficulty) => {
    const difficultyConfig = {
      random: {
        color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        icon: Sliders,
        label: 'Mixed'
      },
      mixed: {
        color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        icon: Sliders,
        label: 'Mixed'
      },
      easy: {
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        icon: Zap,
        label: 'Easy'
      },
      medium: {
        color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        icon: Award,
        label: 'Medium'
      },
      hard: {
        color: 'bg-red-500/10 text-red-400 border-red-500/30',
        icon: Brain,
        label: 'Hard'
      }
    };

    const config = difficultyConfig[difficulty?.toLowerCase()] || difficultyConfig.medium;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        <span>{config.label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            AI Quiz Generator
          </h1>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Generate intelligent mixed quizzes from PDF documents with validation and categorization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Brain className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
        </div>
      </motion.div>

      {/* Quiz Configuration Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-2xl p-6 backdrop-blur-md ${
          isDark 
            ? 'bg-slate-800/40 border border-white/10' 
            : 'bg-white/40 border border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sliders size={20} className="text-indigo-400" />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Quiz Configuration
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Questions */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Total Questions
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={quizConfig.totalQuestions}
              onChange={(e) => setQuizConfig({...quizConfig, totalQuestions: parseInt(e.target.value)})}
              className={`w-full px-4 py-2 rounded-lg ${
                isDark 
                  ? 'bg-slate-900/50 border border-slate-700 text-white' 
                  : 'bg-gray-50 border border-gray-300 text-gray-900'
              }`}
            />
          </div>

          {/* MCQ Percentage */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              MCQ Percentage ({Math.round(quizConfig.mcqPercentage * 100)}%)
            </label>
            <input
              type="range"
              min="60"
              max="100"
              value={quizConfig.mcqPercentage * 100}
              onChange={(e) => setQuizConfig({...quizConfig, mcqPercentage: parseInt(e.target.value) / 100})}
              className="w-full"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Difficulty
            </label>
            <select
              value={quizConfig.difficulty}
              onChange={(e) => setQuizConfig({...quizConfig, difficulty: e.target.value})}
              className={`w-full px-4 py-2 rounded-lg ${
                isDark 
                  ? 'bg-slate-900/50 border border-slate-700 text-white' 
                  : 'bg-gray-50 border border-gray-300 text-gray-900'
              }`}
            >
              <option value="random">🔀 Random / Mixed (Easy, Medium, Hard)</option>
              <option value="easy">🟢 Easy</option>
              <option value="medium">🟡 Medium</option>
              <option value="hard">🔴 Hard</option>
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Topic (Optional)
            </label>
            <input
              type="text"
              value={quizConfig.topic}
              onChange={(e) => setQuizConfig({...quizConfig, topic: e.target.value})}
              placeholder="e.g., Machine Learning"
              className={`w-full px-4 py-2 rounded-lg ${
                isDark 
                  ? 'bg-slate-900/50 border border-slate-700 text-white' 
                  : 'bg-gray-50 border border-gray-300 text-gray-900'
              }`}
            />
          </div>

          {/* Validation Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="validation"
              checked={quizConfig.enableValidation}
              onChange={(e) => setQuizConfig({...quizConfig, enableValidation: e.target.checked})}
              className="w-4 h-4"
            />
            <label htmlFor="validation" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Enable Validation
            </label>
          </div>

          {/* Deduplication Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="deduplication"
              checked={quizConfig.enableDeduplication}
              onChange={(e) => setQuizConfig({...quizConfig, enableDeduplication: e.target.checked})}
              className="w-4 h-4"
            />
            <label htmlFor="deduplication" className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Remove Duplicates
            </label>
          </div>
        </div>
      </motion.div>

      {/* PDF Selection Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-2xl p-6 backdrop-blur-md ${
          isDark 
            ? 'bg-slate-800/40 border border-white/10' 
            : 'bg-white/40 border border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-indigo-400" />
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Select PDF Document
            </h3>
          </div>
          <button
            onClick={fetchPDFs}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs transition-all ${
              isDark 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
            }`}
          >
            <span>Refresh</span>
          </button>
        </div>
        
        {/* PDF Grid */}
        <div className={`p-4 rounded-xl border-2 border-dashed ${
          isDark 
            ? 'border-slate-700 bg-slate-900/50' 
            : 'border-gray-300 bg-gray-50'
        }`}>
          {isLoadingPDFs ? (
            <div className="text-center py-8">
              <Loader2 size={32} className={`mx-auto mb-4 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Loading PDFs...
              </p>
            </div>
          ) : pdfs.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                No PDFs available. Upload PDFs first via the PDF Manager.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {pdfs.map((pdf) => (
                <button
                  key={pdf.id}
                  onClick={() => setSelectedPDF(pdf)}
                  className={`w-full text-left p-4 rounded-lg transition-all ${
                    selectedPDF?.id === pdf.id
                      ? `${isDark ? 'bg-indigo-600/20 border-indigo-500' : 'bg-indigo-100 border-indigo-300'} border-2`
                      : `${isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-white hover:bg-gray-100 border-gray-200'} border`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <FileText size={20} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {pdf.original_name || pdf.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatFileSize(pdf.file_size)}
                        </p>
                        {pdf.status && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            pdf.status === 'completed' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {pdf.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Generate Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleGenerateQuiz}
          disabled={isGenerating || !selectedPDF}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            isGenerating || !selectedPDF
              ? `${isDark ? 'bg-slate-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Generating Mixed Quiz...</span>
            </>
          ) : (
            <>
              <Sparkles size={20} />
              <span>Generate Mixed Quiz from Selected PDF</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-start gap-3 ${
            isDark ? 'bg-red-900/20 border border-red-500/30' : 'bg-red-50 border border-red-200'
          }`}
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className={`font-medium ${isDark ? 'text-red-400' : 'text-red-900'}`}>
              Generation Error
            </p>
            <p className={`text-sm mt-1 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
              {error}
            </p>
          </div>
        </motion.div>
      )}

      {/* Generated Questions Section */}
      {generatedQuestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Generated Questions ({generatedQuestions.length})
            </h2>
            <div className="flex items-center gap-2">
              {/* Interactive Quiz Mode Toggle */}
              <button
                onClick={() => setShowInteractiveQuiz(!showInteractiveQuiz)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  showInteractiveQuiz
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : isDark 
                      ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                <Play size={16} />
                <span>{showInteractiveQuiz ? 'View List' : 'Play Quiz'}</span>
              </button>
              
              {/* Priority 30: Save Quiz Button */}
              <button
                onClick={handleSaveQuiz}
                disabled={isSaving || generatedQuestions.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isSaving || generatedQuestions.length === 0
                    ? `${isDark ? 'bg-slate-700 text-gray-400 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Quiz</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadQuiz}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isDark 
                    ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            </div>
          </div>

          {/* Interactive Quiz Mode */}
          {showInteractiveQuiz ? (
            <InteractiveMixedQuiz 
              questions={generatedQuestions} 
              isDark={isDark}
            />
          ) : (
            /* List View Mode */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-4"
            >
              {Array.isArray(generatedQuestions) && generatedQuestions.map((item, index) => (
            <motion.div
              key={item.id || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-xl p-5 backdrop-blur-md ${
                isDark 
                  ? 'bg-slate-800/40 border border-white/10' 
                  : 'bg-white/40 border border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      isDark ? 'bg-indigo-600/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      Q{index + 1}
                    </span>
                    <CheckCircle size={16} className="text-emerald-400" />
                    {/* Priority 31: Difficulty Badge */}
                    {getDifficultyBadge(item.difficulty)}
                    {/* Question Type Badge */}
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      item.question_type === 'mcq'
                        ? `${isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`
                        : `${isDark ? 'bg-purple-600/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`
                    }`}>
                      {item.question_type === 'mcq' ? 'MCQ' : 'True/False'}
                    </span>
                  </div>
                  <p className={`text-lg font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.question_text || item.question || 'No question text available'}
                  </p>
                  
                  {/* Options for MCQ */}
                  {(item.type === 'mcq' || item.question_type === 'mcq' || item.question_type === 'multiple_choice' || (!item.type && !item.question_type && Array.isArray(item.options))) && Array.isArray(item.options) && item.options.length > 0 && (
                    <div className={`p-4 rounded-xl mb-3 border ${
                      isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2.5 text-gray-400">
                        Options
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {item.options.map((option, optIndex) => {
                          const optLetter = String.fromCharCode(65 + optIndex);
                          const ca = String(item.correct_answer || '').trim();
                          const optText = String(option || '').trim();
                          const isCorrect = 
                            (ca && optText && ca.toLowerCase() === optText.toLowerCase()) ||
                            (ca && ca.toUpperCase() === optLetter) ||
                            (ca && ca.toUpperCase().startsWith(`OPTION ${optLetter}`)) ||
                            (ca && ca.toUpperCase().startsWith(`${optLetter}.`));

                          return (
                            <div
                              key={optIndex}
                              className={`flex items-start gap-2.5 p-3 rounded-lg border text-sm transition-all ${
                                isCorrect
                                  ? isDark
                                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-medium shadow-sm shadow-emerald-950/20'
                                    : 'bg-emerald-50 border-emerald-400 text-emerald-900 font-medium shadow-sm'
                                  : isDark
                                    ? 'bg-slate-800/40 border-slate-700/40 text-gray-300'
                                    : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <span className={`w-6 h-6 flex items-center justify-center rounded-md font-mono text-xs font-bold shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {optLetter}
                              </span>
                              <span className="flex-1 break-words leading-relaxed">{option || 'No option text'}</span>
                              {isCorrect && (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  <CheckCircle size={13} className="text-emerald-400" /> Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explicit Correct Answer Banner */}
                      {item.correct_answer && (
                        <div className={`mt-3 pt-2.5 border-t flex flex-wrap items-center gap-2 text-sm ${
                          isDark ? 'border-slate-800' : 'border-gray-200'
                        }`}>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Correct Answer:</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                            <CheckCircle size={14} className="text-emerald-400" />
                            {item.correct_answer}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Options for True/False */}
                  {(item.type === 'true_false' || item.question_type === 'true_false' || item.question_type === 'true/false') && (
                    <div className={`p-4 rounded-xl mb-3 border ${
                      isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2.5 text-gray-400">
                        Options
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {['True', 'False'].map((option) => {
                          const isCorrect = String(option).toLowerCase() === String(item.correct_answer || '').toLowerCase();
                          return (
                            <div
                              key={option}
                              className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${
                                isCorrect
                                  ? isDark
                                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-medium'
                                    : 'bg-emerald-50 border-emerald-400 text-emerald-900 font-medium'
                                  : isDark
                                    ? 'bg-slate-800/40 border-slate-700/40 text-gray-300'
                                    : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-bold ${
                                  isCorrect ? 'bg-emerald-500 text-white' : isDark ? 'bg-slate-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {option === 'True' ? '✓' : '✗'}
                                </span>
                                <span className="font-medium">{option}</span>
                              </div>
                              {isCorrect && (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  <CheckCircle size={13} className="text-emerald-400" /> Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explicit Correct Answer Banner */}
                      {item.correct_answer && (
                        <div className={`mt-3 pt-2.5 border-t flex flex-wrap items-center gap-2 text-sm ${
                          isDark ? 'border-slate-800' : 'border-gray-200'
                        }`}>
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Correct Answer:</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                            <CheckCircle size={14} className="text-emerald-400" />
                            {String(item.correct_answer)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  {item.explanation && (
                    <div className={`text-sm p-3 rounded-lg mb-3 ${
                      isDark ? 'bg-slate-900/50 text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <span className="font-medium">Explanation:</span> {item.explanation}
                    </div>
                  )}

                  {/* Relevance Score */}
                  {item.relevance_score && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Relevance Score:
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full" 
                          style={{ width: `${item.relevance_score * 100}%` }}
                        />
                      </div>
                      <span className={`font-medium ${item.relevance_score > 0.8 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {Math.round(item.relevance_score * 100)}%
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleCopyQuestion(item.question || '')}
                  className={`p-2 rounded-lg transition-all ${
                    isDark 
                      ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                  }`}
                >
                  <Copy size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AIQuizGenerationPage;