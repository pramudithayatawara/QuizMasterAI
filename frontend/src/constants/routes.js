/**
 * @constants routes
 * @description Centralized route path constants.
 */
export const ROUTES = {
  // Auth
  LOGIN:           '/login',
  REGISTER:        '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD:  '/reset-password/:token',

  // App
  DASHBOARD:       '/dashboard',
  PROFILE:         '/profile',
  SETTINGS:        '/settings',

  // PDF
  PDF_MANAGER:     '/pdfs',
  PDF_LIST:        '/pdfs',
  PDF_DETAIL:      '/pdfs/:id',

  // Quiz
  QUIZ_LIST:       '/quizzes',
  QUIZ_CREATE:     '/quizzes/create',
  QUIZ_PLAY:       '/quizzes/:id/play',
  QUIZ_RESULT:     '/quizzes/:id/result',
  QUIZ_HISTORY:    '/quizzes/history',
  QUIZ_AI_GENERATE: '/quizzes/ai-generate',

  // Battle
  BATTLE_LOBBY:    '/battle',
  BATTLE_PLAY:     '/battle/:id/play',

  // Gamification
  GAMIFICATION:    '/achievements',

  // Admin
  ADMIN:           '/admin',
  ADMIN_USERS:     '/admin/users',
  ADMIN_BATTLES:   '/admin/battles',
  ADMIN_QUIZZES:   '/admin/quizzes',
  ADMIN_PDFS:      '/admin/pdfs',

  // Not Found
  NOT_FOUND:       '*',
};