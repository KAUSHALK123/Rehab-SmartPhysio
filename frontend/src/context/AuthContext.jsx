import React, { createContext, useState, useEffect, useContext } from 'react';
import { loginUser, registerUser, logoutUser } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Basic verification of token persistence on load
    const savedToken = localStorage.getItem('token');
    const savedUserEmail = localStorage.getItem('userEmail');
    if (savedToken && savedUserEmail) {
      setToken(savedToken);
      setUser({ email: savedUserEmail });
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('userEmail', email);
      setToken(data.access_token);
      setUser({ email });
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Authentication failed';
      return { success: false, error: errorMsg };
    }
  };

  const register = async (email, password) => {
    try {
      await registerUser(email, password);
      return { success: true };
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Registration failed';
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Proceed with local logout anyway
    }
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
