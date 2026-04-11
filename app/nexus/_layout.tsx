/**
 * File: _layout.tsx
 * Description: Provides the dedicated shell and nested stack for all nexus routes.
 */
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';

import NexusShell from '@/components/nexus/nexus-shell';
import {
  NexusShellProvider,
  useNexusShell,
} from '@/components/nexus/nexus-shell-context';

/**
 * Inputs: none.
 * Output: the themed Nexus stack and shell using the current Nexus shell preferences.
 */
function NexusLayoutContent() {
  const { themeMode } = useNexusShell();
  const stackBackgroundColor = themeMode === 'dark' ? '#06111a' : '#f1f5f9';

  return (
    <ThemeProvider value={themeMode === 'dark' ? DarkTheme : DefaultTheme}>
      <NexusShell>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'none',
            contentStyle: {
              backgroundColor: stackBackgroundColor,
            },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="discussions" />
          <Stack.Screen name="votes" />
          <Stack.Screen name="library" />
          <Stack.Screen name="account" />
          <Stack.Screen name="identity/sign-in" />
          <Stack.Screen name="identity/create" />
          <Stack.Screen name="identity/claim" />
          <Stack.Screen name="identity/restore" />
          <Stack.Screen name="identity/security" />
        </Stack>
      </NexusShell>
    </ThemeProvider>
  );
}

/**
 * Inputs: none.
 * Output: the nested nexus route stack wrapped in the shared nexus shell.
 */
export default function NexusLayout() {
  return (
    <NexusShellProvider>
      <NexusLayoutContent />
    </NexusShellProvider>
  );
}
