/**
 * File: navigation.ts
 * Description: Shared public-site navigation data and lightweight helpers.
 */
import type { PublicHref } from '@app/public/public-routes';

export type PublicNavItem = {
  href: PublicHref;
  label: string;
};

export const PUBLIC_PRIMARY_NAV: PublicNavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: '/support', label: 'Support' },
  { href: '/nexus/dashboard', label: 'Nexus' },
];

export const PUBLIC_FOOTER_NAV: PublicNavItem[] = PUBLIC_PRIMARY_NAV.filter(
  (item) => item.href !== '/nexus/dashboard',
);

export const publicNavItems = PUBLIC_PRIMARY_NAV;

/**
 * Inputs: a public navigation item.
 * Output: the item's href in the format expected by expo-router Link.
 */
export function getPublicNavHref(item: Pick<PublicNavItem, 'href'>): PublicHref {
  return item.href;
}

/**
 * Inputs: the current pathname and a public navigation item.
 * Output: true when the item should render as active for the current route.
 */
export function isPublicNavItemActive(
  pathname: string | null | undefined,
  item: Pick<PublicNavItem, 'href'>,
): boolean {
  if (!pathname) {
    return false;
  }

  if (item.href === '/') {
    return pathname === '/';
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
