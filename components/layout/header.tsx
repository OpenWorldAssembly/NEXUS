/**
 * File: header.tsx
 * Description: Renders the public-site header and top-level navigation links.
 */
import { Link, usePathname } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

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
  const { width } = useWindowDimensions();

  const isCompactHeader = width < 940;
  const isStackedHeader = width < 680;
  const headerShellClassName = isStackedHeader
    ? 'mx-auto flex w-full max-w-6xl flex-col items-center gap-1 px-5 py-2'
    : 'mx-auto flex w-full max-w-6xl flex-row items-center justify-between gap-4 px-5 py-4';
  const brandClassName = isStackedHeader
    ? 'self-center rounded-full border border-public-line/0 bg-public-panel/50 px-4 py-1'
    : 'rounded-full border border-public-line/0 bg-public-panel/50 px-4 py-2';
  const brandTextClassName = isStackedHeader
    ? 'text-center text-sm font-extrabold uppercase tracking-[0.24em] text-public-accentSoft'
    : isCompactHeader
      ? 'text-sm font-extrabold uppercase tracking-[0.28em] text-public-accentSoft'
      : 'text-base font-extrabold uppercase tracking-[0.35em] text-public-accentSoft';
  const navClassName = isStackedHeader
    ? 'flex-row flex-wrap items-center justify-center gap-x-0.5 gap-y-0'
    : 'flex-row flex-wrap items-center justify-end gap-2';
  const linkPressableClassName = isStackedHeader
    ? 'rounded-full px-3 py-1'
    : isCompactHeader
      ? 'rounded-full px-3 py-2'
      : 'rounded-full px-4 py-2';
  const linkTextBaseClassName = isStackedHeader
    ? 'text-xs font-semibold tracking-[0.11em] text-public-muted'
    : 'text-sm font-semibold tracking-[0.12em] text-public-muted';

  return (
    <View className="w-full border-b border-public-line/70 bg-public-shell/80">
      <View className={headerShellClassName}>
        <Link href={getPublicNavHref(homeLink)} asChild>
          <Pressable className={brandClassName}>
            <Text className={brandTextClassName}>Open World Assembly</Text>
          </Pressable>
        </Link>

        <View className={navClassName}>
          {PUBLIC_PRIMARY_NAV.map((item) => {
            const isActive = isPublicNavItemActive(pathname, item);

            return (
              <Link key={item.href} href={getPublicNavHref(item)} asChild>
                <Pressable className={linkPressableClassName}>
                  <Text
                    className={[
                      linkTextBaseClassName,
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
