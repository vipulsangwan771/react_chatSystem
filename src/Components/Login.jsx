import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useAuth } from './context/AuthContext';
import { debounce } from 'lodash';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleInputChange = debounce((setter, value) => {
    setter(value.trim());
    setError('');
  }, 300);

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (!email || !password) {
        setError('Email and password are required');
        setLoading(false);
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post(`${process.env.REACT_APP_SERVER_URL}/api/login`, { email, password });
        if (!res.data.data?.user?.token || !res.data.data?.user) {
          throw new Error('Invalid server response');
        }

        const user = {
          id: res.data.data.user.id,
          name: res.data.data.user.name,
          email: res.data.data.user.email,
        };

        setAuth({
          isAuthenticated: true,
          token: res.data.data.user.token,
          user,
        });

        navigate('/messages');
      } catch (err) {
        setLoading(false);
        const msg = err.response?.data?.error?.message || 'Login failed. Please try again.';
        setError(msg);
      }
    },
    [email, password, navigate, setAuth]
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-3">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center" role="alert">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
              }`}
              value={email}
              onChange={(e) => handleInputChange(setEmail, e.target.value)}
              aria-required="true"
              aria-describedby={error ? 'email-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
                }`}
                value={password}
                onChange={(e) => handleInputChange(setPassword, e.target.value)}
                aria-required="true"
                aria-describedby={error ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Login"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          Don’t have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default React.memo(Login);