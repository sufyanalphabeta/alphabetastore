export const AUTH_MESSAGES = {
  EMAIL_ALREADY_IN_USE: 'Email is already in use.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  REFRESH_TOKEN_INVALID: 'Refresh token is invalid or expired.',
  UNAUTHORIZED: 'Unauthorized.',
  USER_NOT_FOUND: 'User not found.',
  RESET_TOKEN_INVALID: 'Reset link is invalid or has expired.',
} as const;

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes