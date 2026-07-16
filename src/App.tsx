import { useState } from "react";
import { AuthProvider } from "@/providers/AuthProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { SearchProvider } from "@/providers/SearchProvider";
import { useAuth } from "@/hooks/useAuth";
import { PublicRoute, ProtectedRoute } from "@/components/layout/RouteGuards";
import { LoginPage } from "@/routes/login/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage, HomeRightPanel } from "@/routes/home/HomePage";
import { FeaturedBooksPage } from "@/routes/featured/FeaturedBooksPage";
import { MyBooksPage } from "@/routes/books/MyBooksPage";
import { BookEditorPage } from "@/routes/books/BookEditorPage";
import { BookReaderPage } from "@/routes/books/BookReaderPage";
import { ProgressPage } from "@/routes/progress/ProgressPage";
import { ProfilePage } from "@/routes/profile/ProfilePage";
import { Loader2 } from "lucide-react";

function AppContent() {
  const { isInitializing, isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState("home");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [readingBookId, setReadingBookId] = useState<string | null>(null);

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
            onBookSelect={(book) => setReadingBookId(book.id)}
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
        return <MyBooksPage onEditBook={setEditingBookId} onViewBook={setReadingBookId} />;
      case "progress":
        return <ProgressPage onBookSelect={setReadingBookId} />;
      case "profile":
        return <ProfilePage />;
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
  if (editingBookId) {
    return (
      <ProtectedRoute>
        <BookEditorPage
          bookId={editingBookId}
          onBack={() => setEditingBookId(null)}
          onPreview={() => {
            setReadingBookId(editingBookId);
            setEditingBookId(null);
          }}
        />
      </ProtectedRoute>
    );
  }

  if (readingBookId) {
    return (
      <ProtectedRoute>
        <BookReaderPage
          bookId={readingBookId}
          onBack={() => setReadingBookId(null)}
          onEdit={() => {
            setEditingBookId(readingBookId);
            setReadingBookId(null);
          }}
        />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SearchProvider>
        <AppShell
          currentTab={currentTab}
          onChangeTab={setCurrentTab}
          rightPanelContent={getRightPanelContent()}
          showSearch={currentTab === "home" || currentTab === "featured" || currentTab === "progress" || currentTab === "profile"}
          showTopNavigation={currentTab !== "books" && currentTab !== "progress" && currentTab !== "profile"}
          title={
            currentTab === "featured"
              ? "Featured Books"
              : currentTab === "books"
              ? "My Books"
              : currentTab === "progress"
              ? "My Progress"
              : currentTab === "profile"
              ? "My Profile"
              : undefined
          }
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
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
