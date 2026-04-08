/**
 * File: _layout.tsx
 * Description: Provides the dedicated shell and nested stack for all portal routes.
 */
import { Stack } from 'expo-router';

import PortalShell from '@/components/portal/portal-shell';
import { PortalShellProvider } from '@/components/portal/portal-shell-context';

/**
 * Inputs: none.
 * Output: the nested portal route stack wrapped in the shared portal shell.
 */
export default function PortalLayout() {
  return (
    <PortalShellProvider>
      <PortalShell>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="discussions" />
          <Stack.Screen name="votes" />
          <Stack.Screen name="library" />
          <Stack.Screen name="account" />
        </Stack>
      </PortalShell>
    </PortalShellProvider>
  );
}
