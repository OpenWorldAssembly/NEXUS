/**
 * File: footer.tsx
 * Description: Renders the public-site footer as a compact navigation strip.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { PUBLIC_FOOTER_NAV, PUBLIC_PRIMARY_NAV, getPublicNavHref } from '@/data/public/navigation';

const nexusLink = PUBLIC_PRIMARY_NAV.find((item) => item.href === '/nexus/dashboard');

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
            {PUBLIC_FOOTER_NAV.map((item) => (
              <Link key={item.href} href={getPublicNavHref(item)} asChild>
                <Pressable>
                  <Text className="text-sm font-semibold text-public-text">{item.label}</Text>
                </Pressable>
              </Link>
            ))}

            {nexusLink ? (
              <Link href={getPublicNavHref(nexusLink)} asChild>
                <Pressable className="rounded-full border border-public-line bg-public-panel/65 px-4 py-2">
                  <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                    {nexusLink.label}
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
