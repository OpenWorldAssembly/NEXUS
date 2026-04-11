/**
 * File: login.tsx
 * Description: Redirects the legacy public login route into the Nexus identity workspace.
 */

import { Redirect } from 'expo-router';

export default function LoginRedirectPage() {
  return <Redirect href="/nexus/identity/sign-in" />;
}
