import { z } from 'zod';

// User role enum schema
export const userRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string(),
  role: userRoleSchema,
  password_hash: z.string(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type User = z.infer<typeof userSchema>;

// Input schemas for user operations
export const createUserInputSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: userRoleSchema,
  password: z.string().min(8)
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  full_name: z.string().min(1).optional(),
  role: userRoleSchema.optional(),
  is_active: z.boolean().optional()
});
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export type LoginInput = z.infer<typeof loginInputSchema>;

// Vault schema
export const vaultSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  owner_id: z.number(),
  is_shared: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Vault = z.infer<typeof vaultSchema>;

export const createVaultInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  is_shared: z.boolean().default(false)
});
export type CreateVaultInput = z.infer<typeof createVaultInputSchema>;

export const updateVaultInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  is_shared: z.boolean().optional()
});
export type UpdateVaultInput = z.infer<typeof updateVaultInputSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  vault_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Category = z.infer<typeof categorySchema>;

export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  color: z.string().nullable(),
  vault_id: z.number()
});
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional()
});
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Credential item type enum
export const itemTypeSchema = z.enum(['password', 'credit_card', 'secure_note', 'software_license']);
export type ItemType = z.infer<typeof itemTypeSchema>;

// Credential item schema
export const credentialItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  type: itemTypeSchema,
  vault_id: z.number(),
  category_id: z.number().nullable(),
  website_url: z.string().nullable(),
  username: z.string().nullable(),
  password_encrypted: z.string().nullable(),
  notes_encrypted: z.string().nullable(),
  card_number_encrypted: z.string().nullable(),
  card_holder_name: z.string().nullable(),
  card_expiry_date: z.string().nullable(),
  card_cvv_encrypted: z.string().nullable(),
  license_key_encrypted: z.string().nullable(),
  license_email: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type CredentialItem = z.infer<typeof credentialItemSchema>;

export const createCredentialItemInputSchema = z.object({
  title: z.string().min(1),
  type: itemTypeSchema,
  vault_id: z.number(),
  category_id: z.number().nullable(),
  website_url: z.string().nullable(),
  username: z.string().nullable(),
  password: z.string().nullable(),
  notes: z.string().nullable(),
  card_number: z.string().nullable(),
  card_holder_name: z.string().nullable(),
  card_expiry_date: z.string().nullable(),
  card_cvv: z.string().nullable(),
  license_key: z.string().nullable(),
  license_email: z.string().nullable()
});
export type CreateCredentialItemInput = z.infer<typeof createCredentialItemInputSchema>;

export const updateCredentialItemInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  category_id: z.number().nullable().optional(),
  website_url: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  card_number: z.string().nullable().optional(),
  card_holder_name: z.string().nullable().optional(),
  card_expiry_date: z.string().nullable().optional(),
  card_cvv: z.string().nullable().optional(),
  license_key: z.string().nullable().optional(),
  license_email: z.string().nullable().optional()
});
export type UpdateCredentialItemInput = z.infer<typeof updateCredentialItemInputSchema>;

// Vault permission enum
export const vaultPermissionSchema = z.enum(['read', 'write', 'admin']);
export type VaultPermission = z.infer<typeof vaultPermissionSchema>;

// Vault user permission schema
export const vaultUserPermissionSchema = z.object({
  id: z.number(),
  vault_id: z.number(),
  user_id: z.number(),
  permission: vaultPermissionSchema,
  granted_by: z.number(),
  created_at: z.coerce.date()
});
export type VaultUserPermission = z.infer<typeof vaultUserPermissionSchema>;

export const createVaultPermissionInputSchema = z.object({
  vault_id: z.number(),
  user_id: z.number(),
  permission: vaultPermissionSchema
});
export type CreateVaultPermissionInput = z.infer<typeof createVaultPermissionInputSchema>;

export const updateVaultPermissionInputSchema = z.object({
  id: z.number(),
  permission: vaultPermissionSchema
});
export type UpdateVaultPermissionInput = z.infer<typeof updateVaultPermissionInputSchema>;

// Password generation schema
export const generatePasswordInputSchema = z.object({
  length: z.number().min(4).max(128).default(16),
  include_uppercase: z.boolean().default(true),
  include_lowercase: z.boolean().default(true),
  include_numbers: z.boolean().default(true),
  include_symbols: z.boolean().default(true),
  exclude_ambiguous: z.boolean().default(false)
});
export type GeneratePasswordInput = z.infer<typeof generatePasswordInputSchema>;

export const generatedPasswordSchema = z.object({
  password: z.string(),
  strength: z.number().min(0).max(100)
});
export type GeneratedPassword = z.infer<typeof generatedPasswordSchema>;

// Search and filter schemas
export const searchItemsInputSchema = z.object({
  vault_id: z.number().optional(),
  category_id: z.number().nullable().optional(),
  type: itemTypeSchema.optional(),
  query: z.string().optional()
});
export type SearchItemsInput = z.infer<typeof searchItemsInputSchema>;

// Session schema for authentication
export const sessionSchema = z.object({
  user: userSchema,
  token: z.string(),
  expires_at: z.coerce.date()
});
export type Session = z.infer<typeof sessionSchema>;