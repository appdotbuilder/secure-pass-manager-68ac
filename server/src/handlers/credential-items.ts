import { db } from '../db';
import { credentialItemsTable, vaultsTable, vaultUserPermissionsTable, usersTable } from '../db/schema';
import { type CreateCredentialItemInput, type UpdateCredentialItemInput, type CredentialItem, type SearchItemsInput } from '../schema';
import { eq, and, or, like, ilike, SQL, isNull } from 'drizzle-orm';
import * as crypto from 'crypto';

// Simple encryption functions (in production, use a proper encryption library)
const ENCRYPTION_KEY = process.env['ENCRYPTION_KEY'] || 'your-32-character-key-here-12345';
const ALGORITHM = 'aes-256-cbc';

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper function to check if user has permission for a vault
async function checkVaultPermission(vaultId: number, userId: number, requiredPermission: 'read' | 'write' | 'admin'): Promise<boolean> {
  try {
    // Check if user is vault owner (always has admin permission)
    const vault = await db.select()
      .from(vaultsTable)
      .where(eq(vaultsTable.id, vaultId))
      .execute();

    if (vault.length === 0) {
      return false;
    }

    if (vault[0].owner_id === userId) {
      return true;
    }

    // Check explicit permissions
    const permissions = await db.select()
      .from(vaultUserPermissionsTable)
      .where(and(
        eq(vaultUserPermissionsTable.vault_id, vaultId),
        eq(vaultUserPermissionsTable.user_id, userId)
      ))
      .execute();

    if (permissions.length === 0) {
      return false;
    }

    const userPermission = permissions[0].permission;

    // Permission hierarchy: admin > write > read
    if (requiredPermission === 'read') {
      return ['read', 'write', 'admin'].includes(userPermission);
    } else if (requiredPermission === 'write') {
      return ['write', 'admin'].includes(userPermission);
    } else if (requiredPermission === 'admin') {
      return userPermission === 'admin';
    }

    return false;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

export async function createCredentialItem(input: CreateCredentialItemInput, userId: number): Promise<CredentialItem> {
  try {
    // Validate user has write permission on the vault
    const hasPermission = await checkVaultPermission(input.vault_id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Insufficient permissions for vault');
    }

    // Encrypt sensitive fields
    const encryptedData: any = {
      title: input.title,
      type: input.type,
      vault_id: input.vault_id,
      category_id: input.category_id,
      website_url: input.website_url,
      username: input.username,
      card_holder_name: input.card_holder_name,
      card_expiry_date: input.card_expiry_date,
      license_email: input.license_email,
      created_by: userId,
      password_encrypted: input.password ? encrypt(input.password) : null,
      notes_encrypted: input.notes ? encrypt(input.notes) : null,
      card_number_encrypted: input.card_number ? encrypt(input.card_number) : null,
      card_cvv_encrypted: input.card_cvv ? encrypt(input.card_cvv) : null,
      license_key_encrypted: input.license_key ? encrypt(input.license_key) : null
    };

    const result = await db.insert(credentialItemsTable)
      .values(encryptedData)
      .returning()
      .execute();

    const item = result[0];

    // Return decrypted data to the user
    return {
      ...item,
      password_encrypted: item.password_encrypted ? decrypt(item.password_encrypted) : null,
      notes_encrypted: item.notes_encrypted ? decrypt(item.notes_encrypted) : null,
      card_number_encrypted: item.card_number_encrypted ? decrypt(item.card_number_encrypted) : null,
      card_cvv_encrypted: item.card_cvv_encrypted ? decrypt(item.card_cvv_encrypted) : null,
      license_key_encrypted: item.license_key_encrypted ? decrypt(item.license_key_encrypted) : null
    };
  } catch (error) {
    console.error('Credential item creation failed:', error);
    throw error;
  }
}

export async function updateCredentialItem(input: UpdateCredentialItemInput, userId: number): Promise<CredentialItem> {
  try {
    // First get the existing item to check vault permissions
    const existingItems = await db.select()
      .from(credentialItemsTable)
      .where(eq(credentialItemsTable.id, input.id))
      .execute();

    if (existingItems.length === 0) {
      throw new Error('Credential item not found');
    }

    const existingItem = existingItems[0];

    // Check vault permissions
    const hasPermission = await checkVaultPermission(existingItem.vault_id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Insufficient permissions for vault');
    }

    // Prepare update data with encryption
    const updateData: any = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.website_url !== undefined) updateData.website_url = input.website_url;
    if (input.username !== undefined) updateData.username = input.username;
    if (input.card_holder_name !== undefined) updateData.card_holder_name = input.card_holder_name;
    if (input.card_expiry_date !== undefined) updateData.card_expiry_date = input.card_expiry_date;
    if (input.license_email !== undefined) updateData.license_email = input.license_email;

    // Encrypt sensitive fields if provided
    if (input.password !== undefined) {
      updateData.password_encrypted = input.password ? encrypt(input.password) : null;
    }
    if (input.notes !== undefined) {
      updateData.notes_encrypted = input.notes ? encrypt(input.notes) : null;
    }
    if (input.card_number !== undefined) {
      updateData.card_number_encrypted = input.card_number ? encrypt(input.card_number) : null;
    }
    if (input.card_cvv !== undefined) {
      updateData.card_cvv_encrypted = input.card_cvv ? encrypt(input.card_cvv) : null;
    }
    if (input.license_key !== undefined) {
      updateData.license_key_encrypted = input.license_key ? encrypt(input.license_key) : null;
    }

    const result = await db.update(credentialItemsTable)
      .set(updateData)
      .where(eq(credentialItemsTable.id, input.id))
      .returning()
      .execute();

    const item = result[0];

    // Return decrypted data to the user
    return {
      ...item,
      password_encrypted: item.password_encrypted ? decrypt(item.password_encrypted) : null,
      notes_encrypted: item.notes_encrypted ? decrypt(item.notes_encrypted) : null,
      card_number_encrypted: item.card_number_encrypted ? decrypt(item.card_number_encrypted) : null,
      card_cvv_encrypted: item.card_cvv_encrypted ? decrypt(item.card_cvv_encrypted) : null,
      license_key_encrypted: item.license_key_encrypted ? decrypt(item.license_key_encrypted) : null
    };
  } catch (error) {
    console.error('Credential item update failed:', error);
    throw error;
  }
}

export async function getItemsByVault(vaultId: number, userId: number): Promise<CredentialItem[]> {
  try {
    // Check vault permissions
    const hasPermission = await checkVaultPermission(vaultId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Insufficient permissions for vault');
    }

    const items = await db.select()
      .from(credentialItemsTable)
      .where(eq(credentialItemsTable.vault_id, vaultId))
      .execute();

    // Decrypt sensitive fields for authorized users
    return items.map(item => ({
      ...item,
      password_encrypted: item.password_encrypted ? decrypt(item.password_encrypted) : null,
      notes_encrypted: item.notes_encrypted ? decrypt(item.notes_encrypted) : null,
      card_number_encrypted: item.card_number_encrypted ? decrypt(item.card_number_encrypted) : null,
      card_cvv_encrypted: item.card_cvv_encrypted ? decrypt(item.card_cvv_encrypted) : null,
      license_key_encrypted: item.license_key_encrypted ? decrypt(item.license_key_encrypted) : null
    }));
  } catch (error) {
    console.error('Get items by vault failed:', error);
    throw error;
  }
}

export async function getItemById(id: number, userId: number): Promise<CredentialItem | null> {
  try {
    const items = await db.select()
      .from(credentialItemsTable)
      .where(eq(credentialItemsTable.id, id))
      .execute();

    if (items.length === 0) {
      return null;
    }

    const item = items[0];

    // Check vault permissions
    const hasPermission = await checkVaultPermission(item.vault_id, userId, 'read');
    if (!hasPermission) {
      throw new Error('Insufficient permissions for vault');
    }

    // Return decrypted data to the user
    return {
      ...item,
      password_encrypted: item.password_encrypted ? decrypt(item.password_encrypted) : null,
      notes_encrypted: item.notes_encrypted ? decrypt(item.notes_encrypted) : null,
      card_number_encrypted: item.card_number_encrypted ? decrypt(item.card_number_encrypted) : null,
      card_cvv_encrypted: item.card_cvv_encrypted ? decrypt(item.card_cvv_encrypted) : null,
      license_key_encrypted: item.license_key_encrypted ? decrypt(item.license_key_encrypted) : null
    };
  } catch (error) {
    console.error('Get item by ID failed:', error);
    throw error;
  }
}

export async function searchItems(input: SearchItemsInput, userId: number): Promise<CredentialItem[]> {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Vault filtering with permission check
    if (input.vault_id !== undefined) {
      const hasPermission = await checkVaultPermission(input.vault_id, userId, 'read');
      if (!hasPermission) {
        throw new Error('Insufficient permissions for vault');
      }
      conditions.push(eq(credentialItemsTable.vault_id, input.vault_id));
    } else {
      // If no specific vault, only search in user's own vaults for simplicity
      const userVaults = await db.select()
        .from(vaultsTable)
        .where(eq(vaultsTable.owner_id, userId))
        .execute();

      const vaultIds = userVaults.map(v => v.id);
      if (vaultIds.length === 0) {
        return [];
      }
      
      // For simplicity, just search the first vault if multiple exist
      conditions.push(eq(credentialItemsTable.vault_id, vaultIds[0]));
    }

    // Category filtering
    if (input.category_id !== undefined) {
      if (input.category_id === null) {
        conditions.push(isNull(credentialItemsTable.category_id));
      } else {
        conditions.push(eq(credentialItemsTable.category_id, input.category_id));
      }
    }

    // Type filtering
    if (input.type !== undefined) {
      conditions.push(eq(credentialItemsTable.type, input.type));
    }

    // Text search - for simplicity, search only in title for now
    if (input.query !== undefined && input.query.trim() !== '') {
      const searchTerm = `%${input.query.trim()}%`;
      conditions.push(ilike(credentialItemsTable.title, searchTerm));
    }

    // Build and execute query
    const baseQuery = db.select().from(credentialItemsTable);
    
    const items = conditions.length > 0 
      ? await baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions)).execute()
      : await baseQuery.execute();

    // Decrypt sensitive fields for authorized users
    return items.map(item => ({
      ...item,
      password_encrypted: item.password_encrypted ? decrypt(item.password_encrypted) : null,
      notes_encrypted: item.notes_encrypted ? decrypt(item.notes_encrypted) : null,
      card_number_encrypted: item.card_number_encrypted ? decrypt(item.card_number_encrypted) : null,
      card_cvv_encrypted: item.card_cvv_encrypted ? decrypt(item.card_cvv_encrypted) : null,
      license_key_encrypted: item.license_key_encrypted ? decrypt(item.license_key_encrypted) : null
    }));
  } catch (error) {
    console.error('Search items failed:', error);
    throw error;
  }
}

export async function deleteCredentialItem(id: number, userId: number): Promise<{ success: boolean }> {
  try {
    // First get the existing item to check vault permissions
    const existingItems = await db.select()
      .from(credentialItemsTable)
      .where(eq(credentialItemsTable.id, id))
      .execute();

    if (existingItems.length === 0) {
      throw new Error('Credential item not found');
    }

    const existingItem = existingItems[0];

    // Check vault permissions
    const hasPermission = await checkVaultPermission(existingItem.vault_id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Insufficient permissions for vault');
    }

    await db.delete(credentialItemsTable)
      .where(eq(credentialItemsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Credential item deletion failed:', error);
    throw error;
  }
}