import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  updateUserInputSchema,
  createVaultInputSchema,
  updateVaultInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createCredentialItemInputSchema,
  updateCredentialItemInputSchema,
  createVaultPermissionInputSchema,
  updateVaultPermissionInputSchema,
  generatePasswordInputSchema,
  searchItemsInputSchema
} from './schema';

// Import handlers
import { login, logout, validateSession } from './handlers/auth';
import { createUser, updateUser, getUsers, getUserById, deleteUser } from './handlers/users';
import { createVault, updateVault, getVaultsByUser, getVaultById, deleteVault } from './handlers/vaults';
import { createCategory, updateCategory, getCategoriesByVault, getCategoryById, deleteCategory } from './handlers/categories';
import {
  createCredentialItem,
  updateCredentialItem,
  getItemsByVault,
  getItemById,
  searchItems,
  deleteCredentialItem
} from './handlers/credential-items';
import {
  createVaultPermission,
  updateVaultPermission,
  getVaultPermissions,
  getUserPermissionForVault,
  revokeVaultPermission,
  getUserVaults
} from './handlers/vault-permissions';
import { generatePassword, calculatePasswordStrength } from './handlers/password-generator';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  logout: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(({ input }) => logout(input.token)),

  validateSession: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => validateSession(input.token)),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  getUserById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getUserById(input.id)),

  deleteUser: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteUser(input.id)),

  // Vault management routes
  createVault: publicProcedure
    .input(createVaultInputSchema)
    .mutation(({ input, ctx }) => {
      // In real implementation, extract userId from authenticated context
      const userId = 1; // Placeholder
      return createVault(input, userId);
    }),

  updateVault: publicProcedure
    .input(updateVaultInputSchema)
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return updateVault(input, userId);
    }),

  getVaultsByUser: publicProcedure
    .query(({ ctx }) => {
      const userId = 1; // Placeholder
      return getVaultsByUser(userId);
    }),

  getVaultById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getVaultById(input.id, userId);
    }),

  deleteVault: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return deleteVault(input.id, userId);
    }),

  // Category management routes
  createCategory: publicProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return createCategory(input, userId);
    }),

  updateCategory: publicProcedure
    .input(updateCategoryInputSchema)
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return updateCategory(input, userId);
    }),

  getCategoriesByVault: publicProcedure
    .input(z.object({ vaultId: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getCategoriesByVault(input.vaultId, userId);
    }),

  getCategoryById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getCategoryById(input.id, userId);
    }),

  deleteCategory: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return deleteCategory(input.id, userId);
    }),

  // Credential item management routes
  createCredentialItem: publicProcedure
    .input(createCredentialItemInputSchema)
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return createCredentialItem(input, userId);
    }),

  updateCredentialItem: publicProcedure
    .input(updateCredentialItemInputSchema)
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return updateCredentialItem(input, userId);
    }),

  getItemsByVault: publicProcedure
    .input(z.object({ vaultId: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getItemsByVault(input.vaultId, userId);
    }),

  getItemById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getItemById(input.id, userId);
    }),

  searchItems: publicProcedure
    .input(searchItemsInputSchema)
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return searchItems(input, userId);
    }),

  deleteCredentialItem: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return deleteCredentialItem(input.id, userId);
    }),

  // Vault permission management routes
  createVaultPermission: publicProcedure
    .input(createVaultPermissionInputSchema)
    .mutation(({ input, ctx }) => {
      const grantedByUserId = 1; // Placeholder
      return createVaultPermission(input, grantedByUserId);
    }),

  updateVaultPermission: publicProcedure
    .input(updateVaultPermissionInputSchema)
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return updateVaultPermission(input, userId);
    }),

  getVaultPermissions: publicProcedure
    .input(z.object({ vaultId: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getVaultPermissions(input.vaultId, userId);
    }),

  getUserPermissionForVault: publicProcedure
    .input(z.object({ vaultId: z.number() }))
    .query(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return getUserPermissionForVault(input.vaultId, userId);
    }),

  revokeVaultPermission: publicProcedure
    .input(z.object({ permissionId: z.number() }))
    .mutation(({ input, ctx }) => {
      const userId = 1; // Placeholder
      return revokeVaultPermission(input.permissionId, userId);
    }),

  getUserVaults: publicProcedure
    .query(({ ctx }) => {
      const userId = 1; // Placeholder
      return getUserVaults(userId);
    }),

  // Password generation routes
  generatePassword: publicProcedure
    .input(generatePasswordInputSchema)
    .mutation(({ input }) => generatePassword(input)),

  calculatePasswordStrength: publicProcedure
    .input(z.object({ password: z.string() }))
    .query(({ input }) => calculatePasswordStrength(input.password))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Password Manager TRPC server listening at port: ${port}`);
}

start();