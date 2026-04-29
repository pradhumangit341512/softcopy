/**
 * Per-member permission resolver — F24 (Enterprise tier).
 *
 * Layered access model:
 *   1. Role baseline    — what every user with that role gets by default.
 *      Same baseline that's been enforced via authorize.ts since day one.
 *   2. Per-user grant   — admin can add an extra capability via
 *      User.permissions[key] = true.
 *   3. Per-user revoke  — admin can take a baseline capability away via
 *      User.permissions[key] = false (e.g. "view-only" senior support).
 *
 * Gated by feature.granular_permissions on the Company. When the feature
 * is OFF, can() ignores `User.permissions` entirely and returns the role
 * baseline — keeps companies on lower plans unaffected if a row was
 * accidentally written.
 */

export const PERMISSION_KEYS = [
  // Clients
  'clients.read.all',          // see other teammates' leads
  'clients.create',
  'clients.update.all',
  'clients.delete',
  'clients.export',
  'clients.bulk_import',
  // Properties / Inventory
  'properties.read.all',
  'properties.create',
  'properties.update.all',
  'properties.delete',
  'properties.export',
  'properties.bulk_import',
  // Projects Working
  'projects.read.all',
  'projects.create',
  'projects.update.all',
  'projects.delete',
  // Brokers Requirements
  'broker_reqs.read.all',
  'broker_reqs.create',
  'broker_reqs.update.all',
  'broker_reqs.delete',
  // Commissions
  'commissions.read.all',
  'commissions.create',
  'commissions.update.all',
  'commissions.delete',
  // Team / company
  'team.read',
  'team.invite',
  'team.update',
  'analytics.read',
  'settings.update',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_GROUPS: Record<string, ReadonlyArray<PermissionKey>> = {
  Clients: [
    'clients.read.all',
    'clients.create',
    'clients.update.all',
    'clients.delete',
    'clients.export',
    'clients.bulk_import',
  ],
  Inventory: [
    'properties.read.all',
    'properties.create',
    'properties.update.all',
    'properties.delete',
    'properties.export',
    'properties.bulk_import',
  ],
  Projects: [
    'projects.read.all',
    'projects.create',
    'projects.update.all',
    'projects.delete',
  ],
  'Brokers Requirements': [
    'broker_reqs.read.all',
    'broker_reqs.create',
    'broker_reqs.update.all',
    'broker_reqs.delete',
  ],
  Commissions: [
    'commissions.read.all',
    'commissions.create',
    'commissions.update.all',
    'commissions.delete',
  ],
  Company: [
    'team.read',
    'team.invite',
    'team.update',
    'analytics.read',
    'settings.update',
  ],
};

/** Role baseline — capabilities every user with that role gets without
 *  any per-user overrides. */
export const ROLE_BASELINES: Record<string, ReadonlyArray<PermissionKey>> = {
  superadmin: [...PERMISSION_KEYS],
  admin: [...PERMISSION_KEYS],
  user: [
    // Read + write on own rows is enforced by API filters; the keys below
    // are the cross-team capabilities a `user` does NOT have by default.
    // List intentionally short — the admin can grant more via F24.
    'clients.create',
    'properties.create',
    'broker_reqs.create',
  ],
};

export function isValidPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && (PERMISSION_KEYS as ReadonlyArray<string>).includes(value);
}

export function asOverrideMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export interface PermissionInputs {
  role: string;
  /** User.permissions Json field — null/undefined for no overrides. */
  permissions?: unknown;
  /** Optional: pass in the company's feature-set so we can short-circuit
   *  the override layer when feature.granular_permissions is OFF. */
  companyHasGranularFeature?: boolean;
}

/**
 * Decide if a user can perform `action`.
 *
 * Resolution order: role baseline → grant (true) → revoke (false).
 */
export function can(
  inputs: PermissionInputs,
  action: PermissionKey
): boolean {
  const baseline = ROLE_BASELINES[inputs.role] ?? [];
  const baseAllowed = baseline.includes(action);

  // If the company doesn't have F24, ignore overrides — preserves the
  // role-only behaviour for plans below Enterprise.
  if (inputs.companyHasGranularFeature === false) {
    return baseAllowed;
  }

  const overrides = asOverrideMap(inputs.permissions);
  if (Object.prototype.hasOwnProperty.call(overrides, action)) {
    return overrides[action] === true;
  }
  return baseAllowed;
}
