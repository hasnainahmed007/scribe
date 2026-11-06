import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Send,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthPageMode } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  loginSchema,
  registerOtpRequestSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  formatZodError,
  formatZodFieldErrors,
} from '../schemas/validation';

interface AuthPageProps {
  initialMode?: AuthPageMode;
  onSuccess?: () => void;
  onBackToHome?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  onSuccess,
  onBackToHome,
}) => {
  const {
    login,
    requestRegisterOtp,
    verifyRegisterOtp,
    resendRegisterOtp,
    requestForgotPasswordOtp,
    verifyForgotPasswordOtp,
    quickDemoLogin,
  } = useAuth();

  const [mode, setMode] = useState<AuthPageMode>(initialMode);

  // Sign In State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register State
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // OTP Verification State
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // General Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Resend Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Sync mode whenever initialMode prop updates
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      clearAlerts();
    }
  }, [initialMode]);

  const clearAlerts = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});
  };

  const switchMode = (newMode: AuthPageMode) => {
    clearAlerts();
    setMode(newMode);
  };

  // 1. Handle Login (Validated with Zod loginSchema)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const parse = loginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });

    if (!parse.success) {
      setErrorMessage(formatZodError(parse.error));
      setFieldErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(parse.data.email, parse.data.password);
      if (res.success) {
        onSuccess?.();
      } else {
        setErrorMessage(res.error || 'Invalid email or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Register (Step 1: Request OTP - Validated with Zod registerOtpRequestSchema)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const parse = registerOtpRequestSchema.safeParse({
      name: registerName,
      email: registerEmail,
      password: registerPassword,
      password_confirmation: registerConfirmPassword,
    });

    if (!parse.success) {
      setErrorMessage(formatZodError(parse.error));
      setFieldErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestRegisterOtp(
        parse.data.name,
        parse.data.email,
        parse.data.password,
        registerConfirmPassword
      );

      if (res.success) {
        setPendingEmail(parse.data.email);
        setDevOtpHint(res.devOtp || null);
        setResendCooldown(60);
        setOtpCode(res.devOtp || '');
        setSuccessMessage(res.message || 'Verification code sent to your email.');
        setMode('verify-otp');
      } else {
        setErrorMessage(res.error || 'Failed to send verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Verify OTP (Step 2: Confirm Account - Validated with Zod verifyOtpSchema)
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const parse = verifyOtpSchema.safeParse({
      email: pendingEmail,
      otp: otpCode,
    });

    if (!parse.success) {
      setErrorMessage(formatZodError(parse.error));
      setFieldErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyRegisterOtp(parse.data.email, parse.data.otp);
      if (res.success) {
        onSuccess?.();
      } else {
        setErrorMessage(res.error || 'Invalid verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Resend OTP (Validated with Zod resendOtpSchema)
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !pendingEmail) return;
    clearAlerts();

    const parse = resendOtpSchema.safeParse({ email: pendingEmail });
    if (!parse.success) {
      setErrorMessage(formatZodError(parse.error));
      return;
    }

    setIsLoading(true);
    try {
      const res = await resendRegisterOtp(parse.data.email);
      if (res.success) {
        setResendCooldown(60);
        if (res.devOtp) {
          setDevOtpHint(res.devOtp);
          setOtpCode(res.devOtp);
        }
        setSuccessMessage('A fresh verification code has been dispatched to your email.');
      } else {
        setErrorMessage(res.error || 'Failed to resend verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Forgot Password (Step 1: Request OTP - Validated with Zod forgotPasswordRequestSchema)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const parse = forgotPasswordRequestSchema.safeParse({
      email: forgotEmail,
    });

    if (!parse.success) {
      setErrorMessage(formatZodError(parse.error));
      setFieldErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsLoading(true);
    try {
      const res = await requestForgotPasswordOtp(parse.data.email);
      if (res.success) {
        setPendingEmail(parse.data.email);
        setDevOtpHint(res.devOtp || null);
        setOtpCode(res.devOtp || '');
        setResendCooldown(60);
        setSuccessMessage('Password reset code sent! Please check your email.');
        setMode('reset-password');
      } else {
        setErrorMessage(res.error || 'Failed to send password reset code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Handle Reset Password (Step 2: Verify & Update - Validated with Zod forgotPasswordVerifySchema)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();

    const parse = forgotPasswordVerifySchema.safeParse({
      email: pendingEmail,
      otp: otpCode,
      newPassword,
      confirmPassword: confirmNewPassword,
    });

    if (!parse.success) {
      setErrorMessage(formatZodError(parse.error));
      setFieldErrors(formatZodFieldErrors(parse.error));
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyForgotPasswordOtp(
        parse.data.email,
        parse.data.otp,
        parse.data.newPassword,
        parse.data.confirmPassword
      );
      if (res.success) {
        onSuccess?.();
      } else {
        setErrorMessage(res.error || 'Password reset failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Demo Logins
  const handleDemoClick = async (role: 'superadmin' | 'creator') => {
    clearAlerts();
    setIsLoading(true);
    try {
      const u = await quickDemoLogin(role);
      if (u) {
        onSuccess?.();
      } else {
        setErrorMessage('Failed to sign in with demo credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#121212] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand & Back Button */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 text-xs font-semibold text-[#b3b3b3] hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#1ed760] text-black flex items-center justify-center font-extrabold text-xs">
            S
          </div>
          <span className="text-sm font-bold text-white tracking-tight">Scriby</span>
        </div>
      </div>

      {/* Main Auth Container */}
      <div className="w-full max-w-md bg-[#181818] border border-[#282828] rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        {/* Top Highlight Accent */}
        <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-[#1ed760] to-transparent opacity-60" />

        {/* Dynamic Alerts */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-3.5 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#1ed760] shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        {/* ================= VIEW 1: SIGN IN ================= */}
        {mode === 'login' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                Sign in to Scriby
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1.5">
                AI Speech Intelligence & Creator Studio
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="creator@scriby.com"
                    required
                    className="pl-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-password')}
                    className="text-xs text-[#1ed760] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-9 pr-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 font-bold bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-101 transition-all rounded-full py-2.5 shadow-[0_4px_12px_rgba(30,215,96,0.25)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </span>
                )}
              </Button>
            </form>

            {/* Quick Demo Access Bar */}
            <div className="mt-6 pt-5 border-t border-[#282828]">
              <div className="text-[11px] font-semibold text-slate-400 mb-2.5 text-center flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Instant Demo Access</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoClick('creator')}
                  disabled={isLoading}
                  className="px-3 py-2 bg-[#121212] hover:bg-[#282828] border border-[#282828] rounded-xl text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-[#1ed760]" />
                  <span>Creator Demo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoClick('superadmin')}
                  disabled={isLoading}
                  className="px-3 py-2 bg-[#121212] hover:bg-[#282828] border border-[#282828] rounded-xl text-xs font-semibold text-purple-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Admin Demo</span>
                </button>
              </div>
            </div>

            {/* Switch to Register */}
            <div className="mt-6 text-center text-xs text-slate-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-bold text-[#1ed760] hover:underline cursor-pointer"
              >
                Sign up with email
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: REGISTER (STEP 1) ================= */}
        {mode === 'register' && (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                Create your account
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1.5">
                Get 30 free audio minutes upon verified registration
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Tanvir Ahmed"
                    required
                    className="pl-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    placeholder="tanvir@example.com"
                    required
                    className="pl-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="pl-9 pr-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    minLength={6}
                    className="pl-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-950/30 border border-emerald-900/60 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2 mt-2">
                <CheckCircle2 className="w-4 h-4 text-[#1ed760] shrink-0" />
                <span>We'll dispatch a 6-digit verification code to your email.</span>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 font-bold bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-101 transition-all rounded-full py-2.5 shadow-[0_4px_12px_rgba(30,215,96,0.25)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Verification Code...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    <span>Send Verification OTP</span>
                  </span>
                )}
              </Button>
            </form>

            {/* Switch to Login */}
            <div className="mt-6 text-center text-xs text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-[#1ed760] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: OTP VERIFICATION (STEP 2) ================= */}
        {mode === 'verify-otp' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[#1ed760] flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                Verify your email
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1.5">
                We sent a 6-digit code to{' '}
                <strong className="text-white font-mono">{pendingEmail}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 text-center">
                  Enter 6-Digit Verification Code
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="text-center font-mono text-2xl tracking-[0.5em] py-3 bg-[#121212] border-[#282828] text-[#1ed760] font-bold focus:border-[#1ed760]"
                  />
                </div>
                <div className="text-[11px] text-slate-500 text-center mt-2">
                  Code expires in 10 minutes
                </div>
              </div>

              {/* Dev Mode Instant Fill Helper */}
              {devOtpHint && (
                <div className="p-3 bg-[#121212] border border-amber-500/30 rounded-xl text-center">
                  <div className="text-[11px] text-amber-400 font-semibold mb-1 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dev / Testing OTP Detected</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpHint)}
                    className="text-xs font-mono font-bold text-black bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-full cursor-pointer transition-colors"
                  >
                    Auto-Fill Code: {devOtpHint}
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || otpCode.trim().length !== 6}
                className="w-full mt-2 font-bold bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-101 transition-all rounded-full py-2.5 shadow-[0_4px_12px_rgba(30,215,96,0.25)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify & Unlock 30 Free Minutes</span>
                  </span>
                )}
              </Button>
            </form>

            {/* Resend & Back controls */}
            <div className="mt-6 pt-5 border-t border-[#282828] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-[#b3b3b3] hover:text-white cursor-pointer"
              >
                ← Change Email
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
                className={`font-semibold cursor-pointer ${
                  resendCooldown > 0
                    ? 'text-slate-500 cursor-not-allowed'
                    : 'text-[#1ed760] hover:underline'
                }`}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 4: FORGOT PASSWORD (STEP 1) ================= */}
        {mode === 'forgot-password' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                Forgot password?
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1.5">
                Enter your account email to receive a password reset verification code
              </p>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="your-email@scriby.com"
                    required
                    className="pl-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 font-bold bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-101 transition-all rounded-full py-2.5 shadow-[0_4px_12px_rgba(30,215,96,0.25)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending Reset Code...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    <span>Send Reset Code</span>
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              Remember your credentials?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-[#1ed760] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 5: RESET PASSWORD (STEP 2) ================= */}
        {mode === 'reset-password' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight font-display">
                Set New Password
              </h2>
              <p className="text-xs text-[#b3b3b3] mt-1.5">
                Resetting password for <strong className="text-white font-mono">{pendingEmail}</strong>
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 text-center">
                  6-Digit Reset Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="text-center font-mono text-xl tracking-[0.4em] py-2.5 bg-[#121212] border-[#282828] text-[#1ed760] font-bold focus:border-[#1ed760]"
                />
              </div>

              {devOtpHint && (
                <div className="p-2.5 bg-[#121212] border border-amber-500/30 rounded-xl text-center">
                  <button
                    type="button"
                    onClick={() => setOtpCode(devOtpHint)}
                    className="text-xs font-mono font-bold text-black bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-full cursor-pointer transition-colors"
                  >
                    Auto-Fill Code: {devOtpHint}
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showResetPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="pl-9 pr-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type={showResetPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                    minLength={6}
                    className="pl-9 bg-[#121212] border-[#282828] text-white focus:border-[#1ed760] text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full mt-3 font-bold bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-101 transition-all rounded-full py-2.5 shadow-[0_4px_12px_rgba(30,215,96,0.25)] cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Reset Password & Sign In</span>
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-400">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-[#1ed760] hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
