/**
 * File: index.tsx
 * Description: Redirects the portal entry route to the dashboard surface.
 */
import { Redirect } from 'expo-router';

/**
 * Inputs: none.
 * Output: a redirect from `/portal` to `/portal/dashboard`.
 */
export default function PortalIndexPage() {
  return <Redirect href="/portal/dashboard" />;
}
