import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useAuth } from './context/AuthContext';
import { debounce } from 'lodash';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleInputChange = debounce((setter, value) => {
    setter(value.trim());
    setError('');
  }, 300);

  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      if (!name || !email || !password || !confirmPassword) {
        setError('All fields are required');
        setLoading(false);
        return;
      }

      if (!/^[a-zA-Z\s]{2,}$/.test(name)) {
        setError('Name must be at least 2 characters and contain only letters');
        setLoading(false);
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        setError('Please enter a valid email address');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post(`${process.env.REACT_APP_SERVER_URL}/api/register`, { name, email, password });
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
        const msg = err.response?.data?.error?.message || 'Registration failed. Try again later.';
        setError(msg);
      }
    },
    [name, email, password, confirmPassword, navigate, setAuth]
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-3">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-center mb-6">Register</h2>
        {error && <p className="text-red-500 text-sm mb-4 text-center" role="alert">{error}</p>}
        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Name"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'
              }`}
              value={name}
              onChange={(e) => handleInputChange(setName, e.target.value)}
              aria-required="true"
              aria-describedby={error ? 'name-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'
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
                  error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'
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
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  error ? 'border-red-500 focus:ring-red-500' : 'focus:ring-green-500'
                }`}
                value={confirmPassword}
                onChange={(e) => handleInputChange(setConfirmPassword, e.target.value)}
                aria-required="true"
                aria-describedby={error ? 'confirmPassword-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            aria-label="Register"
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-green-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default React.memo(Register);