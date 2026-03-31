import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'changeme_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'changeme_refresh_secret';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: ACCESS_EXPIRY };
  return jwt.sign(payload, ACCESS_SECRET, options);
}

export function generateRefreshToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: REFRESH_EXPIRY };
  return jwt.sign(payload, REFRESH_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload & TokenPayload;
  return decoded;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET) as JwtPayload & TokenPayload;
  return decoded;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload & TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

export function getAccessTokenExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return d;
}
