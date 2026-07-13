import { insforge } from "@/lib/insforge";
import { type User, type Session, type UserRole } from "@/types/user";

export const AUTH_ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect email or password.",
  USER_NOT_FOUND: "No account exists with this email.",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  INVALID_OTP: "Invalid verification code. Please check and try again.",
  OTP_EXPIRED: "The verification code has expired. Please request a new one.",
  WEAK_PASSWORD: "Password must be at least 6 characters long.",
  DEFAULT: "An unexpected error occurred. Please try again."
};

function mapError(error: any): Error {
  if (!error) return new Error(AUTH_ERRORS.DEFAULT);
  const errorCode = error.error || "";
  const friendlyMessage = AUTH_ERRORS[errorCode] || error.message || AUTH_ERRORS.DEFAULT;
  const newErr = new Error(friendlyMessage);
  (newErr as any).code = errorCode;
  return newErr;
}

function mapUser(sdkUser: any): User {
  // If the user metadata contains a role, use it; otherwise default to "USER"
  const role: UserRole = (sdkUser.profile?.role || sdkUser.metadata?.role || "USER") as UserRole;
  return {
    id: sdkUser.id,
    email: sdkUser.email,
    emailVerified: sdkUser.emailVerified || false,
    providers: sdkUser.providers || [],
    role,
    profile: {
      name: sdkUser.profile?.name,
      avatar_url: sdkUser.profile?.avatar_url,
      bio: sdkUser.profile?.bio,
    },
    metadata: sdkUser.metadata || {},
    createdAt: sdkUser.createdAt,
    updatedAt: sdkUser.updatedAt,
  };
}

export const AuthService = {
  async signUp(email: string, password: string, name?: string): Promise<{ user: User | null; requireEmailVerification: boolean }> {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
    });
    if (error) throw mapError(error);
    return {
      user: data?.user ? mapUser(data.user) : null,
      requireEmailVerification: data?.requireEmailVerification || false,
    };
  },

  async signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw mapError(error);
    if (!data) throw new Error(AUTH_ERRORS.DEFAULT);
    return {
      user: mapUser(data.user),
      session: {
        accessToken: data.accessToken,
        expiresAt: null, // access token expiration is handled by sdk cookie
      },
    };
  },

  async verifyEmail(email: string, otp: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await insforge.auth.verifyEmail({
      email,
      otp,
    });
    if (error) throw mapError(error);
    if (!data) throw new Error(AUTH_ERRORS.DEFAULT);
    return {
      user: mapUser(data.user),
      session: {
        accessToken: data.accessToken,
        expiresAt: null,
      },
    };
  },

  async resendVerificationCode(email: string): Promise<boolean> {
    const { data, error } = await insforge.auth.resendVerificationEmail({
      email,
    });
    if (error) throw mapError(error);
    return !!data?.success;
  },

  async sendResetPasswordEmail(email: string): Promise<boolean> {
    const { data, error } = await insforge.auth.sendResetPasswordEmail({
      email,
    });
    if (error) throw mapError(error);
    return !!data?.success;
  },

  async exchangeResetPasswordToken(email: string, code: string): Promise<string> {
    const { data, error } = await insforge.auth.exchangeResetPasswordToken({
      email,
      code,
    });
    if (error) throw mapError(error);
    if (!data) throw new Error(AUTH_ERRORS.DEFAULT);
    return data.token;
  },

  async resetPassword(newPassword: string, token: string): Promise<boolean> {
    const { data, error } = await insforge.auth.resetPassword({
      newPassword,
      otp: token,
    });
    if (error) throw mapError(error);
    return !!data;
  },

  async signOut(): Promise<void> {
    const { error } = await insforge.auth.signOut();
    if (error) throw mapError(error);
  },

  async getCurrentUser(): Promise<{ user: User | null }> {
    const { data, error } = await insforge.auth.getCurrentUser();
    if (error) {
      // 401 Unauthorized or lack of refresh token means the guest is not logged in.
      if (error.statusCode === 401 || error.message?.includes("No refresh token")) {
        return { user: null };
      }
      throw mapError(error);
    }
    return {
      user: data?.user ? mapUser(data.user) : null,
    };
  },
};
