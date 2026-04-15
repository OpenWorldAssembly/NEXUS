/**
 * File: header.tsx
 * Description: Renders the public-site header and top-level navigation links.
 */
import { Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import {
  PUBLIC_PRIMARY_NAV,
  getPublicNavHref,
  isPublicNavItemActive,
} from '@/data/public/navigation';

const homeLink = PUBLIC_PRIMARY_NAV.find((item) => item.href === '/') ?? PUBLIC_PRIMARY_NAV[0];

/**
 * Inputs: none.
 * Output: the public-site header with route-aware active navigation styling.
 */
export default function Header() {
  const pathname = usePathname();

  return (
    <View className="w-full border-b border-public-line/70 bg-public-shell/80">
      <View className="mx-auto flex w-full max-w-6xl flex-row items-center justify-between px-5 py-4">
        <Link href={getPublicNavHref(homeLink)} asChild>
          <Pressable className="rounded-full border border-public-line/0 bg-public-panel/50 px-4 py-2">
            <Text className="text-base font-extrabold uppercase tracking-[0.35em] text-public-accentSoft">
              Open World Assembly
            </Text>
          </Pressable>
        </Link>

        <View className="flex-row flex-wrap items-center gap-2">
          {PUBLIC_PRIMARY_NAV.map((item) => {
            const isActive = isPublicNavItemActive(pathname, item);

            return (
              <Link key={item.href} href={getPublicNavHref(item)} asChild>
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
