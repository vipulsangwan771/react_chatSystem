import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './Components/context/AuthContext';
import PrivateRoute from './Components/PrivateRoute';
import PublicRoute from './Components/PublicRoute';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { throttle } from 'lodash';
import io from 'socket.io-client';
import './App.css';
import ErrorBoundary from './Components/ErrorBoundary';
import { ToastContainer } from 'react-toastify';

const Home = lazy(() => import('./Components/Home'));
const Messages = lazy(() => import('./Components/Messages'));
const Login = lazy(() => import('./Components/Login'));
const Register = lazy(() => import('./Components/Register'));

function AppContent() {
  const { auth, setAuth } = useAuth();
  const navigate = useNavigate();
  const BASE_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
  const socketRef = useRef(null);

  const idleTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastRefreshAttemptRef = useRef(0);
  const IDLE_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const MIN_REFRESH_INTERVAL = 60 * 1000; // Minimum 60 seconds between refresh attempts
  let isRefreshing = false;

  const updateFavicon = (hasUnread) => {
    const favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = hasUnread
      ? '/favicon-unread.ico' // Path to favicon with notification dot
      : '/favicon.ico'; // Path to default favicon
    document.head.appendChild(favicon);
  };

  const refreshToken = async (token) => {
    if (isRefreshing || Date.now() - lastRefreshAttemptRef.current < MIN_REFRESH_INTERVAL) {
      return null;
    }
    isRefreshing = true;
    lastRefreshAttemptRef.current = Date.now();
  
    try {
      const resp = await axios.post(
        `${BASE_URL}/api/refreshtoken`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const newToken = resp.data.token;
      if (!newToken) throw new Error('Invalid refresh token response');
      
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (!storedUser?.user) throw new Error('No user data in localStorage');
  
      // Retain id in auth.user
      const user = {
        id: auth.user?.id || jwtDecode(newToken).id, // Use existing id or decode from new token
        name: storedUser.user.name,
        email: storedUser.user.email,
      };
  
      const newAuth = {
        isAuthenticated: true,
        token: newToken,
        user,
      };
  
      // Save only name and email to localStorage
      localStorage.setItem('user', JSON.stringify({ 
        token: newToken, 
        user: { name: user.name, email: user.email } 
      }));
      setAuth(newAuth);
      return newToken;
    } catch (err) {
      console.error('Token refresh failed:', err.message);
      if (err.response?.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_INTERVAL));
        return refreshToken(token);
      }
      logout();
      return null;
    } finally {
      isRefreshing = false;
    }
  };

  const logout = () => {
    setAuth({ isAuthenticated: false, token: null, user: null });
    clearTimeouts();
    if (!['/login', '/register'].includes(window.location.pathname)) {
      navigate('/login');
    }
    updateFavicon(false);
    socketRef.current?.disconnect();
  };

  const clearTimeouts = () => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
  };

  const checkTokenExpiration = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user?.token) return;

    try {
      const decoded = jwtDecode(user.token);
      if (!decoded.expiresAt) throw new Error('Token missing expiresAt field');
      const expiresAt = decoded.expiresAt;
      const now = Date.now();
      const timeToExpiry = expiresAt - now;

      if (timeToExpiry <= 0) {
        logout();
        return;
      }

      if (timeToExpiry < REFRESH_THRESHOLD) {
        const lastActivity = lastActivityRef.current;
        if (Date.now() - lastActivity < IDLE_TIMEOUT) {
          refreshToken(user.token);
        } else {
          logout();
        }
      }
    } catch (err) {
      console.error('Failed to decode token:', err.message);
      logout();
    }
  };

  const resetIdleTimer = () => {
    lastActivityRef.current = Date.now();
    clearTimeouts();
    idleTimeoutRef.current = setTimeout(() => {
      logout();
    }, IDLE_TIMEOUT);
  };

  const handleUserActivity = throttle(() => {
    resetIdleTimer();
  }, 500);

  const setupAxiosInterceptor = () => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (!config.url || config.url.includes('/api/login') || config.url.includes('/api/register')) {
          return config;
        }
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  };

  useEffect(() => {
    if (auth.token) {
      socketRef.current = io(SOCKET_URL, {
        auth: { token: auth.token },
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
      });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('join', auth.user.id);
      });

      socketRef.current.on('unread-counts', (counts) => {
        const hasUnread = counts.some(({ count }) => count > 0);
        updateFavicon(hasUnread);
      });

      socketRef.current.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
      });
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, handleUserActivity));
    resetIdleTimer();

    const intervalId = setInterval(checkTokenExpiration, 30 * 1000);
    const cleanupInterceptors = setupAxiosInterceptor();

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      clearTimeouts();
      clearInterval(intervalId);
      cleanupInterceptors();
      socketRef.current?.disconnect();
    };
  }, [auth.token, navigate, setAuth]);

  return (
    <Routes>
      <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-5 rounded-lg flex flex-col items-center shadow-xl">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#009efb]"></div>
                  <p className="mt-4 text-gray-700">Loading...</p>
                </div>
              </div>
            }
          >
            <AppContent />
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;