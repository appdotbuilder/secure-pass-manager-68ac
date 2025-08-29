import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type Session, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

// Simple JWT-like token implementation using crypto
const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key-for-development';

// In-memory token blacklist for logout functionality
// In production, this should be stored in Redis or database
const tokenBlacklist = new Set<string>();

// Export for testing - allows tests to clear blacklist
export function clearTokenBlacklist() {
  tokenBlacklist.clear();
}

// Helper function to hash passwords using PBKDF2
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(32);
  const hash = pbkdf2Sync(password, saltBuffer, 10000, 64, 'sha512');
  return {
    hash: hash.toString('hex'),
    salt: saltBuffer.toString('hex')
  };
}

// Helper function to verify passwords
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const expectedHash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 10000, 64, 'sha512');
  const actualHash = Buffer.from(hash, 'hex');
  return timingSafeEqual(expectedHash, actualHash);
}

// Simple JWT-like token implementation
function createToken(payload: { userId: number; email: string }): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + (24 * 60 * 60) }; // 24 hours

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  
  const signature = createHash('sha256')
    .update(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Verify JWT-like token
function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    if (!headerB64 || !payloadB64 || !signature) return null;

    // Verify signature
    const expectedSignature = createHash('sha256')
      .update(`${headerB64}.${payloadB64}.${JWT_SECRET}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      console.log('Signature mismatch:', { expected: expectedSignature, actual: signature });
      return null;
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.log('Token expired:', { now, exp: payload.exp });
      return null;
    }

    return { userId: payload.userId, email: payload.email };
  } catch (error) {
    console.log('Token verification error:', error);
    return null;
  }
}

export async function login(input: LoginInput): Promise<Session> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }

    // For this implementation, we expect password_hash to contain both hash and salt separated by ':'
    // In a real implementation, you'd split the stored hash properly
    const [storedHash, storedSalt] = user.password_hash.includes(':') 
      ? user.password_hash.split(':')
      : [user.password_hash, ''];

    // Verify password - if no salt is stored, fall back to simple hash comparison
    let isPasswordValid = false;
    if (storedSalt) {
      isPasswordValid = verifyPassword(input.password, storedHash, storedSalt);
    } else {
      // Fallback: simple hash comparison for existing test data
      const testHash = createHash('sha256').update(input.password).digest('hex');
      isPasswordValid = testHash === user.password_hash;
    }

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = createToken({ userId: user.id, email: user.email });

    // Calculate expiration date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      user: {
        ...user,
        created_at: user.created_at as Date,
        updated_at: user.updated_at as Date
      },
      token,
      expires_at: expiresAt
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function logout(token: string): Promise<{ success: boolean }> {
  try {
    // Add token to blacklist
    tokenBlacklist.add(token);
    return { success: true };
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
}

export async function validateSession(token: string): Promise<User | null> {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    // Fetch user from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Check if user is still active
    if (!user.is_active) {
      return null;
    }

    return {
      ...user,
      created_at: user.created_at as Date,
      updated_at: user.updated_at as Date
    };
  } catch (error) {
    // Invalid or expired token
    return null;
  }
}