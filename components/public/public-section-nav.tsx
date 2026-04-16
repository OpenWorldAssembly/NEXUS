/**
 * File: public-section-nav.tsx
 * Description: Reusable public-site section navigation rail.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { PublicHref } from '@/data/public/public-routes';

export type PublicSectionNavItem = {
  id: string;
  label: string;
};

export type PublicSectionNavLink = {
  href: PublicHref;
  label: string;
};

type PublicSectionNavProps = {
  title: string;
  subtitle?: string;
  items: PublicSectionNavItem[];
  activeItemId: string;
  onItemPress: (itemId: string) => void;
  footerLinks?: PublicSectionNavLink[];
};

/**
 * Inputs: section navigation copy, active item state, and footer links.
 * Output: a reusable vertical navigation rail for public pages.
 */
export function PublicSectionNav({
  title,
  subtitle,
  items,
  activeItemId,
  onItemPress,
  footerLinks = [],
}: PublicSectionNavProps) {
  return (
    <View className="gap-8">
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-2xl font-black tracking-[0.22em] text-public-text">{title}</Text>
          {subtitle ? (
            <Text className="text-xs font-semibold uppercase tracking-[0.4em] text-public-accentSoft">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="h-px w-16 bg-public-line/80" />
      </View>

      <View className="gap-3">
        {items.map((item) => {
          const isActive = item.id === activeItemId;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              className={[
                'rounded-2xl border px-4 py-3 transition-colors',
                isActive
                  ? 'border-public-accent bg-public-accent/14'
                  : 'border-public-line bg-public-panel/55',
              ].join(' ')}
              onPress={() => onItemPress(item.id)}
            >
              <Text
                className={[
                  'text-sm font-semibold tracking-[0.08em]',
                  isActive ? 'text-public-text' : 'text-public-muted',
                ].join(' ')}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {footerLinks.length > 0 ? (
        <View className="gap-2 border-t border-public-line pt-6">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} asChild>
              <Pressable className="rounded-full px-2 py-1">
                <Text className="text-sm font-semibold tracking-[0.1em] text-public-muted">
                  {link.label}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}
    </View>
  );
}
