/**
 * File: _layout.tsx
 * Description: Provides the dedicated shell and nested stack for all nexus routes.
 */
import { Stack } from 'expo-router';

import NexusShell from '@/components/nexus/nexus-shell';
import { NexusShellProvider } from '@/components/nexus/nexus-shell-context';

/**
 * Inputs: none.
 * Output: the nested nexus route stack wrapped in the shared nexus shell.
 */
export default function NexusLayout() {
  return (
    <NexusShellProvider>
      <NexusShell>
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
      </NexusShell>
    </NexusShellProvider>
  );
}
