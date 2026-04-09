/**
 * File: index.tsx
 * Description: Redirects the nexus entry route to the dashboard surface.
 */
import { Redirect } from 'expo-router';

/**
 * Inputs: none.
 * Output: a redirect from `/nexus` to `/nexus/dashboard`.
 */
export default function NexusIndexPage() {
  return <Redirect href="/nexus/dashboard" />;
}
