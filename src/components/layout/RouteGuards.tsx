import { type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/routes/login/LoginPage";

type GuardProps = {
  children: ReactNode;
};

/**
 * Route guard that requires the user to be signed in.
 * If not authenticated, it renders the login page.
 * If authenticated but email is unverified, it renders the login page (which handles OTP verification).
 */
export function ProtectedRoute({ children }: GuardProps) {
  const { isAuthenticated, isEmailVerified } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!isEmailVerified) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

/**
 * Route guard for public-only pages (like login/register).
 * If the user is authenticated and verified, it redirects to the main app dashboard.
 * If authenticated but unverified, it renders the verify email page.
 */
export function PublicRoute({ children }: GuardProps) {
  const { isAuthenticated, isEmailVerified } = useAuth();

  if (isAuthenticated && isEmailVerified) {
    // Render the mock dashboard when authenticated.
    return (
      <ProtectedRoute>
        {children}
      </ProtectedRoute>
    );
  }

  if (isAuthenticated && !isEmailVerified) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

/**
 * Route guard that requires email verification.
 * If authenticated but not verified, redirects to the login page.
 */
export function EmailVerifiedRoute({ children }: GuardProps) {
  const { isAuthenticated, isEmailVerified } = useAuth();

  if (isAuthenticated && !isEmailVerified) {
    return <LoginPage />;
  }

  return <>{children}</>;
}
