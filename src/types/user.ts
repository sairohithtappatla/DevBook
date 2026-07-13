export type UserRole = "USER" | "ADMIN" | "MODERATOR";

export interface UserProfile {
  name?: string;
  avatar_url?: string;
  bio?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
  role: UserRole;
  profile?: UserProfile;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  accessToken: string | null;
  expiresAt: string | null;
}
