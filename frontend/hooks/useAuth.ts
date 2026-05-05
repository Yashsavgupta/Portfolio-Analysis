'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, setToken, clearToken } from '../lib/auth';
import { apiCall } from '../lib/api';

export interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
}

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load token on mount
  useEffect(() => {
    const savedToken = getToken();
    setTokenState(savedToken);

    // Fetch user if token exists
    if (savedToken) {
      fetchUser(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const userData = await apiCall('/api/auth/me', 'GET');
      setUser(userData);
    } catch (err) {
      clearToken();
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await apiCall('/api/auth/login', 'POST', { email, password });
      setToken(response.access_token);
      setTokenState(response.access_token);
      await fetchUser(response.access_token);
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';
      setError(errorMsg);
      throw err;
    }
  };

  const signup = async (email: string, password: string, full_name: string) => {
    try {
      setError(null);
      const response = await apiCall('/api/auth/signup', 'POST', {
        email,
        password,
        full_name,
      });
      setToken(response.access_token);
      setTokenState(response.access_token);
      await fetchUser(response.access_token);
      return response;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMsg);
      throw err;
    }
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
    router.push('/login');
  };

  const isAuthenticated = !!token && !!user;

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    signup,
    logout,
  };
}
