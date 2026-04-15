/**
 * File: _layout.tsx
 * Description: Provides root providers and the top-level route stack for the public site and Nexus workspace.
 */
import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { IdentityShellProvider } from '@/components/nexus/identity-shell-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Inputs: none.
 * Output: themed root layout with separate route groups for the public site and Nexus shell.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <IdentityShellProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: 'transparent',
            },
          }}
        >
          <Stack.Screen name="(public)" />
          <Stack.Screen name="nexus" />
        </Stack>

        <StatusBar style="light" />
      </IdentityShellProvider>
    </ThemeProvider>
  );
}
