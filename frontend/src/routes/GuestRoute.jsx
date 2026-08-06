import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store.js';
import { ROUTES } from '../constants/routes.js';

/**
 * @component GuestRoute
 * @description Redirects authenticated users away from auth pages.
 */
const GuestRoute = () => {
  const { user, accessToken } = useAuthStore();

  const isAuthenticated = !!user && !!accessToken;

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default GuestRoute;