import { serial, text, pgTable, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const itemTypeEnum = pgEnum('item_type', ['password', 'credit_card', 'secure_note', 'software_license']);
export const vaultPermissionEnum = pgEnum('vault_permission', ['read', 'write', 'admin']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  password_hash: text('password_hash').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Vaults table
export const vaultsTable = pgTable('vaults', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  owner_id: integer('owner_id').notNull(),
  is_shared: boolean('is_shared').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  color: text('color'), // Nullable hex color code
  vault_id: integer('vault_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Credential items table
export const credentialItemsTable = pgTable('credential_items', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  type: itemTypeEnum('type').notNull(),
  vault_id: integer('vault_id').notNull(),
  category_id: integer('category_id'), // Nullable
  website_url: text('website_url'), // Nullable
  username: text('username'), // Nullable
  password_encrypted: text('password_encrypted'), // Nullable, encrypted password
  notes_encrypted: text('notes_encrypted'), // Nullable, encrypted notes
  card_number_encrypted: text('card_number_encrypted'), // Nullable, encrypted card number
  card_holder_name: text('card_holder_name'), // Nullable
  card_expiry_date: text('card_expiry_date'), // Nullable, format: MM/YY
  card_cvv_encrypted: text('card_cvv_encrypted'), // Nullable, encrypted CVV
  license_key_encrypted: text('license_key_encrypted'), // Nullable, encrypted license key
  license_email: text('license_email'), // Nullable
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Vault user permissions table
export const vaultUserPermissionsTable = pgTable('vault_user_permissions', {
  id: serial('id').primaryKey(),
  vault_id: integer('vault_id').notNull(),
  user_id: integer('user_id').notNull(),
  permission: vaultPermissionEnum('permission').notNull(),
  granted_by: integer('granted_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  ownedVaults: many(vaultsTable),
  createdItems: many(credentialItemsTable),
  vaultPermissions: many(vaultUserPermissionsTable),
  grantedPermissions: many(vaultUserPermissionsTable, { relationName: 'grantedBy' })
}));

export const vaultsRelations = relations(vaultsTable, ({ one, many }) => ({
  owner: one(usersTable, {
    fields: [vaultsTable.owner_id],
    references: [usersTable.id]
  }),
  categories: many(categoriesTable),
  items: many(credentialItemsTable),
  userPermissions: many(vaultUserPermissionsTable)
}));

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  vault: one(vaultsTable, {
    fields: [categoriesTable.vault_id],
    references: [vaultsTable.id]
  }),
  items: many(credentialItemsTable)
}));

export const credentialItemsRelations = relations(credentialItemsTable, ({ one }) => ({
  vault: one(vaultsTable, {
    fields: [credentialItemsTable.vault_id],
    references: [vaultsTable.id]
  }),
  category: one(categoriesTable, {
    fields: [credentialItemsTable.category_id],
    references: [categoriesTable.id]
  }),
  creator: one(usersTable, {
    fields: [credentialItemsTable.created_by],
    references: [usersTable.id]
  })
}));

export const vaultUserPermissionsRelations = relations(vaultUserPermissionsTable, ({ one }) => ({
  vault: one(vaultsTable, {
    fields: [vaultUserPermissionsTable.vault_id],
    references: [vaultsTable.id]
  }),
  user: one(usersTable, {
    fields: [vaultUserPermissionsTable.user_id],
    references: [usersTable.id]
  }),
  grantedBy: one(usersTable, {
    fields: [vaultUserPermissionsTable.granted_by],
    references: [usersTable.id],
    relationName: 'grantedBy'
  })
}));

// TypeScript types for database operations
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Vault = typeof vaultsTable.$inferSelect;
export type NewVault = typeof vaultsTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type CredentialItem = typeof credentialItemsTable.$inferSelect;
export type NewCredentialItem = typeof credentialItemsTable.$inferInsert;

export type VaultUserPermission = typeof vaultUserPermissionsTable.$inferSelect;
export type NewVaultUserPermission = typeof vaultUserPermissionsTable.$inferInsert;

// Export all tables for drizzle relation queries
export const tables = {
  users: usersTable,
  vaults: vaultsTable,
  categories: categoriesTable,
  credentialItems: credentialItemsTable,
  vaultUserPermissions: vaultUserPermissionsTable
};