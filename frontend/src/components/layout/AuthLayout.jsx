import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

/**
 * @component AuthLayout
 * @description Layout wrapper for authentication pages.
 */
const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* ─── Left Panel (decorative) ───────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden
                      bg-gradient-to-br from-dark-900 via-primary-950 to-dark-950
                      flex-col items-center justify-center p-12">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64
                          bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-48 h-48
                          bg-secondary-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md text-center space-y-8">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y:  0  }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
            <div className="w-14 h-14 bg-primary-600 rounded-2xl
                            flex items-center justify-center shadow-glow">
              <Brain size={28} className="text-white" />
            </div>
            <span className="text-3xl font-bold gradient-text">QuizAI</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            <h1 className="text-4xl font-bold text-dark-50 leading-tight">
              Learn Smarter with{' '}
              <span className="gradient-text">AI-Powered</span>{' '}
              Adaptive Quizzes
            </h1>
            <p className="text-dark-400 text-lg leading-relaxed">
              Upload your PDFs, generate intelligent quizzes using RAG technology,
              and compete with others in real-time battle mode.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {[
              '🧠 AI Question Generation',
              '📄 PDF Processing',
              '⚔️ Battle Mode',
              '🏆 Leaderboard',
              '🎯 Adaptive Learning',
            ].map((feature) => (
              <span
                key={feature}
                className="px-4 py-2 bg-dark-800/60 border border-dark-700
                           rounded-full text-sm text-dark-300"
              >
                {feature}
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── Right Panel (auth forms) ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x:  0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-primary-600 rounded-xl
                            flex items-center justify-center">
              <Brain size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">QuizAI</span>
          </div>

          {/* Auth Form Content */}
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
};

export default AuthLayout;