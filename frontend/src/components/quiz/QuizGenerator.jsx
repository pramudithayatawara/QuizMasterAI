import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme.js';
import { quizAPI } from '../../api/quiz.api.js';
import toast from 'react-hot-toast';

/**
 * @component QuizGenerator
 * @description Generate quiz from PDF with loading states and progress feedback.
 */
const QuizGenerator = ({ pdfId, onQuizGenerated, pdfName }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    setProgress(0);
    setStage('Initializing...');
    
    try {
      // Simulate progress stages
      const progressStages = [
        { progress: 20, stage: 'Retrieving relevant chunks...' },
        { progress: 40, stage: 'Assembling context...' },
        { progress: 60, stage: 'Generating questions with AI...' },
        { progress: 80, stage: 'Validating and processing...' },
        { progress: 100, stage: 'Finalizing quiz...' }
      ];

      // Show progress stages
      let stageIndex = 0;
      const progressInterval = setInterval(() => {
        if (stageIndex < progressStages.length) {
          setProgress(progressStages[stageIndex].progress);
          setStage(progressStages[stageIndex].stage);
          stageIndex++;
        }
      }, 1500);

      toast.loading('Generating quiz... This may take 10-15 seconds.', { id: 'quiz-generation' });
      
      const response = await quizAPI.generateQuiz({ 
        pdfId, 
        questionCount: 10,
        difficulty: 'medium'
      });
      
      clearInterval(progressInterval);
      toast.dismiss('quiz-generation');
      toast.success('Quiz generated successfully!');
      
      onQuizGenerated(response.data.data.quiz);
    } catch (error) {
      toast.dismiss('quiz-generation');
      toast.error(error.response?.data?.message || 'Failed to generate quiz');
    } finally {
      setIsGenerating(false);
      setProgress(0);
      setStage('');
    }
  };

  if (isGenerating) {
    return (
      <div className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-6`}>
        <div className="flex items-center gap-4 mb-4">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <div>
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-light-900'}`}>
              Generating Quiz
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
              {stage}
            </p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className={isDark ? 'text-slate-400' : 'text-light-600'}>
              Processing PDF: {pdfName?.substring(0, 30)}...
            </span>
            <span className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>
              {progress}%
            </span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mt-4 space-y-2">
          {[
            { label: 'Retrieving chunks', completed: progress >= 20 },
            { label: 'Assembling context', completed: progress >= 40 },
            { label: 'AI generation', completed: progress >= 60 },
            { label: 'Validation', completed: progress >= 80 },
            { label: 'Finalization', completed: progress >= 100 },
          ].map((step, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {step.completed ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
              )}
              <span className={step.completed 
                ? `${isDark ? 'text-emerald-400' : 'text-emerald-600'}` 
                : `${isDark ? 'text-slate-500' : 'text-light-500'}`
              }>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.button
      onClick={handleGenerateQuiz}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl"
    >
      <Brain size={20} />
      <span>Generate Quiz</span>
    </motion.button>
  );
};

export default QuizGenerator;