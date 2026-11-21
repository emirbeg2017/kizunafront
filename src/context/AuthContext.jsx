import { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();
const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';

const getTokenExpiration = (token) => {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')));
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
};

const readStoredSession = () => {
  const storedToken = localStorage.getItem('token');
  const userData = localStorage.getItem('user');
  const expiresAt = storedToken ? getTokenExpiration(storedToken) : null;

  if (!storedToken || !userData || !expiresAt || expiresAt <= Date.now()) {
    if (storedToken || userData) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.setItem('authNotice', SESSION_EXPIRED_MESSAGE);
    }
    return { isAuthenticated: false, user: null, token: null };
  }

  try {
    return { isAuthenticated: true, user: JSON.parse(userData), token: storedToken };
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { isAuthenticated: false, user: null, token: null };
  }
};

export const AuthProvider = ({ children }) => {
  const [initialSession] = useState(readStoredSession);
  const [isAuthenticated, setIsAuthenticated] = useState(initialSession.isAuthenticated);
  const [user, setUser] = useState(initialSession.user);
  const [token, setToken] = useState(initialSession.token);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
  }, []);

  const expireSession = useCallback(() => {
    sessionStorage.setItem('authNotice', SESSION_EXPIRED_MESSAGE);
    logout();
  }, [logout]);

  useEffect(() => {
    if (!token) return undefined;

    const expiresAt = getTokenExpiration(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      expireSession();
      return undefined;
    }

    const timeoutId = window.setTimeout(expireSession, expiresAt - Date.now());
    return () => window.clearTimeout(timeoutId);
  }, [expireSession, token]);

  const login = (userData, token) => {
    sessionStorage.removeItem('authNotice');
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
    setToken(token);
  };

  const authFetch = useCallback(async (input, options = {}) => {
    const storedToken = localStorage.getItem('token');
    const expiresAt = storedToken ? getTokenExpiration(storedToken) : null;

    if (!storedToken || !expiresAt || expiresAt <= Date.now()) {
      expireSession();
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${storedToken}`);
    const response = await fetch(input, { ...options, headers });

    if (response.status === 401) {
      expireSession();
      throw new Error(SESSION_EXPIRED_MESSAGE);
    }

    return response;
  }, [expireSession]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 
