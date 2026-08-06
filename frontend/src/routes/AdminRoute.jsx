import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store.js';
import { ROUTES } from '../constants/routes.js';

/**
 * @component AdminRoute
 * @description Restricts access to admin users only.
 */
const AdminRoute = () => {
  const { user, accessToken } = useAuthStore();

  const isAuthenticated = !!user && !!accessToken;
  const isAdmin         = user?.role === 'admin';

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (!isAdmin) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
};

export default AdminRoute;