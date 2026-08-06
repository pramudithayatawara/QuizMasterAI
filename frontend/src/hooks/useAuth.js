import { useAuthStore } from '../store/auth.store.js';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.js';

/**
 * @hook useAuth
 * @description Convenience hook for authentication operations.
 */
export const useAuth = () => {
  const store    = useAuthStore();
  const navigate = useNavigate();

  const loginAndRedirect = async (credentials) => {
    const result = await store.login(credentials);
    if (result.success) {
      const destination = result.user?.role === 'admin'
        ? ROUTES.ADMIN
        : ROUTES.DASHBOARD;
      navigate(destination);
    }
    return result;
  };

  const registerAndRedirect = async (data) => {
    const result = await store.register(data);
    if (result.success) {
      navigate(ROUTES.DASHBOARD);
    }
    return result;
  };

  const logoutAndRedirect = async () => {
    await store.logout();
    navigate(ROUTES.LOGIN);
  };

  return {
    user:               store.user,
    accessToken:        store.accessToken,
    isLoading:          store.isLoading,
    isAuthenticated:    store.isAuthenticated(),
    isAdmin:            store.isAdmin(),
    login:              loginAndRedirect,
    register:           registerAndRedirect,
    logout:             logoutAndRedirect,
    fetchMe:            store.fetchMe,
    updateUser:         store.updateUser,
  };
};