import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { useAuth } from "./context/AuthContext";
import { showToast } from "../utils/swal";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleInputChange = (setter, value) => {
    setter(value.trim());
    setError("");
  };

  const handleLogin = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      if (!email || !password) {
        showToast("Email and password are required", "error");
        setError("Email and password are required");
        setLoading(false);
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        showToast("Please enter a valid email address", "error");
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post(
          `${process.env.REACT_APP_SERVER_URL}/api/login`,
          { email, password }
        );
        if (!res.data.data?.user?.token || !res.data.data?.user) {
          throw new Error("Invalid server response");
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

        showToast("Login Successfully!", "success");
        navigate("/messages");
      } catch (err) {
        setLoading(false);
        const msg =
          err.response?.data?.error?.message ||
          "Login failed. Please try again.";

        showToast("Login failed. Please try again.", "error");
        setError(msg);
      }
    },
    [email, password, navigate, setAuth]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-indigo-200 px-4">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/40">
        <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
          Welcome Back 👋
        </h2>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-5" noValidate>
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="text-sm font-semibold text-gray-700"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              className={`w-full mt-1 px-4 py-3 rounded-xl border bg-white/60 backdrop-blur focus:outline-none transition-all
            ${
              error
                ? "border-red-500 shadow-sm"
                : "border-gray-300 focus:ring-2 focus:ring-indigo-400"
            }
          `}
              value={email}
              onChange={(e) => handleInputChange(setEmail, e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="text-sm font-semibold text-gray-700"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                className={`w-full mt-1 px-4 py-3 rounded-xl border bg-white/60 backdrop-blur focus:outline-none transition-all
              ${
                error
                  ? "border-red-500 shadow-sm"
                  : "border-gray-300 focus:ring-2 focus:ring-indigo-400"
              }
            `}
                value={password}
                onChange={(e) => handleInputChange(setPassword, e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all
          ${loading ? "opacity-60 cursor-not-allowed" : ""}
        `}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Switch Page */}
        <p className="mt-5 text-center text-sm text-gray-700">
          Don’t have an account?{" "}
          <Link
            className="text-indigo-600 font-semibold hover:underline"
            to="/register"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default React.memo(Login);
