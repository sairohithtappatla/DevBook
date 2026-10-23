import { createContext } from "react";
import { type User, type Session } from "@/types/user";

export const AuthState = {
  INITIALIZING: "INITIALIZING",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  SIGNING_UP: "SIGNING_UP",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  AUTHENTICATED: "AUTHENTICATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  RESETTING_PASSWORD: "RESETTING_PASSWORD"
} as const;

export type AuthState = typeof AuthState[keyof typeof AuthState];

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  authState: AuthState;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isInitializing: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ user: User | null; requireEmailVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<{ user: User; session: Session }>;
  verifyEmail: (email: string, otp: string) => Promise<{ user: User; session: Session }>;
  resendCode: (email: string) => Promise<boolean>;
  forgotPassword: (email: string) => Promise<boolean>;
  exchangeResetCode: (email: string, code: string) => Promise<string>;
  resetPassword: (newPassword: string, token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
