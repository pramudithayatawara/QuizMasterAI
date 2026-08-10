import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, Play, Search, Plus, Clock,
  FileText, TrendingUp, Filter, ArrowLeft
} from 'lucide-react';
import { quizAPI } from '../../api/quiz.api.js';
import { ROUTES } from '../../constants/routes.js';
import { DIFFICULTY_CONFIG } from '../../constants/difficulty.js';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import { formatRelativeTime } from '../../utils/formatters.js';
import { cn, getDifficultyClass } from '../../utils/helpers.js';
import QuizView from '../../components/quiz/QuizView.jsx';
import toast from 'react-hot-toast';

/**
 * @page QuizListPage
 * @description Browse and filter available quizzes.
 */
const QuizListPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [selectedQuizId, setSelectedQuizId] = useState(null);
  const [selectedPdfId, setSelectedPdfId] = useState(null);

  useEffect(() => {
    const fetchQuizzes = async () => {
      setIsLoading(true);
      try {
        const response = await quizAPI.getAll({
          search: searchQuery,
          difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
        });
        setQuizzes(response.data.data.quizzes || []);
      } catch (error) {
        toast.error('Failed to load quizzes.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuizzes();
  }, [searchQuery, difficultyFilter]);

  const filteredQuizzes = quizzes.filter((quiz) =>
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuizSelect = (quizId, pdfId) => {
    setSelectedQuizId(quizId);
    setSelectedPdfId(pdfId);
  };

  const handleBackToList = () => {
    setSelectedQuizId(null);
    setSelectedPdfId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-dark-50">Quizzes</h1>
          <p className="text-dark-400 mt-1">
            Test your knowledge with AI-generated quizzes
          </p>
        </div>
        <Link to={ROUTES.PDF_LIST}>
          <Button variant="primary" leftIcon={<Plus size={18} />}>
            Create Quiz
          </Button>
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search quizzes..."
              leftIcon={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
            />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="input-base sm:w-40"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </Card>
      </motion.div>

      {/* Quiz Grid or Quiz View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {selectedQuizId ? (
          <div>
            <button
              onClick={handleBackToList}
              className="mb-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300"
            >
              <ArrowLeft size={20} />
              Back to Quizzes
            </button>
            <QuizView
              quizId={selectedQuizId}
              pdfId={selectedPdfId}
              onClose={handleBackToList}
            />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No quizzes found"
            description={searchQuery
              ? 'Try adjusting your search or filters.'
              : 'Upload a PDF to generate your first quiz.'
            }
            action={
              !searchQuery && (
                <Link to={ROUTES.PDF_LIST}>
                  <Button variant="primary" leftIcon={<FileText size={18} />}>
                    Upload PDF
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.map((quiz, index) => (
              <motion.div
                key={quiz._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card hover padding="md" className="h-full flex flex-col group">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl
                                    flex items-center justify-center flex-shrink-0
                                    group-hover:scale-110 transition-transform">
                      <Brain size={24} className="text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-dark-50 truncate mb-1">
                        {quiz.title}
                      </h3>
                      <span className={cn(
                        'difficulty-pill text-xs',
                        getDifficultyClass(quiz.difficulty)
                      )}>
                        {DIFFICULTY_CONFIG[quiz.difficulty]?.label || quiz.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="space-y-2 mb-4 text-sm text-dark-400">
                    <div className="flex items-center justify-between">
                      <span>Questions:</span>
                      <span className="font-medium text-dark-300">
                        {quiz.totalQuestions}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Time Limit:</span>
                      <span className="font-medium text-dark-300">
                        {quiz.timeLimit} min
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Created:</span>
                      <span className="font-medium text-dark-300">
                        {formatRelativeTime(quiz.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Play size={16} />}
                      onClick={() => handleQuizSelect(quiz._id, quiz.pdfId)}
                    >
                      View Quiz
                    </Button>
                    <Link
                      to={ROUTES.QUIZ_PLAY.replace(':id', quiz._id)}
                      className="flex-1"
                    >
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        leftIcon={<TrendingUp size={16} />}
                      >
                        Play
                      </Button>
                    </Link>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default QuizListPage;