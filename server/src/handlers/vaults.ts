import { db } from '../db';
import { vaultsTable, vaultUserPermissionsTable, categoriesTable, credentialItemsTable } from '../db/schema';
import { type CreateVaultInput, type UpdateVaultInput, type Vault } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export async function createVault(input: CreateVaultInput, userId: number): Promise<Vault> {
  try {
    // Create the vault
    const result = await db.insert(vaultsTable)
      .values({
        name: input.name,
        description: input.description,
        owner_id: userId,
        is_shared: input.is_shared || false
      })
      .returning()
      .execute();

    const vault = result[0];

    // Grant admin permission to the owner
    await db.insert(vaultUserPermissionsTable)
      .values({
        vault_id: vault.id,
        user_id: userId,
        permission: 'admin',
        granted_by: userId
      })
      .execute();

    // Create default categories
    const defaultCategories = [
      { name: 'Personal', description: 'Personal accounts and services', color: '#4F46E5' },
      { name: 'Work', description: 'Work-related accounts', color: '#059669' },
      { name: 'Banking', description: 'Banking and financial accounts', color: '#DC2626' },
      { name: 'Social', description: 'Social media accounts', color: '#7C2D12' }
    ];

    await db.insert(categoriesTable)
      .values(defaultCategories.map(category => ({
        ...category,
        vault_id: vault.id
      })))
      .execute();

    return vault;
  } catch (error) {
    console.error('Vault creation failed:', error);
    throw error;
  }
}

export async function updateVault(input: UpdateVaultInput, userId: number): Promise<Vault> {
  try {
    // First check if vault exists
    const vaultExists = await db.select()
      .from(vaultsTable)
      .where(eq(vaultsTable.id, input.id))
      .execute();

    if (vaultExists.length === 0) {
      throw new Error('Vault not found');
    }

    // Check if user has admin permission on the vault
    const hasPermission = await db.select()
      .from(vaultUserPermissionsTable)
      .where(
        and(
          eq(vaultUserPermissionsTable.vault_id, input.id),
          eq(vaultUserPermissionsTable.user_id, userId),
          eq(vaultUserPermissionsTable.permission, 'admin')
        )
      )
      .execute();

    if (hasPermission.length === 0) {
      // Also check if user is the owner
      const ownerCheck = await db.select()
        .from(vaultsTable)
        .where(
          and(
            eq(vaultsTable.id, input.id),
            eq(vaultsTable.owner_id, userId)
          )
        )
        .execute();

      if (ownerCheck.length === 0) {
        throw new Error('Insufficient permissions to update vault');
      }
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.is_shared !== undefined) updateData.is_shared = input.is_shared;

    const result = await db.update(vaultsTable)
      .set(updateData)
      .where(eq(vaultsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Vault not found');
    }

    return result[0];
  } catch (error) {
    console.error('Vault update failed:', error);
    throw error;
  }
}

export async function getVaultsByUser(userId: number): Promise<Vault[]> {
  try {
    // Get vaults where user is owner or has permissions
    const results = await db.select({
      id: vaultsTable.id,
      name: vaultsTable.name,
      description: vaultsTable.description,
      owner_id: vaultsTable.owner_id,
      is_shared: vaultsTable.is_shared,
      created_at: vaultsTable.created_at,
      updated_at: vaultsTable.updated_at
    })
      .from(vaultsTable)
      .leftJoin(vaultUserPermissionsTable, eq(vaultsTable.id, vaultUserPermissionsTable.vault_id))
      .where(
        or(
          eq(vaultsTable.owner_id, userId),
          eq(vaultUserPermissionsTable.user_id, userId)
        )
      )
      .execute();

    // Remove duplicates (vault might appear multiple times due to join)
    const uniqueVaults = results.reduce((acc, vault) => {
      if (!acc.find(v => v.id === vault.id)) {
        acc.push(vault);
      }
      return acc;
    }, [] as Vault[]);

    return uniqueVaults;
  } catch (error) {
    console.error('Failed to get vaults by user:', error);
    throw error;
  }
}

export async function getVaultById(id: number, userId: number): Promise<Vault | null> {
  try {
    // Check if user has access to this vault (owner or has permissions)
    const result = await db.select({
      id: vaultsTable.id,
      name: vaultsTable.name,
      description: vaultsTable.description,
      owner_id: vaultsTable.owner_id,
      is_shared: vaultsTable.is_shared,
      created_at: vaultsTable.created_at,
      updated_at: vaultsTable.updated_at
    })
      .from(vaultsTable)
      .leftJoin(vaultUserPermissionsTable, eq(vaultsTable.id, vaultUserPermissionsTable.vault_id))
      .where(
        and(
          eq(vaultsTable.id, id),
          or(
            eq(vaultsTable.owner_id, userId),
            eq(vaultUserPermissionsTable.user_id, userId)
          )
        )
      )
      .execute();

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('Failed to get vault by ID:', error);
    throw error;
  }
}

export async function deleteVault(id: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Check if user is the owner (only owners can delete vaults)
    const vault = await db.select()
      .from(vaultsTable)
      .where(
        and(
          eq(vaultsTable.id, id),
          eq(vaultsTable.owner_id, userId)
        )
      )
      .execute();

    if (vault.length === 0) {
      throw new Error('Vault not found or insufficient permissions');
    }

    // Delete in proper order to handle foreign key constraints
    // 1. Delete credential items
    await db.delete(credentialItemsTable)
      .where(eq(credentialItemsTable.vault_id, id))
      .execute();

    // 2. Delete categories
    await db.delete(categoriesTable)
      .where(eq(categoriesTable.vault_id, id))
      .execute();

    // 3. Delete vault permissions
    await db.delete(vaultUserPermissionsTable)
      .where(eq(vaultUserPermissionsTable.vault_id, id))
      .execute();

    // 4. Delete the vault itself
    await db.delete(vaultsTable)
      .where(eq(vaultsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Vault deletion failed:', error);
    throw error;
  }
}