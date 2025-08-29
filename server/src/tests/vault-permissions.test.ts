import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, vaultsTable, vaultUserPermissionsTable } from '../db/schema';
import { 
  createVaultPermission,
  updateVaultPermission,
  getVaultPermissions,
  getUserPermissionForVault,
  revokeVaultPermission,
  getUserVaults
} from '../handlers/vault-permissions';
import { type CreateVaultPermissionInput, type UpdateVaultPermissionInput } from '../schema';
import { eq } from 'drizzle-orm';

// Test data setup helpers
const createTestUser = async (email: string, role: 'admin' | 'user' = 'user') => {
  const result = await db.insert(usersTable)
    .values({
      email,
      full_name: `Test User ${email}`,
      role,
      password_hash: 'hashed_password',
      is_active: true
    })
    .returning()
    .execute();
  return result[0];
};

const createTestVault = async (ownerId: number, name: string = 'Test Vault') => {
  const result = await db.insert(vaultsTable)
    .values({
      name,
      description: 'Test vault description',
      owner_id: ownerId,
      is_shared: true
    })
    .returning()
    .execute();
  return result[0];
};

describe('vault-permissions handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createVaultPermission', () => {
    it('should create vault permission when user has admin access', async () => {
      const owner = await createTestUser('owner@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };

      const result = await createVaultPermission(input, owner.id);

      expect(result.vault_id).toEqual(vault.id);
      expect(result.user_id).toEqual(targetUser.id);
      expect(result.permission).toEqual('read');
      expect(result.granted_by).toEqual(owner.id);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save permission to database', async () => {
      const owner = await createTestUser('owner@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'write'
      };

      await createVaultPermission(input, owner.id);

      const permissions = await db.select()
        .from(vaultUserPermissionsTable)
        .where(eq(vaultUserPermissionsTable.vault_id, vault.id))
        .execute();

      expect(permissions).toHaveLength(1);
      expect(permissions[0].user_id).toEqual(targetUser.id);
      expect(permissions[0].permission).toEqual('write');
      expect(permissions[0].granted_by).toEqual(owner.id);
    });

    it('should throw error when user lacks admin permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const regularUser = await createTestUser('regular@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };

      await expect(createVaultPermission(input, regularUser.id))
        .rejects.toThrow(/insufficient permissions/i);
    });

    it('should throw error when target user does not exist', async () => {
      const owner = await createTestUser('owner@test.com');
      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: 999,
        permission: 'read'
      };

      await expect(createVaultPermission(input, owner.id))
        .rejects.toThrow(/target user not found/i);
    });

    it('should throw error when target user is inactive', async () => {
      const owner = await createTestUser('owner@test.com');
      const inactiveUser = await createTestUser('inactive@test.com');
      
      // Make user inactive
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.id, inactiveUser.id))
        .execute();

      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: inactiveUser.id,
        permission: 'read'
      };

      await expect(createVaultPermission(input, owner.id))
        .rejects.toThrow(/cannot grant permissions to inactive user/i);
    });

    it('should throw error for duplicate permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };

      await createVaultPermission(input, owner.id);

      await expect(createVaultPermission(input, owner.id))
        .rejects.toThrow(/user already has permissions/i);
    });
  });

  describe('updateVaultPermission', () => {
    it('should update vault permission', async () => {
      const owner = await createTestUser('owner@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      // Create initial permission
      const createInput: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };
      const permission = await createVaultPermission(createInput, owner.id);

      // Update permission
      const updateInput: UpdateVaultPermissionInput = {
        id: permission.id,
        permission: 'write'
      };

      const result = await updateVaultPermission(updateInput, owner.id);

      expect(result.permission).toEqual('write');
      expect(result.id).toEqual(permission.id);
    });

    it('should throw error when permission not found', async () => {
      const owner = await createTestUser('owner@test.com');

      const updateInput: UpdateVaultPermissionInput = {
        id: 999,
        permission: 'write'
      };

      await expect(updateVaultPermission(updateInput, owner.id))
        .rejects.toThrow(/permission not found/i);
    });

    it('should throw error when user lacks admin permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const regularUser = await createTestUser('regular@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      // Create permission as owner
      const createInput: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };
      const permission = await createVaultPermission(createInput, owner.id);

      // Try to update as regular user
      const updateInput: UpdateVaultPermissionInput = {
        id: permission.id,
        permission: 'write'
      };

      await expect(updateVaultPermission(updateInput, regularUser.id))
        .rejects.toThrow(/insufficient permissions/i);
    });

    it('should throw error when user tries to modify own permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const adminUser = await createTestUser('admin@test.com');
      const vault = await createTestVault(owner.id);

      // Grant admin permission to user
      const createInput: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: adminUser.id,
        permission: 'admin'
      };
      const permission = await createVaultPermission(createInput, owner.id);

      // Try to modify own permissions
      const updateInput: UpdateVaultPermissionInput = {
        id: permission.id,
        permission: 'read'
      };

      await expect(updateVaultPermission(updateInput, adminUser.id))
        .rejects.toThrow(/cannot modify your own permissions/i);
    });
  });

  describe('getUserPermissionForVault', () => {
    it('should return "owner" for vault owner', async () => {
      const owner = await createTestUser('owner@test.com');
      const vault = await createTestVault(owner.id);

      const permission = await getUserPermissionForVault(vault.id, owner.id);

      expect(permission).toEqual('owner');
    });

    it('should return explicit permission for granted user', async () => {
      const owner = await createTestUser('owner@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'admin'
      };
      await createVaultPermission(input, owner.id);

      const permission = await getUserPermissionForVault(vault.id, targetUser.id);

      expect(permission).toEqual('admin');
    });

    it('should return null for user with no access', async () => {
      const owner = await createTestUser('owner@test.com');
      const otherUser = await createTestUser('other@test.com');
      const vault = await createTestVault(owner.id);

      const permission = await getUserPermissionForVault(vault.id, otherUser.id);

      expect(permission).toBeNull();
    });

    it('should throw error when vault not found', async () => {
      const user = await createTestUser('user@test.com');

      await expect(getUserPermissionForVault(999, user.id))
        .rejects.toThrow(/vault not found/i);
    });
  });

  describe('getVaultPermissions', () => {
    it('should return all permissions for vault when user is owner', async () => {
      const owner = await createTestUser('owner@test.com');
      const user1 = await createTestUser('user1@test.com');
      const user2 = await createTestUser('user2@test.com');
      const vault = await createTestVault(owner.id);

      // Create permissions
      await createVaultPermission({ vault_id: vault.id, user_id: user1.id, permission: 'read' }, owner.id);
      await createVaultPermission({ vault_id: vault.id, user_id: user2.id, permission: 'write' }, owner.id);

      const permissions = await getVaultPermissions(vault.id, owner.id);

      expect(permissions).toHaveLength(2);
      expect(permissions.map(p => p.permission)).toContain('read');
      expect(permissions.map(p => p.permission)).toContain('write');
    });

    it('should throw error when user lacks admin permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const regularUser = await createTestUser('regular@test.com');
      const vault = await createTestVault(owner.id);

      await expect(getVaultPermissions(vault.id, regularUser.id))
        .rejects.toThrow(/insufficient permissions/i);
    });
  });

  describe('revokeVaultPermission', () => {
    it('should revoke vault permission', async () => {
      const owner = await createTestUser('owner@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      // Create permission
      const createInput: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };
      const permission = await createVaultPermission(createInput, owner.id);

      // Revoke permission
      const result = await revokeVaultPermission(permission.id, owner.id);

      expect(result.success).toBe(true);

      // Verify permission is removed
      const permissions = await db.select()
        .from(vaultUserPermissionsTable)
        .where(eq(vaultUserPermissionsTable.id, permission.id))
        .execute();

      expect(permissions).toHaveLength(0);
    });

    it('should throw error when permission not found', async () => {
      const owner = await createTestUser('owner@test.com');

      await expect(revokeVaultPermission(999, owner.id))
        .rejects.toThrow(/permission not found/i);
    });

    it('should throw error when user lacks admin permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const regularUser = await createTestUser('regular@test.com');
      const targetUser = await createTestUser('target@test.com');
      const vault = await createTestVault(owner.id);

      // Create permission as owner
      const createInput: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: targetUser.id,
        permission: 'read'
      };
      const permission = await createVaultPermission(createInput, owner.id);

      // Try to revoke as regular user
      await expect(revokeVaultPermission(permission.id, regularUser.id))
        .rejects.toThrow(/insufficient permissions/i);
    });
  });

  describe('getUserVaults', () => {
    it('should return owned vaults with "owner" permission', async () => {
      const owner = await createTestUser('owner@test.com');
      const vault1 = await createTestVault(owner.id, 'Owned Vault 1');
      const vault2 = await createTestVault(owner.id, 'Owned Vault 2');

      const results = await getUserVaults(owner.id);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.permission === 'owner')).toBe(true);
      expect(results.map(r => r.vault.name)).toContain('Owned Vault 1');
      expect(results.map(r => r.vault.name)).toContain('Owned Vault 2');
    });

    it('should return granted vaults with correct permissions', async () => {
      const owner = await createTestUser('owner@test.com');
      const grantedUser = await createTestUser('granted@test.com');
      const vault = await createTestVault(owner.id);

      // Grant permission
      const input: CreateVaultPermissionInput = {
        vault_id: vault.id,
        user_id: grantedUser.id,
        permission: 'write'
      };
      await createVaultPermission(input, owner.id);

      const results = await getUserVaults(grantedUser.id);

      expect(results).toHaveLength(1);
      expect(results[0].permission).toEqual('write');
      expect(results[0].vault.id).toEqual(vault.id);
    });

    it('should return combined owned and granted vaults', async () => {
      const owner = await createTestUser('owner@test.com');
      const grantedUser = await createTestUser('granted@test.com');
      const ownedVault = await createTestVault(grantedUser.id, 'Owned Vault');
      const sharedVault = await createTestVault(owner.id, 'Shared Vault');

      // Grant permission to shared vault
      const input: CreateVaultPermissionInput = {
        vault_id: sharedVault.id,
        user_id: grantedUser.id,
        permission: 'read'
      };
      await createVaultPermission(input, owner.id);

      const results = await getUserVaults(grantedUser.id);

      expect(results).toHaveLength(2);
      const ownedResult = results.find(r => r.vault.name === 'Owned Vault');
      const sharedResult = results.find(r => r.vault.name === 'Shared Vault');

      expect(ownedResult?.permission).toEqual('owner');
      expect(sharedResult?.permission).toEqual('read');
    });

    it('should return empty array for user with no vaults', async () => {
      const user = await createTestUser('user@test.com');

      const results = await getUserVaults(user.id);

      expect(results).toHaveLength(0);
    });
  });
});