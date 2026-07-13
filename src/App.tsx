import { AuthProvider } from "@/providers/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { PublicRoute, ProtectedRoute } from "@/components/layout/RouteGuards";
import { LoginPage } from "@/routes/login/LoginPage";
import { Loader2, LogOut, BookOpen, Shield } from "lucide-react";

function AppContent() {
  const { user, signOut, isInitializing, isAuthenticated } = useAuth();

  // 1. Loading Gate
  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-secondary text-text-primary">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="font-heading text-lg font-medium">Restoring session...</p>
      </div>
    );
  }

  // 2. Unauthenticated View (with PublicRoute guard wrapper)
  if (!isAuthenticated) {
    return (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    );
  }

  // 3. Authenticated View (with ProtectedRoute guard wrapper)
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-background font-body text-text-primary animate-fade-in">
        {/* Left Sidebar */}
        <aside className="w-[280px] bg-sidebar border-r border-border flex flex-col justify-between p-6">
          <div className="space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="DevBook" className="h-8 w-8" />
              <span className="font-heading font-semibold text-lg">
                Dev<span className="text-primary">Book</span>
              </span>
            </div>

            {/* Nav links */}
            <nav className="space-y-1">
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-3 rounded-md bg-primary text-white font-medium shadow-xs"
              >
                <BookOpen className="w-5 h-5" />
                Dashboard
              </a>
            </nav>
          </div>

          {/* User Section / Logout */}
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-light text-primary rounded-full flex items-center justify-center font-heading font-semibold text-sm">
                {user?.profile?.name?.substring(0, 2).toUpperCase() ||
                  user?.email.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {user?.profile?.name || "Developer"}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Role indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-secondary border border-border rounded-full text-xs text-text-secondary w-fit font-medium">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Role: {user?.role}
            </div>

            <button
              onClick={() => signOut()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-border bg-surface hover:bg-surface-secondary text-sm font-medium transition-colors cursor-pointer text-danger hover:border-danger/20 hover:bg-danger-light/10"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-surface-secondary p-8">
          <div className="max-w-[1400px] mx-auto space-y-6">
            <h1 className="font-heading text-3xl font-semibold">Dashboard</h1>
            <p className="font-body text-text-secondary">
              Welcome back to your creator workspace. Authentication logic is now fully verified.
            </p>

            {/* Feature Check Card */}
            <div className="bg-background border border-border rounded-xl p-6 shadow-sm max-w-lg space-y-4">
              <h2 className="font-heading text-xl font-semibold text-success flex items-center gap-2">
                ✓ Authentication Success
              </h2>
              <p className="text-sm text-text-secondary font-body">
                Your session is fully authenticated and protected via Route Guards. Multi-tab synchronization has been enabled; logging out in any other tab will automatically sign out this session.
              </p>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
