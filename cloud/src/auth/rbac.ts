/**
 * Role-Based Access Control (RBAC) for ContextKit Cloud.
 *
 * RBAC is only enforced for Enterprise plan orgs (via `canUseFeature(org, 'rbac')`).
 * For non-Enterprise orgs, all authenticated users have admin access.
 *
 * Roles:
 *   - viewer: read-only access
 *   - editor: read + propose changes
 *   - admin:  full access (approve, manage roles, billing)
 *
 * Permissions are per-org with optional per-product overrides.
 */

import type { Context, Next } from 'hono';
import { getAuthUser } from './clerk.js';
import { canUseFeature } from '../billing/stripe.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = 'viewer' | 'editor' | 'admin';

export type Action = 'read' | 'write' | 'publish' | 'manage_roles' | 'manage_billing';

/** Key for the role store: `${org}:${userId}` or `${org}:${userId}:${product}` */
type RoleKey = string;

// ---------------------------------------------------------------------------
// Role -> Action mapping
// ---------------------------------------------------------------------------

const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  viewer: ['read'],
  editor: ['read', 'write'],
  admin: ['read', 'write', 'publish', 'manage_roles', 'manage_billing'],
};

// ---------------------------------------------------------------------------
// In-memory role store
// ---------------------------------------------------------------------------

const roleStore = new Map<RoleKey, Role>();

function makeKey(org: string, userId: string, product?: string): RoleKey {
  return product ? `${org}:${userId}:${product}` : `${org}:${userId}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assign a role to a user within an org. Optionally scope to a specific
 * data product.
 */
export function assignRole(
  org: string,
  userId: string,
  role: Role,
  product?: string,
): void {
  roleStore.set(makeKey(org, userId, product), role);
}

/**
 * Remove a role assignment. If product is specified, only the product-level
 * assignment is removed.
 */
export function removeRole(org: string, userId: string, product?: string): void {
  roleStore.delete(makeKey(org, userId, product));
}

/**
 * Get the effective role for a user in an org.
 *
 * Resolution order:
 *   1. Product-specific role (if product is given and a role exists)
 *   2. Org-level role
 *   3. undefined (no role assigned)
 *
 * If RBAC is not enabled for the org (non-Enterprise), returns 'admin'.
 */
export function getRole(org: string, userId: string, product?: string): Role | undefined {
  if (!canUseFeature(org, 'rbac')) {
    return 'admin';
  }

  if (product) {
    const productRole = roleStore.get(makeKey(org, userId, product));
    if (productRole) return productRole;
  }

  return roleStore.get(makeKey(org, userId));
}

/**
 * Check whether a user has permission to perform an action.
 *
 * Returns true if:
 *   - RBAC is not enabled for the org (non-Enterprise => admin), OR
 *   - The user's effective role includes the requested action.
 */
export function checkPermission(
  org: string,
  userId: string,
  action: Action,
  product?: string,
): boolean {
  const role = getRole(org, userId, product);
  if (!role) return false;
  return ROLE_ACTIONS[role].includes(action);
}

/**
 * Hono middleware factory that checks if the authenticated user has
 * permission to perform the given action.
 *
 * The org is read from the route param `:org` or from the auth user's orgId.
 * The product can be a static string or read from the route param `:product`.
 *
 * Returns 403 if the user lacks the required permission.
 * Returns 401 if no authenticated user is found.
 */
export function requirePermission(action: Action, product?: string) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const user = getAuthUser(c);
    if (!user) {
      return c.json({ error: 'Unauthorized: no authenticated user' }, 401);
    }

    // Determine org: prefer route param, fall back to auth user's orgId
    const org = c.req.param('org') ?? user.orgId;
    if (!org) {
      return c.json({ error: 'Forbidden: no org context' }, 403);
    }

    // Determine product: use static value or route param
    const effectiveProduct = product ?? c.req.param('product');

    if (!checkPermission(org, user.userId, action, effectiveProduct)) {
      return c.json(
        { error: `Forbidden: requires '${action}' permission` },
        403,
      );
    }

    await next();
  };
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

/** Clear all role assignments. Exported for tests. */
export function _resetRoles(): void {
  roleStore.clear();
}
