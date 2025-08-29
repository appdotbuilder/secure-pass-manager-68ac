import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, vaultsTable, categoriesTable, vaultUserPermissionsTable, credentialItemsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  updateCategory, 
  getCategoriesByVault, 
  getCategoryById, 
  deleteCategory 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';


describe('Categories Handlers', () => {
  let testUserId: number;
  let otherUserId: number;
  let testVaultId: number;
  let otherVaultId: number;
  let testCategoryId: number;

  beforeEach(async () => {
    await createDB();

    // Create test users
    const passwordHash = 'hashed_password_123';
    
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'user',
          password_hash: passwordHash,
          is_active: true
        },
        {
          email: 'other@example.com',
          full_name: 'Other User',
          role: 'user',
          password_hash: passwordHash,
          is_active: true
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    otherUserId = users[1].id;

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
          name: 'Other Vault',
          description: 'Another vault',
          owner_id: otherUserId,
          is_shared: false
        }
      ])
      .returning()
      .execute();

    testVaultId = vaults[0].id;
    otherVaultId = vaults[1].id;

    // Create a test category
    const categories = await db.insert(categoriesTable)
      .values({
        name: 'Existing Category',
        description: 'A pre-existing category',
        color: '#ff0000',
        vault_id: testVaultId
      })
      .returning()
      .execute();

    testCategoryId = categories[0].id;
  });

  afterEach(resetDB);

  describe('createCategory', () => {
    const validInput: CreateCategoryInput = {
      name: 'New Category',
      description: 'A new category for testing',
      color: '#00ff00',
      vault_id: 0 // Will be set in tests
    };

    it('should create a category when user owns the vault', async () => {
      const input = { ...validInput, vault_id: testVaultId };
      const result = await createCategory(input, testUserId);

      expect(result.name).toBe('New Category');
      expect(result.description).toBe('A new category for testing');
      expect(result.color).toBe('#00ff00');
      expect(result.vault_id).toBe(testVaultId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a category when user has write permissions', async () => {
      // Grant write permissions to other user
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'write',
          granted_by: testUserId
        })
        .execute();

      const input = { ...validInput, vault_id: testVaultId };
      const result = await createCategory(input, otherUserId);

      expect(result.name).toBe('New Category');
      expect(result.vault_id).toBe(testVaultId);
    });

    it('should save category to database', async () => {
      const input = { ...validInput, vault_id: testVaultId };
      const result = await createCategory(input, testUserId);

      const savedCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(savedCategory).toHaveLength(1);
      expect(savedCategory[0].name).toBe('New Category');
      expect(savedCategory[0].description).toBe('A new category for testing');
      expect(savedCategory[0].color).toBe('#00ff00');
      expect(savedCategory[0].vault_id).toBe(testVaultId);
    });

    it('should reject creation when user lacks permissions', async () => {
      const input = { ...validInput, vault_id: testVaultId };
      
      await expect(createCategory(input, otherUserId)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should reject creation for non-existent vault', async () => {
      const input = { ...validInput, vault_id: 99999 };
      
      await expect(createCategory(input, testUserId)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should create category with null values', async () => {
      const input: CreateCategoryInput = {
        name: 'Minimal Category',
        description: null,
        color: null,
        vault_id: testVaultId
      };

      const result = await createCategory(input, testUserId);

      expect(result.name).toBe('Minimal Category');
      expect(result.description).toBeNull();
      expect(result.color).toBeNull();
    });
  });

  describe('updateCategory', () => {
    it('should update category when user owns the vault', async () => {
      const input: UpdateCategoryInput = {
        id: testCategoryId,
        name: 'Updated Category',
        description: 'Updated description',
        color: '#0000ff'
      };

      const result = await updateCategory(input, testUserId);

      expect(result.name).toBe('Updated Category');
      expect(result.description).toBe('Updated description');
      expect(result.color).toBe('#0000ff');
      expect(result.id).toBe(testCategoryId);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update category when user has write permissions', async () => {
      // Grant write permissions
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'write',
          granted_by: testUserId
        })
        .execute();

      const input: UpdateCategoryInput = {
        id: testCategoryId,
        name: 'Updated by Other User'
      };

      const result = await updateCategory(input, otherUserId);
      expect(result.name).toBe('Updated by Other User');
    });

    it('should update only provided fields', async () => {
      const input: UpdateCategoryInput = {
        id: testCategoryId,
        name: 'Only Name Updated'
      };

      const result = await updateCategory(input, testUserId);

      expect(result.name).toBe('Only Name Updated');
      expect(result.description).toBe('A pre-existing category'); // Original value
      expect(result.color).toBe('#ff0000'); // Original value
    });

    it('should save updated category to database', async () => {
      const input: UpdateCategoryInput = {
        id: testCategoryId,
        name: 'Database Update Test',
        color: '#ffffff'
      };

      await updateCategory(input, testUserId);

      const savedCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, testCategoryId))
        .execute();

      expect(savedCategory[0].name).toBe('Database Update Test');
      expect(savedCategory[0].color).toBe('#ffffff');
      expect(savedCategory[0].description).toBe('A pre-existing category');
    });

    it('should reject update when user lacks permissions', async () => {
      const input: UpdateCategoryInput = {
        id: testCategoryId,
        name: 'Unauthorized Update'
      };

      await expect(updateCategory(input, otherUserId)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should reject update for non-existent category', async () => {
      const input: UpdateCategoryInput = {
        id: 99999,
        name: 'Non-existent Category'
      };

      await expect(updateCategory(input, testUserId)).rejects.toThrow(/category not found/i);
    });

    it('should allow setting fields to null', async () => {
      const input: UpdateCategoryInput = {
        id: testCategoryId,
        description: null,
        color: null
      };

      const result = await updateCategory(input, testUserId);

      expect(result.description).toBeNull();
      expect(result.color).toBeNull();
      expect(result.name).toBe('Existing Category'); // Unchanged
    });
  });

  describe('getCategoriesByVault', () => {
    beforeEach(async () => {
      // Create additional categories for testing
      await db.insert(categoriesTable)
        .values([
          {
            name: 'Z Category',
            description: 'Should appear last',
            color: '#123456',
            vault_id: testVaultId
          },
          {
            name: 'A Category',
            description: 'Should appear first',
            color: '#654321',
            vault_id: testVaultId
          }
        ])
        .execute();
    });

    it('should return categories when user owns the vault', async () => {
      const result = await getCategoriesByVault(testVaultId, testUserId);

      expect(result).toHaveLength(3); // Including the pre-existing category
      expect(result[0].name).toBe('A Category'); // Sorted alphabetically
      expect(result[1].name).toBe('Existing Category');
      expect(result[2].name).toBe('Z Category');
    });

    it('should return categories when user has read permissions', async () => {
      // Grant read permissions
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'read',
          granted_by: testUserId
        })
        .execute();

      const result = await getCategoriesByVault(testVaultId, otherUserId);
      expect(result).toHaveLength(3);
    });

    it('should return empty array for vault with no categories', async () => {
      const result = await getCategoriesByVault(otherVaultId, otherUserId);
      expect(result).toHaveLength(0);
    });

    it('should reject access when user lacks permissions', async () => {
      await expect(getCategoriesByVault(testVaultId, otherUserId)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should reject access for non-existent vault', async () => {
      await expect(getCategoriesByVault(99999, testUserId)).rejects.toThrow(/insufficient permissions/i);
    });
  });

  describe('getCategoryById', () => {
    it('should return category when user owns the vault', async () => {
      const result = await getCategoryById(testCategoryId, testUserId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(testCategoryId);
      expect(result!.name).toBe('Existing Category');
      expect(result!.description).toBe('A pre-existing category');
      expect(result!.color).toBe('#ff0000');
      expect(result!.vault_id).toBe(testVaultId);
    });

    it('should return category when user has read permissions', async () => {
      // Grant read permissions
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'read',
          granted_by: testUserId
        })
        .execute();

      const result = await getCategoryById(testCategoryId, otherUserId);
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Existing Category');
    });

    it('should return null for non-existent category', async () => {
      const result = await getCategoryById(99999, testUserId);
      expect(result).toBeNull();
    });

    it('should reject access when user lacks permissions', async () => {
      await expect(getCategoryById(testCategoryId, otherUserId)).rejects.toThrow(/insufficient permissions/i);
    });
  });

  describe('deleteCategory', () => {
    let itemWithCategoryId: number;

    beforeEach(async () => {
      // Create a credential item that uses the test category
      const items = await db.insert(credentialItemsTable)
        .values({
          title: 'Test Item',
          type: 'password',
          vault_id: testVaultId,
          category_id: testCategoryId,
          username: 'testuser',
          password_encrypted: 'encrypted_password',
          created_by: testUserId
        })
        .returning()
        .execute();

      itemWithCategoryId = items[0].id;
    });

    it('should delete category when user owns the vault', async () => {
      const result = await deleteCategory(testCategoryId, testUserId);

      expect(result.success).toBe(true);

      // Verify category is deleted
      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, testCategoryId))
        .execute();

      expect(categories).toHaveLength(0);
    });

    it('should delete category when user has write permissions', async () => {
      // Grant write permissions
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'write',
          granted_by: testUserId
        })
        .execute();

      const result = await deleteCategory(testCategoryId, otherUserId);
      expect(result.success).toBe(true);
    });

    it('should handle orphaned items by setting category_id to null', async () => {
      await deleteCategory(testCategoryId, testUserId);

      // Check that the item's category_id is now null
      const items = await db.select()
        .from(credentialItemsTable)
        .where(eq(credentialItemsTable.id, itemWithCategoryId))
        .execute();

      expect(items).toHaveLength(1);
      expect(items[0].category_id).toBeNull();
    });

    it('should reject deletion when user lacks permissions', async () => {
      await expect(deleteCategory(testCategoryId, otherUserId)).rejects.toThrow(/insufficient permissions/i);
    });

    it('should reject deletion for non-existent category', async () => {
      await expect(deleteCategory(99999, testUserId)).rejects.toThrow(/category not found/i);
    });
  });

  describe('permission hierarchy', () => {
    it('should allow admin permissions for all operations', async () => {
      // Grant admin permissions to other user
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'admin',
          granted_by: testUserId
        })
        .execute();

      // Test all operations work with admin permission
      const createInput: CreateCategoryInput = {
        name: 'Admin Created',
        description: 'Created by admin user',
        color: '#admin1',
        vault_id: testVaultId
      };

      const created = await createCategory(createInput, otherUserId);
      
      const updated = await updateCategory({
        id: created.id,
        name: 'Admin Updated'
      }, otherUserId);

      const categories = await getCategoriesByVault(testVaultId, otherUserId);
      const category = await getCategoryById(created.id, otherUserId);
      const deleted = await deleteCategory(created.id, otherUserId);

      expect(updated.name).toBe('Admin Updated');
      expect(categories.length).toBeGreaterThan(0);
      expect(category).not.toBeNull();
      expect(deleted.success).toBe(true);
    });

    it('should deny write operations with read-only permissions', async () => {
      // Grant only read permissions
      await db.insert(vaultUserPermissionsTable)
        .values({
          vault_id: testVaultId,
          user_id: otherUserId,
          permission: 'read',
          granted_by: testUserId
        })
        .execute();

      // Read operations should work
      const categories = await getCategoriesByVault(testVaultId, otherUserId);
      const category = await getCategoryById(testCategoryId, otherUserId);
      expect(categories).toBeDefined();
      expect(category).not.toBeNull();

      // Write operations should fail
      const createInput: CreateCategoryInput = {
        name: 'Should Fail',
        description: null,
        color: null,
        vault_id: testVaultId
      };

      await expect(createCategory(createInput, otherUserId)).rejects.toThrow(/insufficient permissions/i);
      await expect(updateCategory({ id: testCategoryId, name: 'Should Fail' }, otherUserId)).rejects.toThrow(/insufficient permissions/i);
      await expect(deleteCategory(testCategoryId, otherUserId)).rejects.toThrow(/insufficient permissions/i);
    });
  });
});