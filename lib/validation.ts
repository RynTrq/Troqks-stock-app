export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const MIN_FULL_NAME_LENGTH = 2;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(normalizeEmail(email));

export const isValidPassword = (password: string) =>
  password.trim().length >= MIN_PASSWORD_LENGTH;

export const isValidFullName = (fullName: string) =>
  fullName.trim().length >= MIN_FULL_NAME_LENGTH;

export const normalizeSymbol = (symbol: string) =>
  symbol.trim().replace(/\s+/g, "").toUpperCase();

export const isValidTickerSymbol = (symbol: string) =>
  /^[A-Z][A-Z0-9.-]{0,14}$/.test(normalizeSymbol(symbol));
