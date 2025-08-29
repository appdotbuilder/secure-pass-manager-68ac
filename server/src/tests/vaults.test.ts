import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, vaultsTable, vaultUserPermissionsTable, categoriesTable, credentialItemsTable } from '../db/schema';
import { type CreateVaultInput, type UpdateVaultInput } from '../schema';
import { createVault, updateVault, getVaultsByUser, getVaultById, deleteVault } from '../handlers/vaults';
import { eq, and } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'user' as const,
  password_hash: 'hashed_password'
};

const anotherUser = {
  email: 'other@example.com',
  full_name: 'Other User',
  role: 'user' as const,
  password_hash: 'hashed_password'
};

const testVaultInput: CreateVaultInput = {
  name: 'My Personal Vault',
  description: 'A vault for my personal passwords',
  is_shared: false
};

describe('Vault Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let otherUserId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([testUser, anotherUser])
      .returning()
      .execute();

    userId = users[0].id;
    otherUserId = users[1].id;
  });

  describe('createVault', () => {
    it('should create a vault successfully', async () => {
      const result = await createVault(testVaultInput, userId);

      expect(result.name).toEqual('My Personal Vault');
      expect(result.description).toEqual('A vault for my personal passwords');
      expect(result.owner_id).toEqual(userId);
      expect(result.is_shared).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save vault to database', async () => {
      const result = await createVault(testVaultInput, userId);

      const vaults = await db.select()
        .from(vaultsTable)
        .where(eq(vaultsTable.id, result.id))
        .execute();

      expect(vaults).toHaveLength(1);
      expect(vaults[0].name).toEqual('My Personal Vault');
      expect(vaults[0].owner_id).toEqual(userId);
    });

    it('should create admin permission for owner', async () => {
      const result = await createVault(testVaultInput, userId);

      const permissions = await db.select()
        .from(vaultUserPermissionsTable)
        .where(
          and(
            eq(vaultUserPermissionsTable.vault_id, result.id),
            eq(vaultUserPermissionsTable.user_id, userId)
          )
        )
        .execute();

      expect(permissions).toHaveLength(1);
      expect(permissions[0].permission).toEqual('admin');
      expect(permissions[0].granted_by).toEqual(userId);
    });

    it('should create default categories', async () => {
      const result = await createVault(testVaultInput, userId);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.vault_id, result.id))
        .execute();

      expect(categories).toHaveLength(4);
      
      const categoryNames = categories.map(c => c.name).sort();
      expect(categoryNames).toEqual(['Banking', 'Personal', 'Social', 'Work']);
      
      // Check one category has proper structure
      const personalCategory = categories.find(c => c.name === 'Personal');
      expect(personalCategory?.description).toEqual('Personal accounts and services');
      expect(personalCategory?.color).toEqual('#4F46E5');
    });

    it('should handle shared vault creation', async () => {
      const sharedVaultInput: CreateVaultInput = {
        name: 'Shared Team Vault',
        description: null,
        is_shared: true
      };

      const result = await createVault(sharedVaultInput, userId);

      expect(result.is_shared).toBe(true);
      expect(result.description).toBeNull();
    });
  });

  describe('updateVault', () => {
    let vaultId: number;

    beforeEach(async () => {
      const vault = await createVault(testVaultInput, userId);
      vaultId = vault.id;
    });

    it('should update vault as owner', async () => {
      const updateInput: UpdateVaultInput = {
        id: vaultId,
        name: 'Updated Vault Name',
        description: 'Updated description',
        is_shared: true
      };

      const result = await updateVault(updateInput, userId);

      expect(result.name).toEqual('Updated Vault Name');
      expect(result.description).toEqual('Updated description');
      expect(result.is_shared).toBe(true);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update only provided fields', async () => {
      const updateInput: UpdateVaultInput = {
        id: vaultId,
        name: 'New Name Only'
      };

      const result = await updateVault(updateInput, userId);

      expect(result.name).toEqual('New Name Only');
      expect(result.description).toEqual(testVaultInput.description); // Should remain unchanged
      expect(result.is_shared).toBe(false); // Should remain unchanged
    });

    it('should reject update from user without permissions', async () => {
      const updateInput: UpdateVaultInput = {
        id: vaultId,
        name: 'Unauthorized Update'
      };

      await expect(updateVault(updateInput, otherUserId))
        .rejects.toThrow(/insufficient permissions/i);
    });

    it('should allow update from user with admin permissions', async () => {
      // Grant admin permission to other user
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: vaultId,
          user_id: otherUserId,
          permission: 'admin',
          granted_by: userId
        })
        .execute();

      const updateInput: UpdateVaultInput = {
        id: vaultId,
        name: 'Updated by Admin User'
      };

      const result = await updateVault(updateInput, otherUserId);
      expect(result.name).toEqual('Updated by Admin User');
    });

    it('should reject update for non-existent vault', async () => {
      const updateInput: UpdateVaultInput = {
        id: 99999,
        name: 'Non-existent Vault'
      };

      await expect(updateVault(updateInput, userId))
        .rejects.toThrow(/vault not found/i);
    });
  });

  describe('getVaultsByUser', () => {
    let ownedVaultId: number;
    let sharedVaultId: number;

    beforeEach(async () => {
      // Create owned vault
      const ownedVault = await createVault(testVaultInput, userId);
      ownedVaultId = ownedVault.id;

      // Create vault owned by other user
      const otherVault = await createVault({
        name: 'Other User Vault',
        description: null,
        is_shared: true
      }, otherUserId);
      sharedVaultId = otherVault.id;

      // Grant permission to first user
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: sharedVaultId,
          user_id: userId,
          permission: 'read',
          granted_by: otherUserId
        })
        .execute();
    });

    it('should return owned and permitted vaults', async () => {
      const result = await getVaultsByUser(userId);

      expect(result).toHaveLength(2);
      
      const vaultIds = result.map(v => v.id).sort();
      expect(vaultIds).toEqual([ownedVaultId, sharedVaultId].sort());

      const ownedVault = result.find(v => v.id === ownedVaultId);
      expect(ownedVault?.name).toEqual('My Personal Vault');
      expect(ownedVault?.owner_id).toEqual(userId);

      const sharedVault = result.find(v => v.id === sharedVaultId);
      expect(sharedVault?.name).toEqual('Other User Vault');
      expect(sharedVault?.owner_id).toEqual(otherUserId);
    });

    it('should return only owned vaults for user without permissions', async () => {
      const result = await getVaultsByUser(otherUserId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(sharedVaultId);
      expect(result[0].owner_id).toEqual(otherUserId);
    });

    it('should return empty array for user with no vaults', async () => {
      // Create a third user
      const thirdUser = await db.insert(usersTable)
        .values({
          email: 'third@example.com',
          full_name: 'Third User',
          role: 'user',
          password_hash: 'hashed_password'
        })
        .returning()
        .execute();

      const result = await getVaultsByUser(thirdUser[0].id);
      expect(result).toHaveLength(0);
    });
  });

  describe('getVaultById', () => {
    let vaultId: number;

    beforeEach(async () => {
      const vault = await createVault(testVaultInput, userId);
      vaultId = vault.id;
    });

    it('should return vault for owner', async () => {
      const result = await getVaultById(vaultId, userId);

      expect(result).not.toBeNull();
      expect(result?.id).toEqual(vaultId);
      expect(result?.name).toEqual('My Personal Vault');
      expect(result?.owner_id).toEqual(userId);
    });

    it('should return vault for user with permissions', async () => {
      // Grant permission to other user
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: vaultId,
          user_id: otherUserId,
          permission: 'read',
          granted_by: userId
        })
        .execute();

      const result = await getVaultById(vaultId, otherUserId);

      expect(result).not.toBeNull();
      expect(result?.id).toEqual(vaultId);
      expect(result?.owner_id).toEqual(userId);
    });

    it('should return null for user without access', async () => {
      const result = await getVaultById(vaultId, otherUserId);
      expect(result).toBeNull();
    });

    it('should return null for non-existent vault', async () => {
      const result = await getVaultById(99999, userId);
      expect(result).toBeNull();
    });
  });

  describe('deleteVault', () => {
    let vaultId: number;

    beforeEach(async () => {
      const vault = await createVault(testVaultInput, userId);
      vaultId = vault.id;

      // Add some related data to test cascading deletion
      await db.insert(credentialItemsTable)
        .values({
          title: 'Test Credential',
          type: 'password',
          vault_id: vaultId,
          category_id: null,
          website_url: 'https://example.com',
          username: 'testuser',
          password_encrypted: 'encrypted_password',
          notes_encrypted: null,
          card_number_encrypted: null,
          card_holder_name: null,
          card_expiry_date: null,
          card_cvv_encrypted: null,
          license_key_encrypted: null,
          license_email: null,
          created_by: userId
        })
        .execute();
    });

    it('should delete vault as owner', async () => {
      const result = await deleteVault(vaultId, userId);

      expect(result.success).toBe(true);

      // Verify vault is deleted
      const vaults = await db.select()
        .from(vaultsTable)
        .where(eq(vaultsTable.id, vaultId))
        .execute();
      expect(vaults).toHaveLength(0);
    });

    it('should cascade delete related data', async () => {
      await deleteVault(vaultId, userId);

      // Check categories are deleted
      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.vault_id, vaultId))
        .execute();
      expect(categories).toHaveLength(0);

      // Check credential items are deleted
      const items = await db.select()
        .from(credentialItemsTable)
        .where(eq(credentialItemsTable.vault_id, vaultId))
        .execute();
      expect(items).toHaveLength(0);

      // Check permissions are deleted
      const permissions = await db.select()
        .from(vaultUserPermissionsTable)
        .where(eq(vaultUserPermissionsTable.vault_id, vaultId))
        .execute();
      expect(permissions).toHaveLength(0);
    });

    it('should reject deletion from non-owner', async () => {
      await expect(deleteVault(vaultId, otherUserId))
        .rejects.toThrow(/vault not found or insufficient permissions/i);
    });

    it('should reject deletion of non-existent vault', async () => {
      await expect(deleteVault(99999, userId))
        .rejects.toThrow(/vault not found or insufficient permissions/i);
    });
  });
});