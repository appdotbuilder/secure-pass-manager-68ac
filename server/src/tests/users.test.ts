import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput } from '../schema';
import { createUser, updateUser, getUsers, getUserById, deleteUser } from '../handlers/users';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Test input data
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user',
  password: 'securepassword123'
};

const adminUserInput: CreateUserInput = {
  email: 'admin@example.com',
  full_name: 'Admin User',
  role: 'admin',
  password: 'adminpassword123'
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user with correct data', async () => {
      const result = await createUser(testUserInput);

      expect(result.email).toEqual('test@example.com');
      expect(result.full_name).toEqual('Test User');
      expect(result.role).toEqual('user');
      expect(result.is_active).toEqual(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).toBeDefined();
      expect(result.password_hash).not.toEqual('securepassword123'); // Should be hashed
    });

    it('should hash the password correctly', async () => {
      const result = await createUser(testUserInput);

      // Verify the password was hashed (contains salt separator)
      expect(result.password_hash).toContain(':');
      const [hash, salt] = result.password_hash.split(':');
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      // Verify the hash can be recreated with the same password and salt
      const expectedHash = createHash('sha256').update('securepassword123' + salt).digest('hex');
      expect(hash).toEqual(expectedHash);

      // Verify wrong password produces different hash
      const wrongHash = createHash('sha256').update('wrongpassword' + salt).digest('hex');
      expect(hash).not.toEqual(wrongHash);
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].email).toEqual('test@example.com');
      expect(users[0].full_name).toEqual('Test User');
      expect(users[0].role).toEqual('user');
      expect(users[0].is_active).toEqual(true);
    });

    it('should create admin user with correct role', async () => {
      const result = await createUser(adminUserInput);

      expect(result.role).toEqual('admin');
      expect(result.email).toEqual('admin@example.com');
      expect(result.full_name).toEqual('Admin User');
    });

    it('should reject duplicate email addresses', async () => {
      await createUser(testUserInput);

      // Try to create another user with same email
      await expect(createUser(testUserInput)).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('should update user information', async () => {
      const createdUser = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        full_name: 'Updated User Name',
        email: 'updated@example.com',
        role: 'admin'
      };

      const result = await updateUser(updateInput);

      expect(result.id).toEqual(createdUser.id);
      expect(result.full_name).toEqual('Updated User Name');
      expect(result.email).toEqual('updated@example.com');
      expect(result.role).toEqual('admin');
      expect(result.updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
    });

    it('should update only provided fields', async () => {
      const createdUser = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        full_name: 'Only Name Updated'
      };

      const result = await updateUser(updateInput);

      expect(result.full_name).toEqual('Only Name Updated');
      expect(result.email).toEqual(createdUser.email); // Should remain unchanged
      expect(result.role).toEqual(createdUser.role); // Should remain unchanged
    });

    it('should update is_active status', async () => {
      const createdUser = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        is_active: false
      };

      const result = await updateUser(updateInput);

      expect(result.is_active).toEqual(false);
      expect(result.email).toEqual(createdUser.email); // Other fields unchanged
    });

    it('should save updated user to database', async () => {
      const createdUser = await createUser(testUserInput);

      const updateInput: UpdateUserInput = {
        id: createdUser.id,
        full_name: 'Database Updated Name'
      };

      await updateUser(updateInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      expect(users[0].full_name).toEqual('Database Updated Name');
    });

    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        full_name: 'Non-existent User'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/not found/i);
    });
  });

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const result = await getUsers();
      expect(result).toEqual([]);
    });

    it('should return all users', async () => {
      await createUser(testUserInput);
      await createUser(adminUserInput);

      const result = await getUsers();

      expect(result).toHaveLength(2);
      expect(result.some(user => user.email === 'test@example.com')).toBe(true);
      expect(result.some(user => user.email === 'admin@example.com')).toBe(true);
    });

    it('should include password hashes in results', async () => {
      await createUser(testUserInput);

      const result = await getUsers();

      expect(result[0].password_hash).toBeDefined();
      expect(result[0].password_hash.length).toBeGreaterThan(0);
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const createdUser = await createUser(testUserInput);

      const result = await getUserById(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(createdUser.id);
      expect(result!.email).toEqual('test@example.com');
      expect(result!.full_name).toEqual('Test User');
    });

    it('should return null for non-existent user', async () => {
      const result = await getUserById(999);
      expect(result).toBeNull();
    });

    it('should include password hash', async () => {
      const createdUser = await createUser(testUserInput);

      const result = await getUserById(createdUser.id);

      expect(result!.password_hash).toBeDefined();
      expect(result!.password_hash).toEqual(createdUser.password_hash);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user by setting is_active to false', async () => {
      const createdUser = await createUser(testUserInput);

      const result = await deleteUser(createdUser.id);

      expect(result.success).toBe(true);

      // Verify user still exists but is inactive
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].is_active).toBe(false);
      expect(users[0].updated_at.getTime()).toBeGreaterThan(createdUser.updated_at.getTime());
    });

    it('should return false for non-existent user', async () => {
      const result = await deleteUser(999);
      expect(result.success).toBe(false);
    });

    it('should preserve user data when soft deleting', async () => {
      const createdUser = await createUser(testUserInput);

      await deleteUser(createdUser.id);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, createdUser.id))
        .execute();

      const deletedUser = users[0];
      expect(deletedUser.email).toEqual(createdUser.email);
      expect(deletedUser.full_name).toEqual(createdUser.full_name);
      expect(deletedUser.password_hash).toEqual(createdUser.password_hash);
      expect(deletedUser.is_active).toBe(false); // Only this should change
    });
  });
});