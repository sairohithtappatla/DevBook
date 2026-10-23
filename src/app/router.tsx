import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { PublicRoute } from "@/components/layout/RouteGuards";
import { LoginPage } from "@/routes/login/LoginPage";
import { LandingPage } from "@/routes/landing/LandingPage";
import { OAuthConsentPage } from "@/routes/oauth/OAuthConsentPage";
import {
  AuthenticatedLayout,
  HomeRouteComponent,
  FeaturedRouteComponent,
  BooksRouteComponent,
  ProgressRouteComponent,
  ProfileRouteComponent,
  AuthorsRouteComponent,
  SettingsRouteComponent,
  ReaderRouteComponent,
  EditorRouteComponent,
} from "@/app/route-components";

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

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: AuthenticatedLayout,
});

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

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings",
  component: SettingsRouteComponent,
});

// OAuth consent ("Connect DevBook"): outside the app shell; handles signed-out visitors itself
const oauthAuthorizeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/authorize",
  component: OAuthConsentPage,
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
    settingsRoute,
  ]),
  oauthAuthorizeRoute,
  readerRoute,
  editorRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
