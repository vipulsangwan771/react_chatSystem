import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowBigRightDash } from 'lucide-react';
import { useAuth } from './context/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleLogout = useCallback(() => {
    setAuth({ isAuthenticated: false, token: null, user: null });
    navigate('/login');
  }, [navigate, setAuth]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-3">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-2xl w-full text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">Welcome back to ChatterBox 💬</h1>
        <p className="text-gray-600 mb-6 text-lg">
          You're logged in and ready to chat. ChatterBox lets you connect, collaborate, and communicate in real-time — whether it's one-on-one or in groups.
        </p>
        <div className="flex justify-center">
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full text-lg font-semibold hover:bg-blue-700 transition"
          >
            Go to Messages <ArrowBigRightDash size={24} />
          </Link>
        </div>
        <div className="mt-8 text-sm text-gray-500 flex justify-between">
          <div>
            Not you?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Switch Account
            </Link>
          </div>
          <div>
            <button onClick={handleLogout} className="text-blue-600 hover:underline font-medium">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Home);