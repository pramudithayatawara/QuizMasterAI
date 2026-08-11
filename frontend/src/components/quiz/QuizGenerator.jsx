import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Loader2, CheckCircle, AlertCircle, Sparkles, TrendingUp, Zap } from 'lucide-react';
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
  
  // Module 05: Adaptive Mode State
  const [adaptiveMode, setAdaptiveMode] = useState(false);
  const [adaptiveStatus, setAdaptiveStatus] = useState(null);
  const [isFetchingRecommendation, setIsFetchingRecommendation] = useState(false);
  
  // Module 05: Fetch adaptive recommendation when adaptive mode is enabled
  useEffect(() => {
    if (adaptiveMode) {
      fetchAdaptiveRecommendation();
    }
  }, [adaptiveMode]);
  
  const fetchAdaptiveRecommendation = async () => {
    setIsFetchingRecommendation(true);
    try {
      const response = await quizAPI.getRecommendedDifficulty();
      const recommendation = response.data.data;
      
      setAdaptiveStatus({
        currentDifficulty: recommendation.currentDifficulty,
        recommendedDifficulty: recommendation.recommendedDifficulty,
        shouldAdjust: recommendation.shouldAdjust,
        adjustmentReason: recommendation.adjustmentReason,
        metrics: recommendation.metrics
      });
    } catch (error) {
      console.error('Failed to fetch adaptive recommendation:', error);
      toast.error('Failed to load adaptive recommendations');
    } finally {
      setIsFetchingRecommendation(false);
    }
  };

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
      
      // Module 05: Use adaptive difficulty if enabled, otherwise default to medium
      const difficulty = adaptiveMode && adaptiveStatus 
        ? adaptiveStatus.recommendedDifficulty 
        : 'medium';
      
      const response = await quizAPI.generateQuiz({ 
        pdfId, 
        questionCount: 10,
        difficulty
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
    <div className="space-y-4">
      {/* Module 05: Adaptive Mode Toggle */}
      <div className={`${isDark ? 'bg-slate-800/40 border-white/10' : 'bg-white/40 border-light-300'} backdrop-blur-md rounded-2xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-purple-400" />
            <span className={`font-medium ${isDark ? 'text-white' : 'text-light-900'}`}>
              Adaptive Quiz Engine
            </span>
          </div>
          <button
            onClick={() => setAdaptiveMode(!adaptiveMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              adaptiveMode ? 'bg-purple-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                adaptiveMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-light-600'}`}>
          {adaptiveMode 
            ? 'AI will recommend difficulty based on your performance' 
            : 'Manual difficulty selection'}
        </p>
      </div>

      {/* Module 05: Adaptive Status Banner */}
      {adaptiveMode && adaptiveStatus && (
        <div className={`${isDark ? 'bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border-purple-500/30' : 'bg-gradient-to-r from-purple-100 to-indigo-100 border-purple-300'} backdrop-blur-md rounded-2xl p-4 border`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <TrendingUp size={20} className="text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-light-900'}`}>
                  Current Adaptive Status
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  adaptiveStatus.currentDifficulty === 'easy' 
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : adaptiveStatus.currentDifficulty === 'medium'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {adaptiveStatus.currentDifficulty.charAt(0).toUpperCase() + adaptiveStatus.currentDifficulty.slice(1)}
                </span>
              </div>
              
              {/* Performance Streak */}
              {adaptiveStatus.metrics && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-yellow-400" />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-light-700'}`}>
                      {adaptiveStatus.metrics.consecutiveHighScores > 0 
                        ? `${adaptiveStatus.metrics.consecutiveHighScores} High Score${adaptiveStatus.metrics.consecutiveHighScores > 1 ? 's' : ''} in a row - ${3 - adaptiveStatus.metrics.consecutiveHighScores} more for HARD mode!`
                        : adaptiveStatus.metrics.consecutiveLowScores > 0
                        ? `${adaptiveStatus.metrics.consecutiveLowScores} Low Score${adaptiveStatus.metrics.consecutiveLowScores > 1 ? 's' : ''} - ${3 - adaptiveStatus.metrics.consecutiveLowScores} more for EASY mode`
                        : 'Build your streak to unlock new difficulty levels!'
                      }
                    </span>
                  </div>
                  
                  {/* Recommended Difficulty */}
                  {adaptiveStatus.shouldAdjust && (
                    <div className={`flex items-center gap-2 p-2 rounded-lg ${
                      adaptiveStatus.recommendedDifficulty === 'hard'
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : adaptiveStatus.recommendedDifficulty === 'easy'
                        ? 'bg-yellow-500/10 border border-yellow-500/20'
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}>
                      <span className={`text-xs font-medium ${
                        adaptiveStatus.recommendedDifficulty === 'hard'
                          ? 'text-emerald-400'
                          : adaptiveStatus.recommendedDifficulty === 'easy'
                          ? 'text-yellow-400'
                          : 'text-blue-400'
                      }`}>
                        Recommended: {adaptiveStatus.recommendedDifficulty.charAt(0).toUpperCase() + adaptiveStatus.recommendedDifficulty.slice(1)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <motion.button
        onClick={handleGenerateQuiz}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={isGenerating || (adaptiveMode && isFetchingRecommendation)}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Brain size={20} />
        <span>{isGenerating ? 'Generating...' : 'Generate Quiz'}</span>
      </motion.button>
    </div>
  );
};

export default QuizGenerator;