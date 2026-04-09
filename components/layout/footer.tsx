/**
 * File: footer.tsx
 * Description: Renders the public-site footer as a compact navigation strip.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

const footerLinks = [
  { href: '/' as const, label: 'Home' },
  { href: '/about' as const, label: 'About' },
  { href: '/docs' as const, label: 'Charter' },
];

/**
 * Inputs: none.
 * Output: the compact public-site footer with minimal brand copy, lightweight links, and a single Nexus action.
 */
export default function Footer() {
  return (
    <View className="w-full border-t border-public-line/70 bg-public-shell/80">
      <View className="mx-auto w-full max-w-6xl px-5 py-5">
        <View className="flex-row flex-wrap items-center justify-between gap-4">
          <View className="max-w-xl gap-1">
            <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-accentSoft">
              Open World Assembly
            </Text>
            <Text className="text-sm text-public-muted">
              Democratic coordination without centralized control.
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-4">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} asChild>
                <Pressable>
                  <Text className="text-sm font-semibold text-public-text">
                    {link.label}
                  </Text>
                </Pressable>
              </Link>
            ))}

            <Link href="/nexus/dashboard" asChild>
              <Pressable className="rounded-full border border-public-line bg-public-panel/65 px-4 py-2">
                <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                  Nexus
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </View>
  );
}
