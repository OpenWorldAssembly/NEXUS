/**
 * File: signup.tsx
 * Description: Redirects the legacy public signup route into the Nexus identity workspace.
 */

import { Redirect } from 'expo-router';

export default function SignupRedirectPage() {
  return <Redirect href="/nexus/identity/create" />;
}
