/**
 * File: (public)/_layout.tsx
 * Description: Wraps the public-site routes with the shared header, footer, background, and shell styling.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';

import Footer from '@app/components/layout/footer';
import Header from '@app/components/layout/header';
import { homeNetworkBackgroundImageSource } from '@app/public/home-background-assets';

/**
 * Inputs: none.
 * Output: public-site shell with shared navigation chrome and atmospheric background around nested public routes.
 */
export default function PublicLayout() {
  return (
    <View className="bg-public-canvas" style={styles.appShell}>
      <Image
        pointerEvents="none"
        source={homeNetworkBackgroundImageSource}
        contentFit="cover"
        contentPosition="center"
        style={styles.richBackgroundImage}
      />
      <View pointerEvents="none" style={styles.richBackgroundVeil} />
      <View pointerEvents="none" style={styles.richBackgroundHorizonGlow} />

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
    overflow: 'hidden',
    position: 'relative',
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  richBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    height: '100%',
    opacity: 0.48,
    width: '100%',
  },
  richBackgroundVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 17, 28, 0.62)',
  },
  richBackgroundHorizonGlow: {
    bottom: 0,
    height: '46%',
    left: 0,
    opacity: 0.5,
    position: 'absolute',
    right: 0,
    // Softens the lower sky/earth band without introducing a new dependency.
    backgroundColor: 'rgba(15, 43, 67, 0.42)',
  },
});
