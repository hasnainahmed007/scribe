import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
  onAuthSuccess?: (role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onAuthSuccess,
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  // Frontend Validation Errors (all English)
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Frontend Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (mode === 'register') {
      if (!name.trim()) {
        newErrors.name = 'Please enter your full name.';
      } else if (name.trim().length < 2) {
        newErrors.name = 'Full name must be at least 2 characters.';
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Please provide an email address.';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please provide a valid email format (e.g. user@example.com).';
    }

    if (!password) {
      newErrors.password = 'Please provide a password.';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'register') {
      if (!passwordConfirmation) {
        newErrors.passwordConfirmation = 'Please confirm your password.';
      } else if (password !== passwordConfirmation) {
        newErrors.passwordConfirmation = 'Passwords do not match.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await login(email.trim(), password);
        if (!res.success) {
          setServerError(res.error || 'Invalid email or password. Please try again.');
        } else if (res.user) {
          if (onAuthSuccess) {
            onAuthSuccess(res.user.role);
          }
          onClose();
        }
      } else {
        const res = await register(
          name.trim(),
          email.trim(),
          password,
          passwordConfirmation
        );
        if (!res.success) {
          setServerError(res.error || 'Registration failed. Please check your information.');
        } else if (res.user) {
          if (onAuthSuccess) {
            onAuthSuccess(res.user.role);
          }
          onClose();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#101726] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold font-display">
              S
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display">
                {mode === 'login' ? 'Sign In to Scriby' : 'Create Free Account'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Secure API Authentication & Role-Based Access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 p-1">
          <button
            onClick={() => {
              setMode('login');
              setErrors({});
              setServerError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setMode('register');
              setErrors({});
              setServerError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register (Free 30 Mins)
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {serverError && (
            <div className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Name Field (Register mode only) */}
          {mode === 'register' && (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  placeholder="e.g. John Doe"
                  className={`w-full pl-9 pr-3 py-2 bg-slate-900 border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                    errors.name ? 'border-red-500' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {errors.name && <p className="text-[11px] text-red-400 mt-1">{errors.name}</p>}
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                placeholder="you@domain.com"
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                  errors.email ? 'border-red-500' : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-red-400 mt-1">{errors.email}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                placeholder="At least 6 characters..."
                className={`w-full pl-9 pr-3 py-2 bg-slate-900 border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                  errors.password ? 'border-red-500' : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.password && <p className="text-[11px] text-red-400 mt-1">{errors.password}</p>}
          </div>

          {/* Password Confirmation (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(e) => {
                    setPasswordConfirmation(e.target.value);
                    if (errors.passwordConfirmation)
                      setErrors({ ...errors, passwordConfirmation: '' });
                  }}
                  placeholder="Repeat your password..."
                  className={`w-full pl-9 pr-3 py-2 bg-slate-900 border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-colors ${
                    errors.passwordConfirmation ? 'border-red-500' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {errors.passwordConfirmation && (
                <p className="text-[11px] text-red-400 mt-1">{errors.passwordConfirmation}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="w-full flex items-center justify-center gap-2 mt-2"
          >
            <span>
              {isSubmitting
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In to Your Workspace'
                : 'Create Account & Claim 30 Mins'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </form>

        {/* Informational Credential Hint (Subtle plain text, NO clickable switcher buttons) */}
        <div className="px-6 py-3.5 bg-slate-950/70 border-t border-slate-800/80 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-slate-300 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Automatic Role-Based Redirection:</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            SuperAdmin credentials redirect to the SuperAdmin Portal. Creator accounts redirect to the Creator Studio.
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800/60 font-mono text-[10px] space-y-0.5 text-slate-400">
            <div>
              <span className="text-purple-400 font-semibold">SuperAdmin:</span>{' '}
              <span className="text-slate-300">admin@scriby.com</span> /{' '}
              <span className="text-slate-300">admin1234</span>
            </div>
            <div>
              <span className="text-emerald-400 font-semibold">Creator:</span>{' '}
              <span className="text-slate-300">creator@scriby.com</span> /{' '}
              <span className="text-slate-300">creator1234</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
