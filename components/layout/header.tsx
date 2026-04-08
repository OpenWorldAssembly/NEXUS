/**
 * File: header.tsx
 * Description: Renders the public-site header and top-level navigation links.
 */
import { Link, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type PublicHref = '/' | '/about' | '/docs' | '/login' | '/signup';

const navItems: { href: PublicHref; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Docs' },
  { href: '/login', label: 'Login' },
  { href: '/signup', label: 'Sign Up' },
];

/**
 * Inputs: none.
 * Output: the public-site header with route-aware active navigation styling.
 */
export default function Header() {
  const pathname = usePathname();

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <Link href="/" asChild>
          <Pressable style={styles.brand}>
            <Text style={styles.brandText}>OWA</Text>
          </Pressable>
        </Link>

        <View style={styles.nav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable style={styles.navItem}>
                  <Text style={[styles.navText, isActive && styles.navTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2a44',
    backgroundColor: '#11182b',
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    paddingVertical: 6,
  },
  brandText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  nav: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  navItem: {
    paddingVertical: 6,
  },
  navText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '500',
  },
  navTextActive: {
    color: '#ffffff',
  },
});
