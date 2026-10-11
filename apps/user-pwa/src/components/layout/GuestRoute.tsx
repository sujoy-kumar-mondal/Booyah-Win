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

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <main className="mx-auto flex-1 w-full max-w-md px-4 flex flex-col justify-center">
        <Outlet />
      </main>
    </div>
  );
};
