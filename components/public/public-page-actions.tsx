/**
 * File: public-page-actions.tsx
 * Description: Renders a reusable action row for public-site content pages.
 */
import type { Href } from 'expo-router';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

export type PublicPageAction = {
  href: Href;
  label: string;
  variant: 'primary' | 'secondary';
};

type PublicPageActionsProps = {
  actions: PublicPageAction[];
};

/**
 * Inputs: a list of CTA actions with hrefs, labels, and visual variants.
 * Output: a shared CTA row for public informational pages.
 */
export default function PublicPageActions({ actions }: PublicPageActionsProps) {
  return (
    <View className="mt-10 flex-row flex-wrap gap-3">
      {actions.map((action) => {
        const wrapperClassName =
          action.variant === 'primary'
            ? 'rounded-full bg-public-accent px-6 py-3'
            : 'rounded-full border border-public-line bg-public-panel/70 px-6 py-3';

        const textClassName =
          action.variant === 'primary'
            ? 'text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas'
            : 'text-sm font-bold uppercase tracking-[0.18em] text-public-text';

        return (
          <Link key={`${action.href}:${action.label}`} href={action.href} asChild>
            <Pressable className={wrapperClassName}>
              <Text className={textClassName}>{action.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
