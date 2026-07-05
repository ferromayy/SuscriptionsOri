export const SESSION_COOKIE = "session_token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export type SessionWithUser = {
  id: string;
  userId: string;
  expiresAt: string;
  user: SessionUser;
};
