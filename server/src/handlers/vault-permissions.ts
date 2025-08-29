import { db } from '../db';
import { vaultUserPermissionsTable, vaultsTable, usersTable } from '../db/schema';
import { type CreateVaultPermissionInput, type UpdateVaultPermissionInput, type VaultUserPermission } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createVaultPermission(input: CreateVaultPermissionInput, grantedByUserId: number): Promise<VaultUserPermission> {
  try {
    // Check if the granting user has admin permissions on the vault
    const grantingUserPermission = await getUserPermissionForVault(input.vault_id, grantedByUserId);
    if (grantingUserPermission !== 'admin' && grantingUserPermission !== 'owner') {
      throw new Error('Insufficient permissions: Only admin users can grant vault permissions');
    }

    // Check that the target user exists and is active
    const targetUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (targetUser.length === 0) {
      throw new Error('Target user not found');
    }

    if (!targetUser[0].is_active) {
      throw new Error('Cannot grant permissions to inactive user');
    }

    // Check for duplicate permissions
    const existingPermission = await db.select()
      .from(vaultUserPermissionsTable)
      .where(and(
        eq(vaultUserPermissionsTable.vault_id, input.vault_id),
        eq(vaultUserPermissionsTable.user_id, input.user_id)
      ))
      .execute();

    if (existingPermission.length > 0) {
      throw new Error('User already has permissions for this vault');
    }

    // Create the permission
    const result = await db.insert(vaultUserPermissionsTable)
      .values({
        vault_id: input.vault_id,
        user_id: input.user_id,
        permission: input.permission,
        granted_by: grantedByUserId
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Create vault permission failed:', error);
    throw error;
  }
}

export async function updateVaultPermission(input: UpdateVaultPermissionInput, userId: number): Promise<VaultUserPermission> {
  try {
    // Get the existing permission to validate
    const existingPermissions = await db.select()
      .from(vaultUserPermissionsTable)
      .where(eq(vaultUserPermissionsTable.id, input.id))
      .execute();

    if (existingPermissions.length === 0) {
      throw new Error('Permission not found');
    }

    const existingPermission = existingPermissions[0];

    // Check if the user has admin permissions on the vault
    const userPermission = await getUserPermissionForVault(existingPermission.vault_id, userId);
    if (userPermission !== 'admin' && userPermission !== 'owner') {
      throw new Error('Insufficient permissions: Only admin users can modify vault permissions');
    }

    // Prevent users from modifying their own permissions
    if (existingPermission.user_id === userId) {
      throw new Error('Cannot modify your own permissions');
    }

    // Update the permission
    const result = await db.update(vaultUserPermissionsTable)
      .set({
        permission: input.permission
      })
      .where(eq(vaultUserPermissionsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Update vault permission failed:', error);
    throw error;
  }
}

export async function getVaultPermissions(vaultId: number, userId: number): Promise<VaultUserPermission[]> {
  try {
    // Validate that user has admin permissions on the vault
    const userPermission = await getUserPermissionForVault(vaultId, userId);
    if (userPermission !== 'admin' && userPermission !== 'owner') {
      throw new Error('Insufficient permissions: Only admin users can view vault permissions');
    }

    // Fetch all permissions for the vault with user details
    const results = await db.select({
      id: vaultUserPermissionsTable.id,
      vault_id: vaultUserPermissionsTable.vault_id,
      user_id: vaultUserPermissionsTable.user_id,
      permission: vaultUserPermissionsTable.permission,
      granted_by: vaultUserPermissionsTable.granted_by,
      created_at: vaultUserPermissionsTable.created_at
    })
      .from(vaultUserPermissionsTable)
      .innerJoin(usersTable, eq(vaultUserPermissionsTable.user_id, usersTable.id))
      .where(eq(vaultUserPermissionsTable.vault_id, vaultId))
      .execute();

    return results;
  } catch (error) {
    console.error('Get vault permissions failed:', error);
    throw error;
  }
}

export async function getUserPermissionForVault(vaultId: number, userId: number): Promise<string | null> {
  try {
    // First check if user is the vault owner (automatic admin access)
    const vault = await db.select()
      .from(vaultsTable)
      .where(eq(vaultsTable.id, vaultId))
      .execute();

    if (vault.length === 0) {
      throw new Error('Vault not found');
    }

    if (vault[0].owner_id === userId) {
      return 'owner';
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
      return null;
    }

    return permissions[0].permission;
  } catch (error) {
    console.error('Get user permission for vault failed:', error);
    throw error;
  }
}

export async function revokeVaultPermission(permissionId: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Get the permission to validate
    const permissions = await db.select()
      .from(vaultUserPermissionsTable)
      .where(eq(vaultUserPermissionsTable.id, permissionId))
      .execute();

    if (permissions.length === 0) {
      throw new Error('Permission not found');
    }

    const permission = permissions[0];

    // Check if the user has admin permissions on the vault
    const userPermission = await getUserPermissionForVault(permission.vault_id, userId);
    if (userPermission !== 'admin' && userPermission !== 'owner') {
      throw new Error('Insufficient permissions: Only admin users can revoke vault permissions');
    }

    // Check if trying to revoke owner's implicit permissions (not allowed)
    const vault = await db.select()
      .from(vaultsTable)
      .where(eq(vaultsTable.id, permission.vault_id))
      .execute();

    if (vault[0].owner_id === permission.user_id) {
      throw new Error('Cannot revoke owner permissions');
    }

    // Delete the permission
    await db.delete(vaultUserPermissionsTable)
      .where(eq(vaultUserPermissionsTable.id, permissionId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Revoke vault permission failed:', error);
    throw error;
  }
}

export async function getUserVaults(userId: number): Promise<{ vault: any, permission: string }[]> {
  try {
    // Get owned vaults
    const ownedVaults = await db.select()
      .from(vaultsTable)
      .where(eq(vaultsTable.owner_id, userId))
      .execute();

    // Get vaults with explicit permissions
    const grantedVaults = await db.select({
      vault: {
        id: vaultsTable.id,
        name: vaultsTable.name,
        description: vaultsTable.description,
        owner_id: vaultsTable.owner_id,
        is_shared: vaultsTable.is_shared,
        created_at: vaultsTable.created_at,
        updated_at: vaultsTable.updated_at
      },
      permission: vaultUserPermissionsTable.permission
    })
      .from(vaultUserPermissionsTable)
      .innerJoin(vaultsTable, eq(vaultUserPermissionsTable.vault_id, vaultsTable.id))
      .where(eq(vaultUserPermissionsTable.user_id, userId))
      .execute();

    // Combine results
    const results = [
      ...ownedVaults.map(vault => ({ vault, permission: 'owner' })),
      ...grantedVaults.map(result => ({ vault: result.vault, permission: result.permission }))
    ];

    return results;
  } catch (error) {
    console.error('Get user vaults failed:', error);
    throw error;
  }
}