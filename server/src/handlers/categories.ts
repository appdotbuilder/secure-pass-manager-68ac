import { db } from '../db';
import { categoriesTable, vaultsTable, vaultUserPermissionsTable, credentialItemsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq, and, or, isNull, asc } from 'drizzle-orm';

// Helper function to check vault permissions
async function checkVaultPermission(vaultId: number, userId: number, requiredPermission: 'read' | 'write' | 'admin'): Promise<boolean> {
  try {
    // Check if user is the vault owner
    const vault = await db.select()
      .from(vaultsTable)
      .where(eq(vaultsTable.id, vaultId))
      .limit(1)
      .execute();

    if (!vault.length) {
      return false; // Vault doesn't exist
    }

    if (vault[0].owner_id === userId) {
      return true; // Owner has all permissions
    }

    // Check explicit permissions
    const permissions = await db.select()
      .from(vaultUserPermissionsTable)
      .where(and(
        eq(vaultUserPermissionsTable.vault_id, vaultId),
        eq(vaultUserPermissionsTable.user_id, userId)
      ))
      .limit(1)
      .execute();

    if (!permissions.length) {
      return false;
    }

    const userPermission = permissions[0].permission;

    // Permission hierarchy: admin > write > read
    switch (requiredPermission) {
      case 'read':
        return ['read', 'write', 'admin'].includes(userPermission);
      case 'write':
        return ['write', 'admin'].includes(userPermission);
      case 'admin':
        return userPermission === 'admin';
      default:
        return false;
    }
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

export async function createCategory(input: CreateCategoryInput, userId: number): Promise<Category> {
  try {
    // Validate vault access and write permissions
    const hasPermission = await checkVaultPermission(input.vault_id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to create category in this vault');
    }

    // Insert new category
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description,
        color: input.color,
        vault_id: input.vault_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}

export async function updateCategory(input: UpdateCategoryInput, userId: number): Promise<Category> {
  try {
    // First, get the existing category to check vault permissions
    const existingCategory = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.id))
      .limit(1)
      .execute();

    if (!existingCategory.length) {
      throw new Error('Category not found');
    }

    // Check vault permissions
    const hasPermission = await checkVaultPermission(existingCategory[0].vault_id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to update this category');
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.color !== undefined) {
      updateData.color = input.color;
    }

    // Update category
    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
}

export async function getCategoriesByVault(vaultId: number, userId: number): Promise<Category[]> {
  try {
    // Validate vault access
    const hasPermission = await checkVaultPermission(vaultId, userId, 'read');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to access this vault');
    }

    // Get all categories in the vault, sorted by name
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.vault_id, vaultId))
      .orderBy(asc(categoriesTable.name))
      .execute();

    return categories;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: number, userId: number): Promise<Category | null> {
  try {
    // Get the category
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .limit(1)
      .execute();

    if (!categories.length) {
      return null;
    }

    const category = categories[0];

    // Check vault permissions
    const hasPermission = await checkVaultPermission(category.vault_id, userId, 'read');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to access this category');
    }

    return category;
  } catch (error) {
    console.error('Failed to fetch category:', error);
    throw error;
  }
}

export async function deleteCategory(id: number, userId: number): Promise<{ success: boolean }> {
  try {
    // First, get the category to check permissions
    const categories = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .limit(1)
      .execute();

    if (!categories.length) {
      throw new Error('Category not found');
    }

    const category = categories[0];

    // Check vault permissions
    const hasPermission = await checkVaultPermission(category.vault_id, userId, 'write');
    if (!hasPermission) {
      throw new Error('Insufficient permissions to delete this category');
    }

    // Handle orphaned items by setting their category_id to null
    await db.update(credentialItemsTable)
      .set({ category_id: null })
      .where(eq(credentialItemsTable.category_id, id))
      .execute();

    // Delete the category
    await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
}