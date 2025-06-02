import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({ isAuthenticated: false, token: null, user: null });
  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      setAuth({ isAuthenticated: false, token: null, user: null });
      return;
    }

    try {
      const parsed = JSON.parse(userData);
      if (
        parsed.token &&
        parsed.user &&
        typeof parsed.user === 'object' &&
        parsed.user.id &&
        parsed.user.name &&
        parsed.user.email
      ) {
        const user = {
          id: parsed.user.id,
          name: parsed.user.name,
          email: parsed.user.email,
        };
        setAuth({
          isAuthenticated: true,
          token: parsed.token,
          user,
        });
      } else {
        throw new Error('Invalid user data');
      }
    } catch (err) {
      console.error('Failed to parse user data:', err.message);
      setAuth({ isAuthenticated: false, token: null, user: null });
      localStorage.removeItem('user');
      if (!['/login', '/register'].includes(window.location.pathname)) {
        navigate('/login');
      }
    }
  }, [navigate]);

  const updateAuth = (newAuth) => {
    setAuth(newAuth);
    if (!newAuth.isAuthenticated) {
      localStorage.removeItem('user');
    } else {
      const userForStorage = {
        id: newAuth.user.id,
        name: newAuth.user.name,
        email: newAuth.user.email,
      };
      localStorage.setItem('user', JSON.stringify({ token: newAuth.token, user: userForStorage }));
    }
  };

  const logout = () => {
    // setAuth({ isAuthenticated: false, token: null, user: null });
    // localStorage.removeItem('user');
    // navigate('/login');
  };

  const contextValue = useMemo(
    () => ({ auth, setAuth: updateAuth, logout }),
    [auth]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
