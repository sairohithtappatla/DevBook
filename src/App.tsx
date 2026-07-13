import { useState } from "react";
import { AuthProvider } from "@/providers/AuthProvider";
import { SearchProvider } from "@/providers/SearchProvider";
import { useAuth } from "@/hooks/useAuth";
import { PublicRoute, ProtectedRoute } from "@/components/layout/RouteGuards";
import { LoginPage } from "@/routes/login/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage, HomeRightPanel } from "@/routes/home/HomePage";
import { FeaturedBooksPage } from "@/routes/featured/FeaturedBooksPage";
import { MyBooksPage } from "@/routes/books/MyBooksPage";
import { PageContainer } from "@/components/layout/PageContainer";
import { Loader2, Plus, Sparkles } from "lucide-react";

function AppContent() {
  const { isInitializing, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState("All");

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

  // Define tab navigation rendering
  const renderTabContent = () => {
    switch (currentTab) {
      case "home":
        return (
          <HomePage
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onExploreBooks={() => setCurrentTab("featured")}
            onCreateBook={() => setCurrentTab("books")}
          />
        );
      case "featured":
        return (
          <FeaturedBooksPage
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        );
      case "books":
        return <MyBooksPage />;
      case "progress":
        return (
          <PageContainer>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold">My Progress</h1>
            <div className="flex flex-col items-center justify-center p-12 bg-surface border border-dashed border-border rounded-xl text-center min-h-[300px]">
              <p className="font-body text-text-secondary text-sm">Tracked learning books and phase completions will display here.</p>
            </div>
          </PageContainer>
        );
      case "profile":
        return (
          <PageContainer>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold">My Profile</h1>
            <div className="flex flex-col items-center justify-center p-12 bg-surface border border-dashed border-border rounded-xl text-center min-h-[300px]">
              <p className="font-body text-text-secondary text-sm">Your public profile, bio, followers, and published books will display here.</p>
            </div>
          </PageContainer>
        );
      default:
        return null;
    }
  };

  const getRightPanelContent = () => {
    if (currentTab === "home") {
      return (
        <HomeRightPanel
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onCreateBook={() => setCurrentTab("books")}
        />
      );
    }
    return null;
  };

  // 3. Authenticated View (with ProtectedRoute guard wrapper)
  return (
    <ProtectedRoute>
      <SearchProvider>
        <AppShell
          currentTab={currentTab}
          onChangeTab={setCurrentTab}
          rightPanelContent={getRightPanelContent()}
          showSearch={currentTab === "home" || currentTab === "featured" || currentTab === "books"}
          title={currentTab === "featured" ? "Featured Books" : currentTab === "books" ? "My Books" : undefined}
        >
          {renderTabContent()}
        </AppShell>
      </SearchProvider>
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
