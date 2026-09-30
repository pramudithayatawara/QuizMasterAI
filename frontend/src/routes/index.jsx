import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.js';
import ProtectedRoute from './ProtectedRoute.jsx';
import AdminRoute from './AdminRoute.jsx';
import GuestRoute from './GuestRoute.jsx';
import MainLayout from '../components/layout/MainLayout.jsx';
import AdminLayout from '../components/layout/AdminLayout.jsx';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import Spinner from '../components/common/Spinner.jsx';

// ─── Lazy Loaded Pages ────────────────────────────────────────────────────────
const LoginPage           = lazy(() => import('../pages/auth/LoginPage.jsx'));
const RegisterPage        = lazy(() => import('../pages/auth/RegisterPage.jsx'));
const ForgotPasswordPage  = lazy(() => import('../pages/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage   = lazy(() => import('../pages/auth/ResetPasswordPage.jsx'));

const DashboardPage       = lazy(() => import('../pages/dashboard/DashboardPage.jsx'));
const ProfilePage         = lazy(() => import('../pages/profile/ProfilePage.jsx'));
const SettingsPage        = lazy(() => import('../pages/settings/SettingsPage.jsx'));

const PDFManagerPage      = lazy(() => import('../pages/pdf/PdfManagerPage.jsx'));
const PDFDetailPage        = lazy(() => import('../pages/pdf/PDFDetailPage.jsx'));

const QuizListPage         = lazy(() => import('../pages/quiz/QuizListPage.jsx'));
const CreateQuizPage       = lazy(() => import('../pages/quiz/CreateQuizPage.jsx'));
const QuizPlayPage         = lazy(() => import('../pages/quiz/QuizPlayPage.jsx'));
const QuizResultPage       = lazy(() => import('../pages/quiz/QuizResultPage.jsx'));
const QuizHistoryPage      = lazy(() => import('../pages/quiz/QuizHistoryPage.jsx'));
const AIQuizGenerationPage = lazy(() => import('../pages/quiz/AIQuizGenerationPage.jsx'));

const BattleLobbyPage      = lazy(() => import('../pages/battle/BattleLobbyPage.jsx'));
const BattlePlayPage       = lazy(() => import('../pages/battle/BattlePlayPage.jsx'));

const GamificationPage     = lazy(() => import('../pages/gamification/GamificationPage.jsx'));

const AdminDashboardPage   = lazy(() => import('../pages/admin/AdminDashboardPage.jsx'));
const AdminUsersPage       = lazy(() => import('../pages/admin/AdminUsersPage.jsx'));
const AdminBattlesPage     = lazy(() => import('../pages/admin/AdminBattlesPage.jsx'));
const AdminQuizzesPage     = lazy(() => import('../pages/admin/AdminQuizzesPage.jsx'));
const AdminPDFsPage        = lazy(() => import('../pages/admin/AdminPDFsPage.jsx'));

const NotFoundPage         = lazy(() => import('../pages/NotFoundPage.jsx'));

// ─── Suspense Fallback ────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-dark-950">
    <Spinner size="lg" />
  </div>
);

/**
 * @component AppRoutes
 * @description Centralized route configuration.
 */
const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* ─── Root Redirect ─────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

      {/* ─── Guest Routes (unauthenticated only) ───────────────────────── */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN}           element={<LoginPage />} />
          <Route path={ROUTES.REGISTER}        element={<RegisterPage />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.RESET_PASSWORD}  element={<ResetPasswordPage />} />
        </Route>
      </Route>

      {/* ─── Protected Routes (authenticated) ──────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path={ROUTES.DASHBOARD}    element={<DashboardPage />} />
          <Route path={ROUTES.PROFILE}      element={<ProfilePage />} />
          <Route path={ROUTES.SETTINGS}     element={<SettingsPage />} />
          <Route path={ROUTES.PDF_MANAGER}  element={<PDFManagerPage />} />
          <Route path={ROUTES.PDF_LIST}     element={<PDFManagerPage />} />
          <Route path={ROUTES.PDF_DETAIL}   element={<PDFDetailPage />} />
          <Route path={ROUTES.QUIZ_LIST}        element={<QuizListPage />} />
          <Route path={ROUTES.QUIZ_CREATE}      element={<CreateQuizPage />} />
          <Route path={ROUTES.QUIZ_HISTORY}     element={<QuizHistoryPage />} />
          <Route path={ROUTES.QUIZ_AI_GENERATE} element={<AIQuizGenerationPage />} />
          <Route path={ROUTES.QUIZ_PLAY}        element={<QuizPlayPage />} />
          <Route path={ROUTES.QUIZ_RESULT}      element={<QuizResultPage />} />
          <Route path={ROUTES.BATTLE_LOBBY} element={<BattleLobbyPage />} />
          <Route path={ROUTES.BATTLE_PLAY}  element={<BattlePlayPage />} />
          <Route path={ROUTES.GAMIFICATION} element={<GamificationPage />} />
        </Route>
      </Route>

      {/* ─── Admin Routes ───────────────────────────────────────────────── */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path={ROUTES.ADMIN}         element={<AdminDashboardPage />} />
          <Route path={ROUTES.ADMIN_USERS}   element={<AdminUsersPage />} />
          <Route path={ROUTES.ADMIN_QUIZZES} element={<AdminQuizzesPage />} />
          <Route path={ROUTES.ADMIN_BATTLES} element={<AdminBattlesPage />} />
          <Route path={ROUTES.ADMIN_PDFS}    element={<AdminPDFsPage />} />
        </Route>
      </Route>

      {/* ─── 404 ────────────────────────────────────────────────────────── */}
      <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
    </Routes>
  </Suspense>
);

export default AppRoutes;