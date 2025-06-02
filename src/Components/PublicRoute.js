import { Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import React from 'react';

const PublicRoute = ({ children }) => {
  const { auth } = useAuth();
  return auth.isAuthenticated ? <Navigate to="/" /> : children;
};

export default React.memo(PublicRoute);