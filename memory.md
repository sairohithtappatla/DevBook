# Memory — InsForge Auth SDK Integration & Unified State Machine

Last updated: 2026-07-13 17:12 IST

## What was built

- **InsForge SDK client & Service Integration**:
  - Configured `@insforge/sdk` client in [insforge.ts](file:///d:/Project/devbook/src/lib/insforge.ts).
  - Created [auth.service.ts](file:///d:/Project/devbook/src/services/auth.service.ts) to interface SDK auth calls, translate network failures, and map backend error states into customer-friendly notifications.
  - Implemented secure password reset flow without user enumeration risks.

- **Unified AuthProvider & Guards**:
  - Built [AuthProvider.tsx](file:///d:/Project/devbook/src/providers/AuthProvider.tsx) employing a single `AuthState` machine (`INITIALIZING`, `UNAUTHENTICATED`, `PENDING_VERIFICATION`, `AUTHENTICATED`, `RESETTING_PASSWORD`).
  - Added multi-tab sync listeners via `StorageEvent` tracking to log users out instantly when another tab terminates the session.
  - Wired page access rules into [RouteGuards.tsx](file:///d:/Project/devbook/src/components/layout/RouteGuards.tsx).

- **Inline Verification & Animations**:
  - Refactored email verification to display inline within the right panel of the [LoginPage.tsx](file:///d:/Project/devbook/src/routes/login/LoginPage.tsx) upon signup or unverified access, with support for clipboard 6-digit OTP autofill.
  - Appended an `.animate-fade-in` layout entry animation class to [index.css](file:///d:/Project/devbook/src/index.css).

## Decisions made

- **Security Isolation**: Avoided exposing user database credentials or profile checking views during the password reset request to eliminate user enumeration exploits.
- **Single Source of Truth**: Replaced custom guest-gate exception patterns in the UI with state indicators managed by the context provider, preventing loading gate lockouts when no session cookie exists.

## Problems solved

- **Browser Console 401 Warns**: Prevented startup `401 Unauthorized` fetch calls from crashing the loading logic by safely catching and mapping guest profiles.
- **Route Guard Redirect Loops**: Eliminated separate verification routes in favor of inline view rendering inside the login layout.

## Current state

- All authentication SDK calls, OTP verification interfaces, password reset workflows, cross-tab session syncing, and page transition effects are complete and build successfully.

## Next session starts with

- Continuing to the next major project step: **03 Database Foundation**—setting up the client tables (`books`, `phases`, `steps`, `attachments`, `progress`, and `followers`) and wiring up content queries.

## Open questions

- None.
