import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, vaultsTable, categoriesTable, credentialItemsTable, vaultUserPermissionsTable } from '../db/schema';
import { type CreateCredentialItemInput, type UpdateCredentialItemInput, type SearchItemsInput } from '../schema';
import {
  createCredentialItem,
  updateCredentialItem,
  getItemsByVault,
  getItemById,
  searchItems,
  deleteCredentialItem
} from '../handlers/credential-items';
import { eq } from 'drizzle-orm';


// Test data
let testUserId: number;
let testUser2Id: number;
let testVaultId: number;
let testVault2Id: number;
let testCategoryId: number;

describe('Credential Items', () => {
  beforeEach(async () => {
    await createDB();

    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'user',
          password_hash: 'hashed_password',
          is_active: true
        },
        {
          email: 'test2@example.com',
          full_name: 'Test User 2',
          role: 'user',
          password_hash: 'hashed_password',
          is_active: true
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    testUser2Id = users[1].id;

    // Create test vaults
    const vaults = await db.insert(vaultsTable)
      .values([
        {
          name: 'Test Vault',
          description: 'A vault for testing',
          owner_id: testUserId,
          is_shared: false
        },
        {
          name: 'Test Vault 2',
          description: 'Another vault for testing',
          owner_id: testUser2Id,
          is_shared: false
        }
      ])
      .returning()
      .execute();

    testVaultId = vaults[0].id;
    testVault2Id = vaults[1].id;

    // Create test category
    const categories = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'A category for testing',
        color: '#FF0000',
        vault_id: testVaultId
      })
      .returning()
      .execute();

    testCategoryId = categories[0].id;
  });

  afterEach(resetDB);

  describe('createCredentialItem', () => {
    it('should create a password credential item', async () => {
      const input: CreateCredentialItemInput = {
        title: 'Test Login',
        type: 'password',
        vault_id: testVaultId,
        category_id: testCategoryId,
        website_url: 'https://example.com',
        username: 'testuser',
        password: 'secretpassword',
        notes: 'Some notes',
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      const result = await createCredentialItem(input, testUserId);

      expect(result.id).toBeDefined();
      expect(result.title).toEqual('Test Login');
      expect(result.type).toEqual('password');
      expect(result.vault_id).toEqual(testVaultId);
      expect(result.category_id).toEqual(testCategoryId);
      expect(result.website_url).toEqual('https://example.com');
      expect(result.username).toEqual('testuser');
      expect(result.password_encrypted).toEqual('secretpassword'); // Decrypted for user
      expect(result.notes_encrypted).toEqual('Some notes');
      expect(result.created_by).toEqual(testUserId);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a credit card credential item', async () => {
      const input: CreateCredentialItemInput = {
        title: 'My Credit Card',
        type: 'credit_card',
        vault_id: testVaultId,
        category_id: null,
        website_url: null,
        username: null,
        password: null,
        notes: null,
        card_number: '4111111111111111',
        card_holder_name: 'Test User',
        card_expiry_date: '12/25',
        card_cvv: '123',
        license_key: null,
        license_email: null
      };

      const result = await createCredentialItem(input, testUserId);

      expect(result.title).toEqual('My Credit Card');
      expect(result.type).toEqual('credit_card');
      expect(result.card_number_encrypted).toEqual('4111111111111111');
      expect(result.card_holder_name).toEqual('Test User');
      expect(result.card_expiry_date).toEqual('12/25');
      expect(result.card_cvv_encrypted).toEqual('123');
    });

    it('should create a software license credential item', async () => {
      const input: CreateCredentialItemInput = {
        title: 'Software License',
        type: 'software_license',
        vault_id: testVaultId,
        category_id: null,
        website_url: null,
        username: null,
        password: null,
        notes: 'License details',
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: 'ABCD-EFGH-IJKL-MNOP',
        license_email: 'license@example.com'
      };

      const result = await createCredentialItem(input, testUserId);

      expect(result.title).toEqual('Software License');
      expect(result.type).toEqual('software_license');
      expect(result.license_key_encrypted).toEqual('ABCD-EFGH-IJKL-MNOP');
      expect(result.license_email).toEqual('license@example.com');
      expect(result.notes_encrypted).toEqual('License details');
    });

    it('should save encrypted data to database', async () => {
      const input: CreateCredentialItemInput = {
        title: 'Test Item',
        type: 'password',
        vault_id: testVaultId,
        category_id: null,
        website_url: null,
        username: null,
        password: 'secret123',
        notes: null,
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      const result = await createCredentialItem(input, testUserId);

      // Check database directly to verify encryption
      const dbItems = await db.select()
        .from(credentialItemsTable)
        .where(eq(credentialItemsTable.id, result.id))
        .execute();

      expect(dbItems).toHaveLength(1);
      const dbItem = dbItems[0];
      expect(dbItem.password_encrypted).not.toEqual('secret123'); // Should be encrypted
      expect(dbItem.password_encrypted).toContain(':'); // Should contain IV separator
    });

    it('should reject creation without vault permissions', async () => {
      const input: CreateCredentialItemInput = {
        title: 'Unauthorized Item',
        type: 'password',
        vault_id: testVault2Id, // User doesn't own this vault
        category_id: null,
        website_url: null,
        username: null,
        password: 'secret123',
        notes: null,
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      await expect(createCredentialItem(input, testUserId)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should allow creation with explicit vault permissions', async () => {
      // Grant read permission to testUserId for testVault2Id
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVault2Id,
          user_id: testUserId,
          permission: 'write',
          granted_by: testUser2Id
        })
        .execute();

      const input: CreateCredentialItemInput = {
        title: 'Authorized Item',
        type: 'password',
        vault_id: testVault2Id,
        category_id: null,
        website_url: null,
        username: null,
        password: 'secret123',
        notes: null,
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      const result = await createCredentialItem(input, testUserId);
      expect(result.title).toEqual('Authorized Item');
    });
  });

  describe('updateCredentialItem', () => {
    let testItemId: number;

    beforeEach(async () => {
      const input: CreateCredentialItemInput = {
        title: 'Original Title',
        type: 'password',
        vault_id: testVaultId,
        category_id: testCategoryId,
        website_url: 'https://original.com',
        username: 'original_user',
        password: 'original_pass',
        notes: 'Original notes',
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      const item = await createCredentialItem(input, testUserId);
      testItemId = item.id;
    });

    it('should update credential item fields', async () => {
      const input: UpdateCredentialItemInput = {
        id: testItemId,
        title: 'Updated Title',
        website_url: 'https://updated.com',
        password: 'new_password'
      };

      const result = await updateCredentialItem(input, testUserId);

      expect(result.title).toEqual('Updated Title');
      expect(result.website_url).toEqual('https://updated.com');
      expect(result.password_encrypted).toEqual('new_password');
      expect(result.username).toEqual('original_user'); // Unchanged
    });

    it('should update nullable fields to null', async () => {
      const input: UpdateCredentialItemInput = {
        id: testItemId,
        category_id: null,
        website_url: null
      };

      const result = await updateCredentialItem(input, testUserId);

      expect(result.category_id).toBeNull();
      expect(result.website_url).toBeNull();
    });

    it('should reject update without vault permissions', async () => {
      const input: UpdateCredentialItemInput = {
        id: testItemId,
        title: 'Hacked Title'
      };

      await expect(updateCredentialItem(input, testUser2Id)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should reject update of non-existent item', async () => {
      const input: UpdateCredentialItemInput = {
        id: 99999,
        title: 'Non-existent'
      };

      await expect(updateCredentialItem(input, testUserId)).rejects.toThrow(/not found/i);
    });
  });

  describe('getItemsByVault', () => {
    beforeEach(async () => {
      // Create multiple test items
      const items: CreateCredentialItemInput[] = [
        {
          title: 'First Item',
          type: 'password',
          vault_id: testVaultId,
          category_id: testCategoryId,
          website_url: null,
          username: null,
          password: null,
          notes: null,
          card_number: null,
          card_holder_name: null,
          card_expiry_date: null,
          card_cvv: null,
          license_key: null,
          license_email: null
        },
        {
          title: 'Second Item',
          type: 'credit_card',
          vault_id: testVaultId,
          category_id: null,
          website_url: null,
          username: null,
          password: null,
          notes: null,
          card_number: '4111111111111111',
          card_holder_name: 'Test User',
          card_expiry_date: '12/25',
          card_cvv: '123',
          license_key: null,
          license_email: null
        }
      ];

      for (const item of items) {
        await createCredentialItem(item, testUserId);
      }
    });

    it('should return all items in vault for authorized user', async () => {
      const result = await getItemsByVault(testVaultId, testUserId);

      expect(result).toHaveLength(2);
      expect(result[0].title).toEqual('First Item');
      expect(result[1].title).toEqual('Second Item');
      expect(result[1].card_number_encrypted).toEqual('4111111111111111'); // Decrypted
    });

    it('should reject access without vault permissions', async () => {
      await expect(getItemsByVault(testVaultId, testUser2Id)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should return empty array for non-existent vault', async () => {
      await expect(getItemsByVault(99999, testUserId)).rejects.toThrow(/insufficient permissions/i);
    });
  });

  describe('getItemById', () => {
    let testItemId: number;

    beforeEach(async () => {
      const input: CreateCredentialItemInput = {
        title: 'Test Item',
        type: 'password',
        vault_id: testVaultId,
        category_id: null,
        website_url: null,
        username: 'testuser',
        password: 'secret123',
        notes: null,
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      const item = await createCredentialItem(input, testUserId);
      testItemId = item.id;
    });

    it('should return item by ID for authorized user', async () => {
      const result = await getItemById(testItemId, testUserId);

      expect(result).not.toBeNull();
      expect(result!.title).toEqual('Test Item');
      expect(result!.username).toEqual('testuser');
      expect(result!.password_encrypted).toEqual('secret123'); // Decrypted
    });

    it('should reject access without vault permissions', async () => {
      await expect(getItemById(testItemId, testUser2Id)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should return null for non-existent item', async () => {
      const result = await getItemById(99999, testUserId);
      expect(result).toBeNull();
    });
  });

  describe('searchItems', () => {
    beforeEach(async () => {
      const items: CreateCredentialItemInput[] = [
        {
          title: 'Gmail Login',
          type: 'password',
          vault_id: testVaultId,
          category_id: testCategoryId,
          website_url: 'https://gmail.com',
          username: 'test@gmail.com',
          password: 'gmail_pass',
          notes: 'Email account',
          card_number: null,
          card_holder_name: null,
          card_expiry_date: null,
          card_cvv: null,
          license_key: null,
          license_email: null
        },
        {
          title: 'Bank Credit Card',
          type: 'credit_card',
          vault_id: testVaultId,
          category_id: null,
          website_url: 'https://bank.com',
          username: null,
          password: null,
          notes: null,
          card_number: '4111111111111111',
          card_holder_name: 'Test User',
          card_expiry_date: '12/25',
          card_cvv: '123',
          license_key: null,
          license_email: null
        },
        {
          title: 'Software License',
          type: 'software_license',
          vault_id: testVaultId,
          category_id: testCategoryId,
          website_url: null,
          username: null,
          password: null,
          notes: null,
          card_number: null,
          card_holder_name: null,
          card_expiry_date: null,
          card_cvv: null,
          license_key: 'LICENSE123',
          license_email: 'license@example.com'
        }
      ];

      for (const item of items) {
        await createCredentialItem(item, testUserId);
      }
    });

    it('should search items by title', async () => {
      const input: SearchItemsInput = {
        vault_id: testVaultId,
        query: 'Gmail'
      };

      const result = await searchItems(input, testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Gmail Login');
    });

    it('should search items by title case-insensitive', async () => {
      const input: SearchItemsInput = {
        vault_id: testVaultId,
        query: 'gmail'
      };

      const result = await searchItems(input, testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].title).toEqual('Gmail Login');
    });

    it('should filter items by type', async () => {
      const input: SearchItemsInput = {
        vault_id: testVaultId,
        type: 'credit_card'
      };

      const result = await searchItems(input, testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toEqual('credit_card');
    });

    it('should filter items by category', async () => {
      const input: SearchItemsInput = {
        vault_id: testVaultId,
        category_id: testCategoryId
      };

      const result = await searchItems(input, testUserId);

      expect(result).toHaveLength(2); // Gmail and Software License
      expect(result.every(item => item.category_id === testCategoryId)).toBe(true);
    });

    it('should filter items with null category', async () => {
      const input: SearchItemsInput = {
        vault_id: testVaultId,
        category_id: null
      };

      const result = await searchItems(input, testUserId);

      expect(result).toHaveLength(1); // Bank Credit Card
      expect(result[0].category_id).toBeNull();
    });

    it('should reject search without vault permissions', async () => {
      const input: SearchItemsInput = {
        vault_id: testVaultId,
        query: 'test'
      };

      await expect(searchItems(input, testUser2Id)).rejects.toThrow(/insufficient permissions/i);
    });
  });

  describe('deleteCredentialItem', () => {
    let testItemId: number;

    beforeEach(async () => {
      const input: CreateCredentialItemInput = {
        title: 'Item to Delete',
        type: 'password',
        vault_id: testVaultId,
        category_id: null,
        website_url: null,
        username: null,
        password: 'secret123',
        notes: null,
        card_number: null,
        card_holder_name: null,
        card_expiry_date: null,
        card_cvv: null,
        license_key: null,
        license_email: null
      };

      const item = await createCredentialItem(input, testUserId);
      testItemId = item.id;
    });

    it('should delete credential item', async () => {
      const result = await deleteCredentialItem(testItemId, testUserId);

      expect(result.success).toBe(true);

      // Verify item is deleted
      const dbItems = await db.select()
        .from(credentialItemsTable)
        .where(eq(credentialItemsTable.id, testItemId))
        .execute();

      expect(dbItems).toHaveLength(0);
    });

    it('should reject deletion without vault permissions', async () => {
      await expect(deleteCredentialItem(testItemId, testUser2Id)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should reject deletion of non-existent item', async () => {
      await expect(deleteCredentialItem(99999, testUserId)).rejects.toThrow(/not found/i);
    });
  });
});