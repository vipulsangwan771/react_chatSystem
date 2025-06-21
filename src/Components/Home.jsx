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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center px-4 sm:px-6 py-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 w-full max-w-4xl text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-800 mb-4">
          Welcome back to <span className="text-blue-600">ChatterBox 💬</span>
        </h1>
        <p className="text-gray-600 text-lg sm:text-xl mb-8">
          Real-time chat, simple collaboration, and smarter conversations — all in one place.
        </p>

        <div className="flex justify-center mb-10">
          <Link
            to="/messages"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white px-8 py-3 rounded-full text-lg font-medium shadow-md"
          >
            Go to Messages <ArrowBigRightDash size={24} />
          </Link>
        </div>

        {/* Features Section */}
        <div className="grid sm:grid-cols-2 gap-6 text-left">
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">🔒 Secure Conversations</h3>
            <p className="text-gray-600">
              Your messages are encrypted end-to-end to ensure maximum privacy.
            </p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">💬 Group Chat & DMs</h3>
            <p className="text-gray-600">
              Chat one-on-one or collaborate in groups with ease.
            </p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">⚡ Instant Updates</h3>
            <p className="text-gray-600">
              Enjoy lightning-fast message syncing across all your devices.
            </p>
          </div>
          <div className="bg-blue-50 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">🌍 Cross-Platform</h3>
            <p className="text-gray-600">
              Use ChatterBox on mobile, tablet, or desktop — anytime, anywhere.
            </p>
          </div>
        </div>

        {/* User Controls */}
        <div className="mt-10 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500 gap-3">
          <div>
            Not you?{' '}
            <Link to="/login" className="text-blue-600 hover:underline font-medium">
              Switch Account
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="text-blue-600 hover:underline font-medium"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-10 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} ChatterBox. Built for smarter conversations.
      </footer>
    </div>
  );
};

export default React.memo(Home);
