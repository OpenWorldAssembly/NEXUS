/**
 * File: (public)/_layout.tsx
 * Description: Wraps the public-site routes with the shared header, footer, and shell styling.
 */
import { Slot } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import Footer from '@/components/layout/footer';
import Header from '@/components/layout/header';

/**
 * Inputs: none.
 * Output: public-site shell with shared navigation chrome around nested public routes.
 */
export default function PublicLayout() {
  return (
    <View style={styles.appShell}>
      <Header />

      <View style={styles.mainContent}>
        <Slot />
      </View>

      <Footer />
    </View>
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
});
