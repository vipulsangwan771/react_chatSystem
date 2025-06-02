import { Navigate } from 'react-router-dom';
import React from 'react';
import { useAuth } from './context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { auth } = useAuth();
  return auth.isAuthenticated ? children : <Navigate to="/login" />;
};

export default React.memo(PrivateRoute);