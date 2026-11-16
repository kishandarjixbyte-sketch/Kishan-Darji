import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { sqlite, type AdminRecord } from './db.ts';

const secretFile = path.resolve(process.cwd(), 'data', '.session_secret');

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, generated, 'utf8');
  return generated;
}

const SESSION_SECRET = getSessionSecret();

export interface TokenPayload {
  sub: string;
  role: 'super_admin' | 'sub_admin';
  exp: number;
}

export function signSessionToken(admin: AdminRecord): string {
  const payload: TokenPayload = {
    sub: admin.id,
    role: admin.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  admin?: Omit<AdminRecord, 'password_hash'>;
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.slice(7).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }

  const admin = sqlite
    .prepare(
      'SELECT id, full_name, email, mobile, whatsapp_number, role, is_primary, notifications_enabled, is_active, created_at, updated_at FROM admins WHERE id = ? AND is_active = 1'
    )
    .get(payload.sub) as Omit<AdminRecord, 'password_hash'> | undefined;

  if (!admin) {
    return res.status(401).json({ error: 'Admin account inactive or not found' });
  }

  req.admin = admin;
  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.admin || req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin privileges required' });
  }
  next();
}
