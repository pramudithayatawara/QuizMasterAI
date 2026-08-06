import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Brain } from 'lucide-react';
import { ROUTES } from '../constants/routes.js';

/**
 * @page NotFoundPage
 * @description 404 page with animated illustration.
 */
const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        className="text-center max-w-md space-y-6"
      >
        {/* Animated 404 */}
        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className="text-8xl font-black gradient-text"
        >
          404
        </motion.div>

        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-dark-50">
            Page Not Found
          </h2>
          <p className="text-dark-400">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link to={ROUTES.DASHBOARD}>
            <button className="btn-primary">
              <Home size={18} />
              Go Home
            </button>
          </Link>
          <Link to={ROUTES.QUIZ_LIST}>
            <button className="btn-secondary">
              <Brain size={18} />
              Browse Quizzes
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;