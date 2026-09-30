import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, Trophy, RotateCcw, Home } from 'lucide-react';
import { cn } from '../../utils/helpers.js';

/**
 * @component InteractiveMixedQuiz
 * @description Interactive quiz component that handles both MCQ and True/False questions with instant feedback
 */
const InteractiveMixedQuiz = ({ questions, isDark }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState({});
  const [showResults, setShowResults] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className={`p-6 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No questions available</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const userAnswer = userAnswers[currentQuestionIndex];
  const feedback = showFeedback[currentQuestionIndex];
  
  // Debug logging to inspect backend response structure
  console.log('Current question data:', currentQuestion);
  console.log('Question type:', currentQuestion.type || currentQuestion.question_type);
  console.log('Available keys:', Object.keys(currentQuestion));
  console.log('Options data:', currentQuestion.options);
  
  // Determine question type
  const questionType = currentQuestion.type || currentQuestion.question_type;
  const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';
  const isTrueFalse = questionType === 'true_false' || questionType === 'true/false';
  
  // Get question text
  const questionText = currentQuestion.question_text || currentQuestion.question || 'No question text available';
  
  // Get options - handle multiple possible backend keys safely
  // Backend sends options as array of strings, but handle object format too
  const getOptions = () => {
    if (isTrueFalse) {
      return ['True', 'False'];
    }
    
    if (!isMCQ) {
      return [];
    }
    
    // Try different possible keys that backend might send
    const possibleKeys = ['options', 'choices', 'answers', 'option_list', 'option_texts'];
    
    for (const key of possibleKeys) {
      if (currentQuestion[key]) {
        const opts = currentQuestion[key];
        
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
    if (currentQuestion.options) {
      const opts = currentQuestion.options;
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
  };
  
  const options = getOptions();

  const handleAnswerSelect = (answer) => {
    const isCorrect = answer === currentQuestion.correct_answer;
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: answer
    }));
    
    setShowFeedback(prev => ({
      ...prev,
      [currentQuestionIndex]: {
        isCorrect,
        selectedAnswer: answer,
        correctAnswer: currentQuestion.correct_answer,
        explanation: currentQuestion.explanation
      }
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Show results when reaching the last question
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowFeedback({});
    setShowResults(false);
  };

  const getOptionStyle = (option) => {
    if (!feedback) {
      return cn(
        'quiz-option w-full',
        userAnswer === option && 'selected'
      );
    }

    const isSelected = feedback.selectedAnswer === option;
    const isCorrect = option === feedback.correctAnswer;

    if (isSelected && isCorrect) {
      return cn(
        'quiz-option w-full',
        'correct'
      );
    } else if (isSelected && !isCorrect) {
      return cn(
        'quiz-option w-full',
        'incorrect'
      );
    } else if (isCorrect) {
      return cn(
        'quiz-option w-full',
        'correct-reveal'
      );
    }

    return cn(
      'quiz-option w-full',
      'disabled'
    );
  };

  const calculateScore = () => {
    const correctCount = Object.keys(showFeedback).filter(
      key => showFeedback[key].isCorrect
    ).length;
    return {
      correct: correctCount,
      total: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100)
    };
  };

  const score = calculateScore();
  const answeredCount = Object.keys(userAnswers).length;

  // Results View
  if (showResults) {
    return (
      <div className="space-y-6">
        {/* Results Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-8 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}
        >
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Trophy size={64} className={score.percentage >= 70 ? 'text-yellow-500' : 'text-gray-400'} />
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Quiz Complete!
            </h2>
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {score.percentage >= 70 ? 'Great job!' : 'Keep practicing!'}
            </p>
          </div>

          {/* Score Summary */}
          <div className={`grid grid-cols-3 gap-4 mb-6`}>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
              <p className={`text-3xl font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {score.correct}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Correct</p>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
              <p className={`text-3xl font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {score.total - score.correct}
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Incorrect</p>
            </div>
            <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
              <p className={`text-3xl font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {score.percentage}%
              </p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Score</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRestart}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                isDark 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <RotateCcw size={20} />
              <span>Try Again</span>
            </button>
          </div>
        </motion.div>

        {/* Question-by-Question Review */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Question Review
          </h3>
          
          {questions.map((question, index) => {
            const questionFeedback = showFeedback[index];
            const questionUserAnswer = userAnswers[index];
            const questionType = question.type || question.question_type;
            const isMCQ = questionType === 'mcq' || questionType === 'multiple_choice';
            const isTrueFalse = questionType === 'true_false' || questionType === 'true/false';
            const questionText = question.question_text || question.question || 'No question text available';
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-6 rounded-lg ${
                  questionFeedback?.isCorrect
                    ? isDark ? 'bg-green-900/20 border border-green-700' : 'bg-green-50 border border-green-200'
                    : isDark ? 'bg-red-900/20 border border-red-700' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    questionFeedback?.isCorrect
                      ? 'bg-green-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}>
                    {questionFeedback?.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        isMCQ
                          ? `${isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`
                          : `${isDark ? 'bg-purple-600/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`
                      }`}>
                        {isMCQ ? 'MCQ' : 'True/False'}
                      </span>
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Question {index + 1}
                      </span>
                    </div>
                    
                    <h4 className={`text-lg font-medium mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {questionText}
                    </h4>
                    
                    <div className={`space-y-2 mb-3`}>
                      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className="font-medium">Your answer:</span>
                        <span className={
                          questionFeedback?.isCorrect
                            ? 'text-green-500 font-medium'
                            : 'text-red-500 font-medium'
                        }>
                          {questionUserAnswer || 'Not answered'}
                        </span>
                      </div>
                      
                      {!questionFeedback?.isCorrect && (
                        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="font-medium">Correct answer:</span>
                          <span className="text-green-500 font-medium">
                            {question.correct_answer}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {questionFeedback?.explanation && (
                      <div className={`p-3 rounded-lg ${
                        isDark ? 'bg-slate-800/50' : 'bg-gray-100'
                      }`}>
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="font-medium">Explanation:</span> {questionFeedback.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    );
  }

  // Quiz View
  return (
    <div className="space-y-6">
      {/* Quiz Header */}
      <div className={`p-4 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-100'}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Interactive Quiz
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Answered: {answeredCount} / {questions.length}
            </p>
            <p className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
              Score: {score.correct} / {score.total} ({score.percentage}%)
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <motion.div
        key={currentQuestionIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className={`p-6 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}
      >
        {/* Question Type Badge */}
        <div className="mb-4">
          <span className={`px-3 py-1 rounded-md text-xs font-medium ${
            isMCQ
              ? `${isDark ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`
              : `${isDark ? 'bg-purple-600/20 text-purple-400' : 'bg-purple-100 text-purple-700'}`
          }`}>
            {isMCQ ? 'Multiple Choice' : 'True/False'}
          </span>
        </div>

        {/* Question Text */}
        <h4 className={`text-xl font-medium mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {questionText}
        </h4>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {options.map((option, index) => {
            const optionLabel = isMCQ ? ['A', 'B', 'C', 'D'][index] : (option === 'True' ? '✓' : '✗');
            
            return (
              <button
                key={index}
                onClick={() => !feedback && handleAnswerSelect(option)}
                disabled={!!feedback}
                className={getOptionStyle(option)}
              >
                <span className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                  'font-bold text-base transition-colors',
                  'border-2',
                  isDark ? 'border-slate-600' : 'border-gray-300',
                  (userAnswer === option && !feedback) && (isDark ? 'bg-blue-600 border-blue-400' : 'bg-blue-100 border-blue-400'),
                  feedback && (option === feedback.correctAnswer) && (isDark ? 'bg-green-600 border-green-400' : 'bg-green-100 border-green-400'),
                  feedback && (option === feedback.selectedAnswer && option !== feedback.correctAnswer) && (isDark ? 'bg-red-600 border-red-400' : 'bg-red-100 border-red-400'),
                  feedback && (option !== feedback.selectedAnswer && option !== feedback.correctAnswer) && (isDark ? 'bg-slate-700 border-slate-600 opacity-50' : 'bg-gray-100 border-gray-300 opacity-50')
                )}>
                  {optionLabel}
                </span>
                <span className={`flex-1 text-left ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {option}
                </span>
                {feedback && option === feedback.correctAnswer && (
                  <CheckCircle size={20} className="text-green-500" />
                )}
                {feedback && option === feedback.selectedAnswer && option !== feedback.correctAnswer && (
                  <XCircle size={20} className="text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback Section */}
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg mb-6 ${
              feedback.isCorrect
                ? isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
                : isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {feedback.isCorrect ? (
                <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-1" />
              ) : (
                <XCircle size={24} className="text-red-500 flex-shrink-0 mt-1" />
              )}
              <div className="flex-1">
                <h5 className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {feedback.isCorrect ? 'Correct!' : 'Incorrect'}
                </h5>
                {feedback.explanation && (
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-medium">Explanation:</span> {feedback.explanation}
                  </p>
                )}
                {!feedback.isCorrect && (
                  <p className={`text-sm mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="font-medium">Correct answer:</span> {feedback.correctAnswer}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentQuestionIndex === 0
                ? isDark ? 'bg-slate-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isDark ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            Previous
          </button>

          <button
            onClick={handleNext}
            disabled={!feedback}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !feedback
                ? isDark ? 'bg-slate-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isDark ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {currentQuestionIndex === questions.length - 1 ? 'See Results' : 'Next'}
          </button>
        </div>
      </motion.div>

      {/* Question Navigation Dots */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {questions.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentQuestionIndex(index)}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              currentQuestionIndex === index
                ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                : userAnswers[index] !== undefined
                  ? isDark ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                  : isDark ? 'bg-slate-700 text-gray-400 hover:bg-slate-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default InteractiveMixedQuiz;