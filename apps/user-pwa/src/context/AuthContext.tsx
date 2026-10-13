import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  onSessionReplaced,
  onUnauthenticated,
  onSlowRequest,
} from '../api/client.js';
import { getMe } from '../api/user.js';
import { logout as apiLogout } from '../api/auth.js';
import type { UserProfile, Wallets, Cooldowns, GetMeData } from '../api/types.js';

interface AuthContextType {
  token: string | null;
  user: UserProfile | null;
  wallets: Wallets | null;
  cooldowns: Cooldowns | null;
  isAuthenticated: boolean;
  isInitialLoading: boolean;
  slowServerNotice: boolean;
  sessionReplacedOpen: boolean;
  sessionDialogMessage: string;
  sessionDialogTitle: string;
  login: (token: string, user?: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  dismissSessionReplaced: () => void;
  handleSessionTerminated: (message: string, title?: string) => void;
  updateSessionData: (data: GetMeData) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let queryClient: any = null;
  try {
    queryClient = useQueryClient();
  } catch {
    queryClient = null;
  }

  let navigate: any = null;
  try {
    navigate = useNavigate();
  } catch {
    navigate = null;
  }

  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallets, setWallets] = useState<Wallets | null>(null);
  const [cooldowns, setCooldowns] = useState<Cooldowns | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(() => !!getStoredToken());
  const [sessionReplacedOpen, setSessionReplacedOpen] = useState(false);
  const [sessionDialogMessage, setSessionDialogMessage] = useState(
    'You were logged out because your account was used on another device.'
  );
  const [sessionDialogTitle, setSessionDialogTitle] = useState('Session Replaced');
  const [slowServerNotice, setSlowServerNotice] = useState(false);

  const userRef = useRef<UserProfile | null>(null);

  const handleSessionTerminated = useCallback(
    (message: string, title = 'Session Expired') => {
      clearStoredToken();
      queryClient?.clear();
      userRef.current = null;
      setToken(null);
      setUser(null);
      setWallets(null);
      setCooldowns(null);
      setSessionDialogMessage(message);
      setSessionDialogTitle(title);
      setSessionReplacedOpen(true);
    },
    [queryClient]
  );

  const updateSessionData = useCallback((data: GetMeData) => {
    userRef.current = data.profile;
    setUser(data.profile);
    setWallets(data.wallets);
    setCooldowns(data.cooldowns);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await getMe();
      updateSessionData(data);
    } catch {
      // If profile retrieval fails on boot, clear state silently
      clearStoredToken();
      userRef.current = null;
      setToken(null);
      setUser(null);
      setWallets(null);
      setCooldowns(null);
    }
  }, [updateSessionData]);

  // Initial session verification on boot
  useEffect(() => {
    const initialToken = getStoredToken();
    if (!initialToken) {
      setIsInitialLoading(false);
      return;
    }

    refreshProfile().finally(() => {
      setIsInitialLoading(false);
    });
  }, [refreshProfile]);

  // Listen for session replacement & unauthenticated events from API client
  useEffect(() => {
    const unsubReplaced = onSessionReplaced(() => {
      // Never show modal if user is logged out / has no active session
      if (!userRef.current) {
        clearStoredToken();
        setToken(null);
        return;
      }
      handleSessionTerminated(
        'You were logged out because your account was used on another device.',
        'Session Replaced'
      );
    });

    const unsubUnauth = onUnauthenticated(() => {
      // Never show modal if user is logged out / has no active session
      if (!userRef.current) {
        clearStoredToken();
        setToken(null);
        return;
      }
      handleSessionTerminated(
        'Your session has expired. Please log in again.',
        'Session Expired'
      );
    });

    const unsubSlow = onSlowRequest((isSlow) => {
      setSlowServerNotice(isSlow);
    });

    return () => {
      unsubReplaced();
      unsubUnauth();
      unsubSlow();
    };
  }, [handleSessionTerminated]);

  const login = useCallback(
    async (newToken: string, immediateUser?: UserProfile) => {
      setStoredToken(newToken);
      setToken(newToken);
      if (immediateUser) {
        userRef.current = immediateUser;
        setUser(immediateUser);
      }
      await refreshProfile();
    },
    [refreshProfile]
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore network errors on logout
    } finally {
      clearStoredToken();
      queryClient?.clear();
      userRef.current = null;
      setSessionReplacedOpen(false);
      setToken(null);
      setUser(null);
      setWallets(null);
      setCooldowns(null);
    }
  }, [queryClient]);

  const dismissSessionReplaced = useCallback(() => {
    setSessionReplacedOpen(false);
    queryClient?.clear();
    navigate?.('/login', { replace: true });
  }, [queryClient, navigate]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        wallets,
        cooldowns,
        isAuthenticated: !!token && !!user,
        isInitialLoading,
        slowServerNotice,
        sessionReplacedOpen,
        sessionDialogMessage,
        sessionDialogTitle,
        login,
        logout,
        refreshProfile,
        dismissSessionReplaced,
        handleSessionTerminated,
        updateSessionData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
