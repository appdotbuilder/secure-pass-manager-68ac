import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, logout, validateSession, hashPassword, clearTokenBlacklist } from '../handlers/auth';
import { createHash } from 'crypto';

describe('Authentication', () => {
  beforeEach(async () => {
    await createDB();
    clearTokenBlacklist();
  });
  afterEach(resetDB);

  const testUser = {
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'user' as 'user' | 'admin',
    password: 'testpassword123',
    is_active: true
  };

  const createTestUser = async (userData = testUser) => {
    const { hash, salt } = hashPassword(userData.password);
    const passwordHash = `${hash}:${salt}`;
    
    const result = await db.insert(usersTable)
      .values({
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        password_hash: passwordHash,
        is_active: userData.is_active
      })
      .returning()
      .execute();

    return result[0];
  };

  const createTestUserWithSimpleHash = async (userData = testUser) => {
    // For testing backward compatibility with simple hash
    const passwordHash = createHash('sha256').update(userData.password).digest('hex');
    
    const result = await db.insert(usersTable)
      .values({
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        password_hash: passwordHash,
        is_active: userData.is_active
      })
      .returning()
      .execute();

    return result[0];
  };

  describe('login', () => {
    it('should authenticate valid user and return session', async () => {
      // Create test user
      const user = await createTestUser();

      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      const session = await login(loginInput);

      expect(session.user.id).toEqual(user.id);
      expect(session.user.email).toEqual(testUser.email);
      expect(session.user.full_name).toEqual(testUser.full_name);
      expect(session.user.role).toEqual(testUser.role);
      expect(session.user.is_active).toEqual(true);
      expect(session.token).toBeDefined();
      expect(typeof session.token).toBe('string');
      expect(session.expires_at).toBeInstanceOf(Date);
      expect(session.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it('should authenticate user with simple hash (backward compatibility)', async () => {
      // Create test user with simple hash
      const user = await createTestUserWithSimpleHash();

      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      const session = await login(loginInput);

      expect(session.user.id).toEqual(user.id);
      expect(session.user.email).toEqual(testUser.email);
      expect(session.token).toBeDefined();
    });

    it('should generate valid token with proper structure', async () => {
      await createTestUser();

      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      const session = await login(loginInput);

      // Token should have 3 parts separated by dots
      const tokenParts = session.token.split('.');
      expect(tokenParts).toHaveLength(3);

      // Decode payload to verify structure
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      expect(payload.userId).toEqual(session.user.id);
      expect(payload.email).toEqual(testUser.email);
      expect(payload.exp).toBeDefined();
      expect(payload.iat).toBeDefined();
    });

    it('should reject invalid email', async () => {
      await createTestUser();

      const loginInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: testUser.password
      };

      await expect(login(loginInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should reject invalid password', async () => {
      await createTestUser();

      const loginInput: LoginInput = {
        email: testUser.email,
        password: 'wrongpassword'
      };

      await expect(login(loginInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should reject inactive user', async () => {
      await createTestUser({
        ...testUser,
        is_active: false
      });

      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      await expect(login(loginInput)).rejects.toThrow(/account is disabled/i);
    });

    it('should handle admin user login', async () => {
      await createTestUser({
        ...testUser,
        role: 'admin',
        email: 'admin@example.com'
      });

      const loginInput: LoginInput = {
        email: 'admin@example.com',
        password: testUser.password
      };

      const session = await login(loginInput);

      expect(session.user.role).toEqual('admin');
      expect(session.user.email).toEqual('admin@example.com');
    });
  });

  describe('logout', () => {
    it('should successfully logout with valid token', async () => {
      const result = await logout('valid-token');

      expect(result.success).toBe(true);
    });

    it('should handle logout with any token string', async () => {
      const result = await logout('any-token-string-123');

      expect(result.success).toBe(true);
    });
  });

  describe('validateSession', () => {
    it('should validate valid session token', async () => {
      // Create user and login to get valid token
      const user = await createTestUser();

      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      const session = await login(loginInput);

      // Validate the token
      const validatedUser = await validateSession(session.token);

      expect(validatedUser).toBeDefined();
      expect(validatedUser!.id).toEqual(user.id);
      expect(validatedUser!.email).toEqual(testUser.email);
      expect(validatedUser!.full_name).toEqual(testUser.full_name);
      expect(validatedUser!.is_active).toBe(true);
    });

    it('should reject invalid token', async () => {
      const validatedUser = await validateSession('invalid-token');

      expect(validatedUser).toBeNull();
    });

    it('should reject malformed token', async () => {
      const validatedUser = await validateSession('malformed.token');

      expect(validatedUser).toBeNull();
    });

    it('should reject token with invalid signature', async () => {
      // Create user and get valid token
      await createTestUser();
      const session = await login({
        email: testUser.email,
        password: testUser.password
      });

      // Tamper with token signature
      const tokenParts = session.token.split('.');
      const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.invalid_signature`;

      const validatedUser = await validateSession(tamperedToken);
      expect(validatedUser).toBeNull();
    });

    it('should reject token for non-existent user', async () => {
      // Create a valid token structure but with non-existent user ID
      const header = { alg: 'HS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = { userId: 999, email: 'fake@example.com', iat: now, exp: now + 3600 };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      
      // Create proper signature for this fake token
      const { createHash } = await import('crypto');
      const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key-for-development';
      const signature = createHash('sha256')
        .update(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`)
        .digest('base64url');

      const fakeToken = `${encodedHeader}.${encodedPayload}.${signature}`;

      const validatedUser = await validateSession(fakeToken);
      expect(validatedUser).toBeNull();
    });

    it('should reject token for inactive user', async () => {
      // Create inactive user
      const user = await createTestUser({
        ...testUser,
        is_active: false
      });

      // Create valid token for this user
      const header = { alg: 'HS256', typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = { userId: user.id, email: user.email, iat: now, exp: now + 3600 };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      
      const { createHash } = await import('crypto');
      const JWT_SECRET = process.env['JWT_SECRET'] || 'fallback-secret-key-for-development';
      const signature = createHash('sha256')
        .update(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`)
        .digest('base64url');

      const token = `${encodedHeader}.${encodedPayload}.${signature}`;

      const validatedUser = await validateSession(token);
      expect(validatedUser).toBeNull();
    });

    it('should reject blacklisted token after logout', async () => {
      // Create user and login
      await createTestUser();

      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      const session = await login(loginInput);

      // Validate token works initially
      let validatedUser = await validateSession(session.token);
      expect(validatedUser).toBeDefined();

      // Logout (blacklist the token)
      await logout(session.token);

      // Token should now be invalid
      validatedUser = await validateSession(session.token);
      expect(validatedUser).toBeNull();
    });
  });

  describe('integration workflow', () => {
    it('should handle complete login -> validate -> logout workflow', async () => {
      // Create user
      await createTestUser();

      // Login
      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password
      };

      const session = await login(loginInput);
      expect(session.token).toBeDefined();

      // Validate session
      let validatedUser = await validateSession(session.token);
      expect(validatedUser).toBeDefined();
      expect(validatedUser!.email).toEqual(testUser.email);

      // Logout
      const logoutResult = await logout(session.token);
      expect(logoutResult.success).toBe(true);

      // Token should be invalid after logout
      validatedUser = await validateSession(session.token);
      expect(validatedUser).toBeNull();
    });

    it('should handle multiple users with different tokens', async () => {
      // Create two users
      const user1 = await createTestUser();
      const user2 = await createTestUser({
        ...testUser,
        email: 'user2@example.com',
        full_name: 'User Two'
      });

      // Login both users
      const session1 = await login({
        email: testUser.email,
        password: testUser.password
      });

      const session2 = await login({
        email: 'user2@example.com',
        password: testUser.password
      });

      // Both tokens should be valid
      const validated1 = await validateSession(session1.token);
      const validated2 = await validateSession(session2.token);

      expect(validated1!.id).toEqual(user1.id);
      expect(validated2!.id).toEqual(user2.id);

      // Logout one user
      await logout(session1.token);

      // Only first token should be invalid
      expect(await validateSession(session1.token)).toBeNull();
      expect(await validateSession(session2.token)).toBeDefined();
    });

    it('should handle password hashing correctly', async () => {
      // Test password hashing function directly
      const password = 'testpassword123';
      const { hash, salt } = hashPassword(password);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(typeof salt).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(salt.length).toBeGreaterThan(0);

      // Same password should produce different hashes due to random salt
      const { hash: hash2 } = hashPassword(password);
      expect(hash).not.toEqual(hash2);
    });
  });
});