import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Hash the password using crypto
    const salt = randomBytes(16).toString('hex');
    const password_hash = createHash('sha256').update(input.password + salt).digest('hex') + ':' + salt;

    // Insert the new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        full_name: input.full_name,
        role: input.role,
        password_hash: password_hash,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Build update values, only including provided fields
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.email !== undefined) updateValues.email = input.email;
    if (input.full_name !== undefined) updateValues.full_name = input.full_name;
    if (input.role !== undefined) updateValues.role = input.role;
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    // Update the user
    const result = await db.update(usersTable)
      .set(updateValues)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return users.length > 0 ? users[0] : null;
  } catch (error) {
    console.error('Failed to fetch user by id:', error);
    throw error;
  }
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  try {
    // Soft delete by setting is_active to false
    const result = await db.update(usersTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, id))
      .returning()
      .execute();

    return { success: result.length > 0 };
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}