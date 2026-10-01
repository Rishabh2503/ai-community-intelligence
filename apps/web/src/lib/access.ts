import type { AuthUser } from './api';

export type Role = 'MEMBER' | 'ORGANIZER' | 'ADMIN';

/**
 * Single source of truth for route permissions.
 *
 * Both the navigation filter (AppShell) and the page guard (RequireRole) read
 * this map, so a route can never appear in the menu while being blocked by the
 * guard - or worse, the other way round (DRY).
 *
 * Routes that are not listed here are public.
 */
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/moderation': ['ADMIN'],
  '/analytics': ['ORGANIZER', 'ADMIN'],
};

export const rolesFor = (href: string): Role[] | undefined => ROUTE_ROLES[href];

/** A route is visible when it is public, or when the signed-in user holds an allowed role. */
export const canAccess = (href: string, user: AuthUser | null): boolean => {
  const allowed = rolesFor(href);
  if (!allowed) return true;
  if (!user) return false;
  return allowed.includes(user.role);
};

export const describeRoles = (roles: Role[]): string =>
  roles.map((role) => role.charAt(0) + role.slice(1).toLowerCase()).join(' or ');
