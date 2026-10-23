import {
  Outlet,
  useNavigate,
  useLocation,
  useParams,
} from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/RouteGuards";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage, HomeRightPanel } from "@/routes/home/HomePage";
import { FeaturedBooksPage } from "@/routes/featured/FeaturedBooksPage";
import { MyBooksPage } from "@/routes/books/MyBooksPage";
import { BookEditorPage } from "@/routes/books/BookEditorPage";
import { BookReaderPage } from "@/routes/books/BookReaderPage";
import { ProgressPage } from "@/routes/progress/ProgressPage";
import { ProfilePage } from "@/routes/profile/ProfilePage";
import { AuthorsPage } from "@/routes/authors/AuthorsPage";
import { SettingsPage } from "@/routes/settings/SettingsPage";
import { useReaderBook } from "@/hooks/useBooks";
import { Loader2 } from "lucide-react";
import { SearchProvider } from "@/providers/SearchProvider";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/useToast";

// 3. Layout for authenticated tab routes
export const AuthenticatedLayout = () => {
  const { isInitializing, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      showToast("Please login", "info");
      navigate({ to: "/login" });
    }
  }, [isInitializing, isAuthenticated, showToast, navigate]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-secondary text-text-primary">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="font-heading text-lg font-medium">Restoring session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const path = location.pathname;
  let currentTab = "home";
  if (path === "/featured") currentTab = "featured";
  else if (path === "/books") currentTab = "books";
  else if (path === "/progress") currentTab = "progress";
  else if (path === "/authors") currentTab = "authors";
  else if (path === "/profile") currentTab = "profile";
  else if (path === "/settings") currentTab = "settings";

  const getRightPanelContent = () => {
    if (currentTab === "home") {
      return (
        <HomeRightPanel
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onCreateBook={() => navigate({ to: "/books" })}
        />
      );
    }
    return null;
  };

  return (
    <ProtectedRoute>
      <SearchProvider>
        <AppShell
          currentTab={currentTab}
          onChangeTab={(tab) => navigate({ to: tab === "home" ? "/home" : "/" + tab })}
          rightPanelContent={getRightPanelContent()}
          showSearch={currentTab === "home" || currentTab === "featured" || currentTab === "progress" || currentTab === "profile" || currentTab === "authors"}
          showTopNavigation={currentTab !== "books" && currentTab !== "progress" && currentTab !== "profile" && currentTab !== "authors" && currentTab !== "settings"}
          title={
            currentTab === "featured"
              ? "Featured Books"
              : currentTab === "books"
              ? "My Books"
              : currentTab === "progress"
              ? "My Progress"
              : currentTab === "authors"
              ? "Authors"
              : currentTab === "profile"
              ? "My Profile"
              : currentTab === "settings"
              ? "Settings"
              : undefined
          }
        >
          <Outlet />
        </AppShell>
      </SearchProvider>
    </ProtectedRoute>
  );
};

// 4. Tab Routes Components
export function HomeRouteComponent() {
  const navigate = useNavigate();
  return (
    <HomePage
      selectedCategory="All"
      onSelectCategory={() => {}}
      onExploreBooks={() => navigate({ to: "/featured" })}
      onCreateBook={() => navigate({ to: "/books" })}
      onBookSelect={(book) => navigate({ to: `/books/${book.id}` })}
    />
  );
}

export function FeaturedRouteComponent() {
  return (
    <FeaturedBooksPage
      selectedCategory="All"
      onSelectCategory={() => {}}
    />
  );
}

export function BooksRouteComponent() {
  const navigate = useNavigate();
  return (
    <MyBooksPage
      onEditBook={(id) => navigate({ to: `/books/${id}/edit` })}
      onViewBook={(id) => navigate({ to: `/books/${id}` })}
    />
  );
}

export function ProgressRouteComponent() {
  const navigate = useNavigate();
  return <ProgressPage onBookSelect={(id) => navigate({ to: `/books/${id}` })} />;
}

export function ProfileRouteComponent() {
  return <ProfilePage />;
}

export function AuthorsRouteComponent() {
  return <AuthorsPage />;
}

export function SettingsRouteComponent() {
  return <SettingsPage />;
}

// 5. Reader & Editor Routes Components
export function ReaderRouteComponent() {
  const { bookId } = useParams({ from: "/books/$bookId" });
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { data: tree } = useReaderBook(bookId);

  const canEdit = isAuthenticated && user && tree && tree.book.created_by === user.id;

  return (
    <BookReaderPage
      bookId={bookId}
      onBack={() => navigate({ to: isAuthenticated ? "/books" : "/" })}
      onEdit={canEdit ? () => navigate({ to: `/books/${bookId}/edit` }) : undefined}
    />
  );
}

export function EditorRouteComponent() {
  const { bookId } = useParams({ from: "/books/$bookId/edit" });
  const navigate = useNavigate();
  return (
    <ProtectedRoute>
      <BookEditorPage
        bookId={bookId}
        onBack={() => navigate({ to: "/books" })}
        onPreview={() => navigate({ to: `/books/${bookId}` })}
      />
    </ProtectedRoute>
  );
}
