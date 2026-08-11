import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Lightbulb, BookOpen, Target, TrendingUp,
  Sparkles, CheckCircle, AlertCircle, ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils/helpers.js';

/**
 * @component AIFeedback
 * @description Module 06: AI-powered feedback component displaying personalized insights
 */
const AIFeedback = ({ aiFeedback, topicAccuracy, performanceMetrics }) => {
  if (!aiFeedback) {
    return null;
  }

  const getConfidenceColor = (confidence) => {
    const colors = {
      high: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      low: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return colors[confidence] || colors.medium;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-6"
    >
      {/* AI Coach Feedback Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
          <Brain size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-dark-200">AI Coach Feedback</h3>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getConfidenceColor(aiFeedback.confidenceLevel)}`}>
              {aiFeedback.confidenceLevel?.toUpperCase()} Confidence
            </span>
            {aiFeedback.feedbackGeneratedAt && (
              <span className="text-xs text-dark-500">
                Generated {new Date(aiFeedback.feedbackGeneratedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-dark-200 leading-relaxed">{aiFeedback.summary}</p>
          </div>
        </div>
      </div>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strengths */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-emerald-400" />
            <h4 className="font-semibold text-emerald-400">Strengths</h4>
          </div>
          <ul className="space-y-2">
            {aiFeedback.strengths?.map((strength, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-dark-300">
                <ChevronRight size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={18} className="text-yellow-400" />
            <h4 className="font-semibold text-yellow-400">Areas for Improvement</h4>
          </div>
          <ul className="space-y-2">
            {aiFeedback.weaknesses?.map((weakness, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-dark-300">
                <ChevronRight size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Suggested Improvements */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={20} className="text-blue-400" />
          <h4 className="font-semibold text-blue-400">Suggested Improvements</h4>
        </div>
        <ul className="space-y-3">
          {aiFeedback.suggestedImprovements?.map((improvement, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-dark-300">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                <span className="text-xs font-semibold text-blue-400">{index + 1}</span>
              </div>
              <span>{improvement}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended Topics to Review */}
      {aiFeedback.recommendedTopicsToReview && aiFeedback.recommendedTopicsToReview.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={20} className="text-purple-400" />
            <h4 className="font-semibold text-purple-400">Recommended Topics to Review</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiFeedback.recommendedTopicsToReview.map((topic, index) => (
              <span
                key={index}
                className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-medium border border-purple-500/30"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Study Strategies */}
      {aiFeedback.studyStrategies && aiFeedback.studyStrategies.length > 0 && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={20} className="text-indigo-400" />
            <h4 className="font-semibold text-indigo-400">Study Strategies</h4>
          </div>
          <ul className="space-y-2">
            {aiFeedback.studyStrategies.map((strategy, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-dark-300">
                <TrendingUp size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>{strategy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Encouragement */}
      {aiFeedback.encouragement && (
        <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-300 font-medium italic">{aiFeedback.encouragement}</p>
          </div>
        </div>
      )}

      {/* Topic Accuracy Breakdown */}
      {topicAccuracy && Object.keys(topicAccuracy).length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={20} className="text-slate-400" />
            <h4 className="font-semibold text-slate-300">Topic Accuracy Breakdown</h4>
          </div>
          <div className="space-y-3">
            {Object.entries(topicAccuracy).map(([topic, accuracy]) => (
              <div key={topic} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-dark-300">{topic}</span>
                  <span className={cn(
                    'font-medium',
                    accuracy >= 80 ? 'text-emerald-400' : accuracy >= 60 ? 'text-blue-400' : 'text-yellow-400'
                  )}>
                    {accuracy}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      accuracy >= 80 ? 'bg-emerald-500' : accuracy >= 60 ? 'bg-blue-500' : 'bg-yellow-500'
                    )}
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {performanceMetrics && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-slate-400" />
            <h4 className="font-semibold text-slate-300">Performance Metrics</h4>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-dark-50">
                {Math.round(performanceMetrics.averageTimePerQuestion / 60)}m
              </p>
              <p className="text-xs text-dark-400 mt-1">Avg Time/Question</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-dark-50">
                {Math.round(performanceMetrics.fastestQuestionTime)}s
              </p>
              <p className="text-xs text-dark-400 mt-1">Fastest</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-dark-50">
                {Math.round(performanceMetrics.slowestQuestionTime)}s
              </p>
              <p className="text-xs text-dark-400 mt-1">Slowest</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AIFeedback;