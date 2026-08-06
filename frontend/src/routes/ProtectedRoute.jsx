import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store.js';
import { ROUTES } from '../constants/routes.js';

/**
 * @component ProtectedRoute
 * @description Redirects unauthenticated users to login.
 */
const ProtectedRoute = () => {
  const { user, accessToken } = useAuthStore();
  const location = useLocation();

  const isAuthenticated = !!user && !!accessToken;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.LOGIN}
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;