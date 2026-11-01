import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { LoadingScreen } from '../common/LoadingScreen.js';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isInitialLoading, sessionReplacedOpen } = useAuth();

  if (isInitialLoading) {
    return <LoadingScreen message="Verifying session..." />;
  }

  // If session replacement dialog is open, let the screen remain visible under the modal
  // until the user dismisses it and is routed to /login
  if (!isAuthenticated && !sessionReplacedOpen) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
