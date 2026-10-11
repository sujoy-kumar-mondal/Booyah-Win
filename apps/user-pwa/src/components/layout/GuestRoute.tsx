import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { LoadingScreen } from '../common/LoadingScreen.js';

export const GuestRoute: React.FC = () => {
  const { isAuthenticated, isInitialLoading } = useAuth();

  if (isInitialLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
