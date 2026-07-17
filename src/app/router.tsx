import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
} from "@tanstack/react-router";
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
import { AuthorsPage } from "@/routes/authors/AuthorsPage";
import { LandingPage } from "@/routes/landing/LandingPage";
import { useBook } from "@/hooks/useBooks";
import { Loader2 } from "lucide-react";
import { SearchProvider } from "@/providers/SearchProvider";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/useToast";

// 1. Root Route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// 2. Login Route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: () => (
    <PublicRoute>
      <LoginPage />
    </PublicRoute>
  ),
});

// 3. Layout for authenticated tab routes
const AuthenticatedLayout = () => {
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
          showTopNavigation={currentTab !== "books" && currentTab !== "progress" && currentTab !== "profile" && currentTab !== "authors"}
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
              : undefined
          }
        >
          <Outlet />
        </AppShell>
      </SearchProvider>
    </ProtectedRoute>
  );
};

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AuthenticatedLayout,
});

// 4. Tab Routes Components
function HomeRouteComponent() {
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

function FeaturedRouteComponent() {
  return (
    <FeaturedBooksPage
      selectedCategory="All"
      onSelectCategory={() => {}}
    />
  );
}

function BooksRouteComponent() {
  const navigate = useNavigate();
  return (
    <MyBooksPage
      onEditBook={(id) => navigate({ to: `/books/${id}/edit` })}
      onViewBook={(id) => navigate({ to: `/books/${id}` })}
    />
  );
}

function ProgressRouteComponent() {
  const navigate = useNavigate();
  return <ProgressPage onBookSelect={(id) => navigate({ to: `/books/${id}` })} />;
}

function ProfileRouteComponent() {
  return <ProfilePage />;
}

function AuthorsRouteComponent() {
  return <AuthorsPage />;
}

// 5. Reader & Editor Routes Components
function ReaderRouteComponent() {
  const { bookId } = useParams({ from: readerRoute.id });
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { data: dbBook } = useBook(bookId);

  const canEdit = isAuthenticated && user && dbBook && dbBook.created_by === user.id;

  return (
    <BookReaderPage
      bookId={bookId}
      onBack={() => navigate({ to: isAuthenticated ? "/books" : "/" })}
      onEdit={canEdit ? () => navigate({ to: `/books/${bookId}/edit` }) : undefined}
    />
  );
}

function EditorRouteComponent() {
  const { bookId } = useParams({ from: editorRoute.id });
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

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const homePathRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/home",
  component: HomeRouteComponent,
});

const featuredRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/featured",
  component: FeaturedRouteComponent,
});

const booksRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/books",
  component: BooksRouteComponent,
});

const progressRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/progress",
  component: ProgressRouteComponent,
});

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/profile",
  component: ProfileRouteComponent,
});

const authorsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/authors",
  component: AuthorsRouteComponent,
});

const readerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/books/$bookId",
  component: ReaderRouteComponent,
});

const editorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/books/$bookId/edit",
  component: EditorRouteComponent,
});

// 6. Router Setup
const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  authenticatedRoute.addChildren([
    homePathRoute,
    featuredRoute,
    booksRoute,
    progressRoute,
    authorsRoute,
    profileRoute,
  ]),
  readerRoute,
  editorRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
