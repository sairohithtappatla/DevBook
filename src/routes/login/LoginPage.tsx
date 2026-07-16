import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { insforge } from "@/lib/insforge";
import {
  BookOpen,
  CheckCircle2,
  Code2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  User,
  UsersRound,
} from "lucide-react";

type FeatureItem = {
  icon: typeof BookOpen;
  title: string;
  description: string;
};

const features: FeatureItem[] = [
  {
    icon: BookOpen,
    title: "In-depth Developer Books",
    description: "Structured, phase-by-phase guides crafted by developers.",
  },
  {
    icon: Code2,
    title: "Track Your Progress",
    description: "Pick up where you left off and stay consistent every day.",
  },
  {
    icon: UsersRound,
    title: "Learn Together",
    description: "Follow creators, explore books and grow with the dev community.",
  },
];

type AuthMode = "login" | "signup" | "forgot-password";

export function LoginPage() {
  const { signIn, signUp, verifyEmail, forgotPassword, exchangeResetCode, resetPassword } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Controlled form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    otp?: string;
    newPassword?: string;
    general?: string;
  }>({});

  // Reset password state machine
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [resetToken, setResetToken] = useState("");
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [isVerifyingResetOTP, setIsVerifyingResetOTP] = useState(false);
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);

  // Loaders & successes
  const [isLoading, setIsLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isDark = theme === "dark";

  // Resend cooldown timer
  useState(() => {
    let interval: any;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  });

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleNewPasswordChange = (val: string) => {
    setNewPasswordVal(val);
    if (confirmPassword && val !== confirmPassword) {
      setErrors((prev) => ({ ...prev, newPassword: "Passwords do not match" }));
    } else {
      setErrors((prev) => {
        const { newPassword: _newPassword, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (newPasswordVal && val !== newPasswordVal) {
      setErrors((prev) => ({ ...prev, newPassword: "Passwords do not match" }));
    } else {
      setErrors((prev) => {
        const { newPassword: _newPassword, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    try {
      setIsLoading(true);
      await insforge.auth.signInWithOAuth(provider, {
        redirectTo: window.location.origin,
      });
    } catch (err: any) {
      setErrors({ general: err.message || `Failed to sign in with ${provider}` });
      setIsLoading(false);
    }
  };

  const triggerOtpSubmit = async (currentOtp: string[]) => {
    const fullOtp = currentOtp.join("");
    if (fullOtp.length < 6) return;
    setIsLoading(true);
    setErrors({});
    try {
      if (isVerifyingOTP) {
        await verifyEmail(email, fullOtp);
        setIsVerifyingOTP(false);
      } else if (isVerifyingResetOTP) {
        const token = await exchangeResetCode(email, fullOtp);
        setResetToken(token);
        setIsVerifyingResetOTP(false);
        setIsSettingNewPassword(true);
      }
    } catch (err: any) {
      setErrors({ otp: err.message || "Invalid OTP code." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullOtp = newOtp.join("");
    if (fullOtp.length === 6) {
      triggerOtpSubmit(newOtp);
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return;

    const digits = pastedData.split("");
    setOtp(digits);
    setErrors({});
    otpRefs.current[5]?.focus();
    triggerOtpSubmit(digits);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setErrors({});
    try {
      await insforge.auth.resendVerificationEmail({ email });
      setResendCooldown(60);
    } catch (err: any) {
      setErrors({ general: err.message || "Failed to resend code." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (isVerifyingOTP) {
      await triggerOtpSubmit(otp);
      return;
    }

    if (isVerifyingResetOTP) {
      await triggerOtpSubmit(otp);
      return;
    }

    if (isSettingNewPassword) {
      if (!newPasswordVal) {
        newErrors.password = "New password is required";
      } else if (newPasswordVal.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }
      if (newPasswordVal !== confirmPassword) {
        newErrors.newPassword = "Passwords do not match";
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      setErrors({});
      setIsLoading(true);
      try {
        await resetPassword(newPasswordVal, resetToken);
        setIsSettingNewPassword(false);
        setIsResetSent(true);
      } catch (err: any) {
        setErrors({ general: err.message || "Failed to reset password." });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "signup" && !name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (mode !== "forgot-password") {
      if (!password) {
        newErrors.password = "Password is required";
      } else if (mode === "signup" && password.length < 6) {
        newErrors.password = "Password must be at least 6 characters";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      if (mode === "forgot-password") {
        await forgotPassword(email);
        setIsVerifyingResetOTP(true);
        setOtp(Array(6).fill(""));
      } else if (mode === "signup") {
        const result = await signUp(email, password, name);
        if (result.requireEmailVerification) {
          setIsVerifyingOTP(true);
          setOtp(Array(6).fill(""));
        }
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setErrors({ general: err.message || "Authentication failed." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setIsResetSent(false);
    setIsVerifyingResetOTP(false);
    setIsSettingNewPassword(false);
    setIsLoading(false);
    setPassword("");
    setOtp(Array(6).fill(""));
    setNewPasswordVal("");
    setConfirmPassword("");
  };

  return (
    <main className={`h-dvh overflow-hidden p-5 font-body text-text-primary md:p-6 flex items-center justify-center transition-colors duration-300 animate-fade-in ${isDark ? "dark bg-[#010409]" : "bg-surface-secondary"}`}>
      <section
        className="grid w-full max-w-[1100px] overflow-hidden rounded-[24px] border border-border bg-surface shadow-md lg:grid-cols-[50fr_50fr] transition-colors duration-300"
        style={{ height: "min(740px, calc(100dvh - 48px))" }}
      >
        <aside className="relative flex h-full flex-col justify-start overflow-hidden bg-code-background px-8 pt-8 pb-[300px] lg:px-12 lg:pt-10 lg:pb-[330px] text-code-foreground">
          <img
            src="/grid.svg"
            alt=""
            className="absolute inset-0 z-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 z-0 bg-code-background/20" />
          <div className="login-panel-scrim absolute inset-0 z-0" />
          <img
            src="/login.png"
            alt=""
            className="absolute bottom-0 left-0 z-10 w-full h-[300px] lg:h-[330px] object-cover pointer-events-none"
          />

          <div className="relative z-20 flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="DevBook"
              className="h-15 w-15"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <p className="text-4xl font-semibold leading-none text-white font-heading">
              Dev<span className="text-[#818CF8]">Book</span>
            </p>
          </div>

          <div className="relative z-20 mt-1 max-w-lg">
            <h1 className="text-[40px] font-bold leading-[1.08] tracking-[-0.03em] text-white font-heading">
              Learn deeper.
              <br />
              Build better.
            </h1>
            <p className="mt-3.5 max-w-[340px] text-[15px] leading-7 text-code-foreground/80 font-body">
              DevBook is where developers publish in-depth guides and millions
              learn, build and ship better software.
            </p>
          </div>

          <div className="relative z-20 mt-4 flex max-w-md flex-col gap-5">
            {features.map((feature) => (
              <FeatureRow key={feature.title} feature={feature} />
            ))}
          </div>
        </aside>

        <section className="relative flex h-full items-center justify-center bg-background px-8 lg:px-12">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
            className="group absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-primary shadow-xs transition-all duration-300 ease-in-out hover:bg-surface-secondary hover:shadow-md hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary overflow-hidden"
          >
            <div className="relative h-4.5 w-4.5">
              <Sun
                className={`absolute inset-0 h-4.5 w-4.5 transition-all duration-500 ease-in-out transform ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100 group-hover:rotate-45"}`}
                aria-hidden="true"
              />
              <Moon
                className={`absolute inset-0 h-4.5 w-4.5 transition-all duration-500 ease-in-out transform ${isDark ? "rotate-0 scale-100 opacity-100 group-hover:-rotate-90" : "-rotate-90 scale-0 opacity-0"}`}
                aria-hidden="true"
              />
            </div>
          </button>

          <div className="w-full max-w-[400px] pt-2 pb-12">
            {isResetSent ? (
              <div className="flex flex-col items-center text-center py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light text-success">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-2xl font-bold text-text-primary font-heading">
                  Password Reset!
                </h3>
                <p className="mt-2 text-sm text-text-secondary font-body leading-relaxed">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className="mt-8 h-11 w-full rounded-md bg-code-background px-5 text-sm font-semibold text-code-foreground shadow-md transition-colors duration-150 hover:bg-[#1E293B] dark:hover:bg-[#2D3748] focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-body"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <>
                <div className="text-center">
                  <h2 className="text-[32px] font-bold leading-tight tracking-[-0.03em] text-text-primary font-heading">
                    {mode === "login" && "Welcome back"}
                    {mode === "signup" && isVerifyingOTP && "Verify your email"}
                    {mode === "signup" && !isVerifyingOTP && "Create account"}
                    {mode === "forgot-password" && isVerifyingResetOTP && "Verify reset code"}
                    {mode === "forgot-password" && isSettingNewPassword && "Reset your password"}
                    {mode === "forgot-password" && !isVerifyingResetOTP && !isSettingNewPassword && "Reset password"}
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary font-body">
                    {mode === "login" && "Login to continue your learning journey 👋"}
                    {mode === "signup" && isVerifyingOTP && `Enter the 6-digit code sent to ${email}`}
                    {mode === "signup" && !isVerifyingOTP && "Start building real projects with DevBook 🚀"}
                    {mode === "forgot-password" && isVerifyingResetOTP && "Enter the 6-digit verification code sent to your email"}
                    {mode === "forgot-password" && isSettingNewPassword && "Set a new password for your account"}
                    {mode === "forgot-password" && !isVerifyingResetOTP && !isSettingNewPassword && "Enter your email to receive a password reset link 🔑"}
                  </p>
                </div>

                {mode !== "forgot-password" && !isVerifyingOTP && (
                  <>
                    <div className="mt-5 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => handleOAuth("github")}
                        className="flex h-11 items-center justify-center gap-3.5 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-xs transition-colors duration-150 hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      >
                        <img src="/github.svg" alt="" className="h-5 w-5" />
                        Continue with GitHub
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOAuth("google")}
                        className="flex h-11 items-center justify-center gap-3.5 rounded-md border border-border bg-surface px-4 text-sm font-semibold text-text-primary shadow-xs transition-colors duration-150 hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      >
                        <img src="/google.svg" alt="" className="h-5 w-5" />
                        Continue with Google
                      </button>
                    </div>

                    <div className="my-5 flex items-center gap-4 text-text-secondary">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-sm">or</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

                <form onSubmit={handleFormSubmit} className="relative flex flex-col gap-3.5 mt-5">
                  {errors.general && (
                    <div className="p-3 text-xs font-semibold text-danger bg-danger-light border border-danger/10 rounded-md">
                      {errors.general}
                    </div>
                  )}

                  {isVerifyingOTP && (
                    <div className="flex flex-col gap-3.5">
                      <label className="flex flex-col gap-2.5 text-xs font-semibold text-text-secondary font-body">
                        6-Digit OTP Code
                        <div className="flex justify-between gap-2 mt-1">
                          {otp.map((digit, idx) => (
                            <input
                              key={idx}
                              type="text"
                              maxLength={1}
                              value={digit}
                              disabled={isLoading}
                              ref={(el) => { otpRefs.current[idx] = el; }}
                              onChange={(e) => handleOtpChange(e.target.value, idx)}
                              onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                              onPaste={handlePaste}
                              className={`w-12 h-12 text-center text-xl font-normal border rounded-md bg-surface text-text-primary outline-none focus:ring-2 focus:ring-primary ${errors.otp ? "border-danger" : "border-border"} disabled:opacity-50`}
                            />
                          ))}
                        </div>
                        {errors.otp && (
                          <span className="mt-1.5 text-xs font-medium text-danger">
                            {errors.otp}
                          </span>
                        )}
                      </label>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-2 h-11 flex items-center justify-center rounded-md bg-code-background px-6 text-sm font-semibold text-code-foreground shadow-md transition-colors duration-150 hover:bg-[#1E293B] dark:hover:bg-[#2D3748] focus:outline-none focus:ring-2 focus:ring-primary font-body cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Verifying OTP...
                          </>
                        ) : (
                          "Verify & Create Account"
                        )}
                      </button>
                      <div className="text-center mt-2 text-xs font-body">
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={isLoading || resendCooldown > 0}
                          className="text-primary hover:underline font-semibold disabled:text-text-muted disabled:no-underline cursor-pointer bg-transparent border-none p-0"
                        >
                          {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend verification code"}
                        </button>
                      </div>
                    </div>
                  )}

                  {isVerifyingResetOTP && (
                    <div className="flex flex-col gap-3.5">
                      <label className="flex flex-col gap-2.5 text-xs font-semibold text-text-secondary font-body">
                        6-Digit OTP Code
                        <div className="flex justify-between gap-2 mt-1">
                          {otp.map((digit, idx) => (
                            <input
                              key={idx}
                              type="text"
                              maxLength={1}
                              value={digit}
                              disabled={isLoading}
                              ref={(el) => { otpRefs.current[idx] = el; }}
                              onChange={(e) => handleOtpChange(e.target.value, idx)}
                              onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                              onPaste={handlePaste}
                              className={`w-12 h-12 text-center text-xl font-normal border rounded-md bg-surface text-text-primary outline-none focus:ring-2 focus:ring-primary ${errors.otp ? "border-danger" : "border-border"} disabled:opacity-50`}
                            />
                          ))}
                        </div>
                        {errors.otp && (
                          <span className="mt-1.5 text-xs font-medium text-danger">
                            {errors.otp}
                          </span>
                        )}
                      </label>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-2 h-11 flex items-center justify-center rounded-md bg-code-background px-6 text-sm font-semibold text-code-foreground shadow-md transition-colors duration-150 hover:bg-[#1E293B] dark:hover:bg-[#2D3748] focus:outline-none focus:ring-2 focus:ring-primary font-body cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Verifying OTP...
                          </>
                        ) : (
                          "Verify OTP Code"
                        )}
                      </button>
                    </div>
                  )}

                  {isSettingNewPassword && (
                    <div className="flex flex-col gap-3.5">
                      <label className="flex flex-col gap-2 text-xs font-semibold text-text-secondary font-body">
                        New Password
                        <span className={`flex h-11 items-center gap-3.5 rounded-md border bg-surface px-4 text-text-muted shadow-xs focus-within:ring-2 focus-within:ring-primary ${errors.password ? "border-danger" : "border-border"}`}>
                          <LockKeyhole className="h-4.5 w-4.5" aria-hidden="true" />
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={newPasswordVal}
                            disabled={isLoading}
                            onChange={(e) => handleNewPasswordChange(e.target.value)}
                            placeholder="Min. 6 characters"
                            className="h-full min-w-0 flex-1 bg-transparent text-lg font-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="text-text-muted hover:text-text-primary focus:outline-none cursor-pointer"
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                            )}
                          </button>
                        </span>
                        {errors.password && (
                          <span className="mt-0.5 text-xs font-medium text-danger">
                            {errors.password}
                          </span>
                        )}
                      </label>

                      <label className="flex flex-col gap-2 text-xs font-semibold text-text-secondary font-body">
                        Confirm New Password
                        <span className={`flex h-11 items-center gap-3.5 rounded-md border bg-surface px-4 text-text-muted shadow-xs focus-within:ring-2 focus-within:ring-primary ${errors.newPassword ? "border-danger" : "border-border"}`}>
                          <LockKeyhole className="h-4.5 w-4.5" aria-hidden="true" />
                          <input
                            type={showNewPassword ? "text" : "password"}
                            value={confirmPassword}
                            disabled={isLoading}
                            onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                            placeholder="Confirm your password"
                            className="h-full min-w-0 flex-1 bg-transparent text-lg font-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
                          />
                        </span>
                        {errors.newPassword && (
                          <span className="mt-0.5 text-xs font-medium text-danger">
                            {errors.newPassword}
                          </span>
                        )}
                      </label>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-2 h-11 flex items-center justify-center rounded-md bg-code-background px-6 text-sm font-semibold text-code-foreground shadow-md transition-colors duration-150 hover:bg-[#1E293B] dark:hover:bg-[#2D3748] focus:outline-none focus:ring-2 focus:ring-primary font-body cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Resetting password...
                          </>
                        ) : (
                          "Reset Password"
                        )}
                      </button>
                    </div>
                  )}

                  {!isVerifyingOTP && !isVerifyingResetOTP && !isSettingNewPassword && (
                    <>
                      {mode === "signup" && (
                        <label className="flex flex-col gap-2 text-xs font-semibold text-text-secondary font-body">
                          Name
                          <span className={`flex h-11 items-center gap-3.5 rounded-md border bg-surface px-4 text-text-muted shadow-xs focus-within:ring-2 focus-within:ring-primary ${errors.name ? "border-danger" : "border-border"}`}>
                            <User className="h-4.5 w-4.5" aria-hidden="true" />
                            <input
                              type="text"
                              value={name}
                              disabled={isLoading}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Your full name"
                              className="h-full min-w-0 flex-1 bg-transparent text-lg font-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
                            />
                          </span>
                          {errors.name && (
                            <span className="mt-0.5 text-xs font-medium text-danger">
                              {errors.name}
                            </span>
                          )}
                        </label>
                      )}

                      <label className="flex flex-col gap-2 text-xs font-semibold text-text-secondary font-body">
                        Email
                        <span className={`flex h-11 items-center gap-3.5 rounded-md border bg-surface px-4 text-text-muted shadow-xs focus-within:ring-2 focus-within:ring-primary ${errors.email ? "border-danger" : "border-border"}`}>
                          <Mail className="h-4.5 w-4.5" aria-hidden="true" />
                          <input
                            type="text"
                            value={email}
                            disabled={isLoading}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="h-full min-w-0 flex-1 bg-transparent text-lg font-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
                          />
                        </span>
                        {errors.email && (
                          <span className="mt-0.5 text-xs font-medium text-danger">
                            {errors.email}
                          </span>
                        )}
                      </label>

                      {mode !== "forgot-password" && (
                        <label className="flex flex-col gap-2 text-xs font-semibold text-text-secondary font-body">
                          Password
                          <span className={`flex h-11 items-center gap-3.5 rounded-md border bg-surface px-4 text-text-muted shadow-xs focus-within:ring-2 focus-within:ring-primary ${errors.password ? "border-danger" : "border-border"}`}>
                            <LockKeyhole className="h-4.5 w-4.5" aria-hidden="true" />
                            <input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              disabled={isLoading}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                              className="h-full min-w-0 flex-1 bg-transparent text-lg font-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-text-muted hover:text-text-primary focus:outline-none cursor-pointer"
                            >
                              {showPassword ? (
                                <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                              )}
                            </button>
                          </span>
                          {errors.password && (
                            <span className="mt-0.5 text-xs font-medium text-danger">
                              {errors.password}
                            </span>
                          )}
                        </label>
                      )}

                      {mode === "login" && (
                        <div className="flex items-center justify-between gap-4 text-xs font-body">
                          <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="h-4 w-4 accent-primary text-primary rounded border-border focus:ring-primary"
                            />
                            Remember me
                          </label>
                          <button
                            type="button"
                            onClick={() => handleModeChange("forgot-password")}
                            className="font-semibold text-primary hover:text-primary-hover cursor-pointer bg-transparent border-none p-0"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="mt-1 h-11 flex items-center justify-center rounded-md bg-code-background px-6 text-sm font-semibold text-code-foreground shadow-md transition-colors duration-150 hover:bg-[#1E293B] dark:hover:bg-[#2D3748] focus:outline-none focus:ring-2 focus:ring-primary font-body cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {mode === "login" && "Logging in..."}
                            {mode === "signup" && "Signing up..."}
                            {mode === "forgot-password" && "Sending reset OTP..."}
                          </>
                        ) : (
                          <>
                            {mode === "login" && "Login"}
                            {mode === "signup" && "Sign Up"}
                            {mode === "forgot-password" && "Send Reset OTP"}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>

                <div className="mt-5 text-center text-xs text-text-secondary font-body">
                  {mode === "login" && (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => handleModeChange("signup")}
                        className="font-semibold text-primary hover:text-primary-hover cursor-pointer bg-transparent border-none p-0"
                      >
                        Create one
                      </button>
                    </>
                  )}
                  {mode === "signup" && (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => handleModeChange("login")}
                        className="font-semibold text-primary hover:text-primary-hover cursor-pointer bg-transparent border-none p-0"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                  {mode === "forgot-password" && (
                    <button
                      type="button"
                      onClick={() => handleModeChange("login")}
                      className="font-semibold text-primary hover:text-primary-hover cursor-pointer bg-transparent border-none p-0"
                    >
                      Back to login
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2.5 text-xs text-text-secondary font-body whitespace-nowrap">
            <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
            Secure &amp; private. We never share your data.
          </p>
        </section>
      </section>
    </main>
  );
}

function FeatureRow({ feature }: { feature: FeatureItem }) {
  const Icon = feature.icon;

  return (
    <article className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1e1e38]/80 border border-white/5 text-indigo-400 shadow-xs">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-white font-heading">
          {feature.title}
        </h2>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-code-foreground/60 font-body">
          {feature.description}
        </p>
      </div>
    </article>
  );
}
