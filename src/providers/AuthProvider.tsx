import { createContext, useState, useEffect, type ReactNode } from "react";
import { AuthService } from "@/services/auth.service";
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

type Props = {
  children: ReactNode;
};

const SYNC_STORAGE_KEY = "devbook_auth_sync";

import { DBService } from "@/services/db";

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authState, setAuthState] = useState<AuthState>(AuthState.INITIALIZING);

  // Derive states
  const isAuthenticated = authState === AuthState.AUTHENTICATED;
  const isEmailVerified = user ? user.emailVerified : false;
  const isInitializing = authState === AuthState.INITIALIZING;

  // Mount session restoration check
  useEffect(() => {
    async function initSession() {
      try {
        const { user: currentUser } = await AuthService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          if (currentUser.emailVerified) {
            setAuthState(AuthState.AUTHENTICATED);
          } else {
            setAuthState(AuthState.PENDING_VERIFICATION);
          }
        } else {
          setAuthState(AuthState.UNAUTHENTICATED);
        }
      } catch (err) {
        console.error("Failed to restore auth session:", err);
        setAuthState(AuthState.UNAUTHENTICATED);
      }
    }
    initSession();
  }, []);

  // Multi-tab synchronization
  useEffect(() => {
    const handleStorageChange = async (event: StorageEvent) => {
      if (event.key === SYNC_STORAGE_KEY) {
        // Run a verification from server to ensure state aligns
        try {
          const { user: currentUser } = await AuthService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
            setAuthState(currentUser.emailVerified ? AuthState.AUTHENTICATED : AuthState.PENDING_VERIFICATION);
          } else {
            setUser(null);
            setSession(null);
            setAuthState(AuthState.UNAUTHENTICATED);
          }
        } catch (err) {
          console.error("Failed to sync auth state across tabs:", err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Guarantee profile exists in database 'users' table
  useEffect(() => {
    if (authState === AuthState.AUTHENTICATED && user?.id) {
      DBService.getProfile(user.id).then((profile) => {
        if (!profile) {
          const fallbackName = user.profile?.name || "DevBook User";
          const username = fallbackName.toLowerCase().replace(/\s+/g, "_") + "_" + Math.floor(Math.random() * 1000);
          const bioJson = JSON.stringify({
            title: "Developer",
            location: "Remote",
            about: "Full Stack Engineer building projects.",
            socials: { github: "", linkedin: "", portfolio: "", email: "" },
            username,
          });

          DBService.updateProfile(user.id, {
            name: fallbackName,
            avatar_url: user.profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
            bio: bioJson,
          }).then(() => {
            console.log("Successfully auto-created user profile in users table.");
          }).catch((err) => {
            console.error("Error auto-creating user profile:", err);
          });
        }
      }).catch((err) => {
        console.error("Error checking user profile in users table:", err);
      });
    }
  }, [authState, user]);

  const triggerTabSync = () => {
    localStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
  };

  const signUp = async (email: string, password: string, name?: string) => {
    setAuthState(AuthState.SIGNING_UP);
    try {
      const result = await AuthService.signUp(email, password, name);
      if (result.requireEmailVerification) {
        setAuthState(AuthState.PENDING_VERIFICATION);
      } else if (result.user) {
        setUser(result.user);
        setAuthState(AuthState.AUTHENTICATED);
        triggerTabSync();
      } else {
        setAuthState(AuthState.UNAUTHENTICATED);
      }
      return result;
    } catch (error) {
      setAuthState(AuthState.UNAUTHENTICATED);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await AuthService.signIn(email, password);
      setUser(result.user);
      setSession(result.session);
      if (result.user.emailVerified) {
        setAuthState(AuthState.AUTHENTICATED);
      } else {
        setAuthState(AuthState.PENDING_VERIFICATION);
      }
      triggerTabSync();
      return result;
    } catch (error) {
      setAuthState(AuthState.UNAUTHENTICATED);
      throw error;
    }
  };

  const verifyEmail = async (email: string, otp: string) => {
    try {
      const result = await AuthService.verifyEmail(email, otp);
      setUser(result.user);
      setSession(result.session);
      setAuthState(AuthState.AUTHENTICATED);
      triggerTabSync();
      return result;
    } catch (error) {
      throw error;
    }
  };

  const resendCode = async (email: string) => {
    return await AuthService.resendVerificationCode(email);
  };

  const forgotPassword = async (email: string) => {
    const success = await AuthService.sendResetPasswordEmail(email);
    if (success) {
      setAuthState(AuthState.RESETTING_PASSWORD);
    }
    return success;
  };

  const exchangeResetCode = async (email: string, code: string) => {
    return await AuthService.exchangeResetPasswordToken(email, code);
  };

  const resetPassword = async (newPassword: string, token: string) => {
    const success = await AuthService.resetPassword(newPassword, token);
    if (success) {
      setAuthState(AuthState.UNAUTHENTICATED);
      triggerTabSync();
    }
    return success;
  };

  const signOut = async () => {
    try {
      await AuthService.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setUser(null);
      setSession(null);
      setAuthState(AuthState.UNAUTHENTICATED);
      triggerTabSync();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        authState,
        isAuthenticated,
        isEmailVerified,
        isInitializing,
        signUp,
        signIn,
        verifyEmail,
        resendCode,
        forgotPassword,
        exchangeResetCode,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
