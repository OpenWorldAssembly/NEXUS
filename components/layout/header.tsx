/**
 * File: header.tsx
 * Description: Renders the public-site header and top-level navigation links.
 */
import { Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type PublicHref = '/' | '/about' | '/docs' | '/portal';

const navItems: { href: PublicHref; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/docs', label: 'Charter' },
  { href: '/portal', label: 'Nexus' },
];

/**
 * Inputs: none.
 * Output: the public-site header with route-aware active navigation styling.
 */
export default function Header() {
  const pathname = usePathname();

  return (
    <View className="w-full border-b border-public-line/70 bg-public-shell/80">
      <View className="mx-auto flex w-full max-w-6xl flex-row items-center justify-between px-5 py-4">
        <Link href="/" asChild>
          <Pressable className="rounded-full border border-public-line/70 bg-public-panel/50 px-4 py-2">
            <Text className="text-base font-extrabold uppercase tracking-[0.35em] text-public-accentSoft">
              OWA
            </Text>
          </Pressable>
        </Link>

        <View className="flex-row flex-wrap items-center gap-2">
          {navItems.map((item) => {
            const isActive =
              item.href === '/portal'
                ? pathname?.startsWith('/portal') ?? false
                : pathname === item.href;

            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable className="rounded-full px-4 py-2">
                  <Text
                    className={[
                      'text-sm font-semibold tracking-[0.12em] text-public-muted',
                      isActive ? 'text-public-text' : '',
                    ].join(' ')}
                  >
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
