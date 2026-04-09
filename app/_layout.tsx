/**
 * File: _layout.tsx
 * Description: Provides the root app stack and swaps between the public shell and the dedicated nexus shell.
 */
import '../global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import Footer from '@/components/layout/footer';
import Header from '@/components/layout/header';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Inputs: none.
 * Output: themed route layout with the public shell hidden on `/nexus/*` routes.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const isNexusRoute = pathname?.startsWith('/nexus') ?? false;

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: 'transparent',
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="docs" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="nexus" />
    </Stack>
  );

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {isNexusRoute ? (
        <View style={styles.nexusRoot}>{stack}</View>
      ) : (
        <View style={styles.appShell}>
          <Header />

          <View style={styles.mainContent}>{stack}</View>

          <Footer />
        </View>
      )}

      <StatusBar style="light" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    minHeight: '100%',
    backgroundColor: '#0b1020',
  },
  mainContent: {
    flex: 1,
  },
  nexusRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
