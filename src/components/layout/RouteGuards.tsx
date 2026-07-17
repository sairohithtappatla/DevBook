import { type ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";

type GuardProps = {
  children: ReactNode;
};

/**
 * Route guard that requires the user to be signed in.
 * If not authenticated or not verified, redirects to the login page.
 */
export function ProtectedRoute({ children }: GuardProps) {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !isEmailVerified) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isEmailVerified, navigate]);

  if (!isAuthenticated || !isEmailVerified) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Route guard for public-only pages (like login/register).
 * If the user is authenticated and verified, redirects to the main app dashboard.
 */
export function PublicRoute({ children }: GuardProps) {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && isEmailVerified) {
      navigate({ to: "/home" });
    }
  }, [isAuthenticated, isEmailVerified, navigate]);

  if (isAuthenticated && isEmailVerified) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Route guard that requires email verification.
 * If authenticated but not verified, redirects to the login page.
 */
export function EmailVerifiedRoute({ children }: GuardProps) {
  const { isAuthenticated, isEmailVerified } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !isEmailVerified) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isEmailVerified, navigate]);

  if (isAuthenticated && !isEmailVerified) {
    return null;
  }

  return <>{children}</>;
}
