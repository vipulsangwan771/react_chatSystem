import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { useAuth } from "./context/AuthContext";
import { showToast } from "../utils/swal";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const handleInputChange = (setter, value) => {
    setter(value.trim());
    setError("");
  };

  const handleRegister = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      if (!name || !email || !password || !confirmPassword) {
        showToast("All fields are required", "error");
        setError("All fields are required");
        setLoading(false);
        return;
      }

      if (!/^[a-zA-Z\s]{2,}$/.test(name)) {
        showToast(
          "Name must be at least 2 characters and contain only letters",
          "error"
        );
        setError("Name must be at least 2 characters and contain only letters");
        setLoading(false);
        return;
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        showToast("Please enter a valid email address", "error");
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        showToast("Password must be at least 6 characters", "error");
        setError("Password must be at least 6 characters");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        showToast("Passwords do not match", "error");
        setError("Passwords do not match");
        setLoading(false);
        return;
      }

      try {
        const res = await axios.post(
          `${process.env.REACT_APP_SERVER_URL}/api/register`,
          { name, email, password }
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

        showToast("Registration Successfull!. ", "success");
        navigate("/messages");
      } catch (err) {
        setLoading(false);
        const msg =
          err.response?.data?.error?.message ||
          "Registration failed. Try again later.";

        showToast("Registration failed. Try again later.", "error");
        setError(msg);
      }
    },
    [name, email, password, confirmPassword, navigate, setAuth]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 via-white to-green-200 p-4">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/40">
        <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-6">
          Create Account 🌿
        </h2>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleRegister} className="space-y-5" noValidate>
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="text-sm font-semibold text-gray-700"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Full Name"
              className={`w-full mt-1 px-4 py-3 rounded-xl border bg-white/60 backdrop-blur focus:outline-none transition-all
            ${
              error
                ? "border-red-500 shadow-sm"
                : "border-gray-300 focus:ring-2 focus:ring-green-400"
            }
          `}
              value={name}
              onChange={(e) => handleInputChange(setName, e.target.value)}
            />
          </div>

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
              placeholder="Email"
              className={`w-full mt-1 px-4 py-3 rounded-xl border bg-white/60 backdrop-blur focus:outline-none transition-all
            ${
              error
                ? "border-red-500 shadow-sm"
                : "border-gray-300 focus:ring-2 focus:ring-green-400"
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
                placeholder="Password"
                className={`w-full mt-1 px-4 py-3 rounded-xl border bg-white/60 backdrop-blur focus:outline-none transition-all
              ${
                error
                  ? "border-red-500"
                  : "border-gray-300 focus:ring-2 focus:ring-green-400"
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

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-semibold text-gray-700"
            >
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password"
                className={`w-full mt-1 px-4 py-3 rounded-xl border bg-white/60 backdrop-blur focus:outline-none transition-all
              ${
                error
                  ? "border-red-500"
                  : "border-gray-300 focus:ring-2 focus:ring-green-400"
              }
            `}
                value={confirmPassword}
                onChange={(e) =>
                  handleInputChange(setConfirmPassword, e.target.value)
                }
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showConfirmPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 shadow-md transition-all
          ${loading ? "opacity-60 cursor-not-allowed" : ""}
        `}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-700">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-green-600 font-semibold hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default React.memo(Register);
