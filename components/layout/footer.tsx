/**
 * File: footer.tsx
 * Description: Renders the public-site footer with a multi-column public-site summary.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

const footerLinkGroups = [
  {
    title: 'Sitemap',
    links: [
      { href: '/about' as const, label: 'About OWA' },
      { href: '/docs' as const, label: 'Charter' },
      { href: '/nexus/dashboard' as const, label: 'Nexus' },
    ],
  },
  {
    title: 'Principles',
    items: [
      'Decentralized by design',
      'Aligned through consent',
      'Local legitimacy, global coordination',
    ],
  },
  {
    title: 'Civic posture',
    items: [
      'Direct participation first',
      'Lawful and nonviolent by design',
      'Built to adapt through use',
    ],
  },
] as const;

/**
 * Inputs: none.
 * Output: the public-site footer with summary copy and public navigation links.
 */
export default function Footer() {
  return (
    <View className="w-full border-t border-public-line/70 bg-public-shell/80">
      <View className="mx-auto flex w-full max-w-6xl gap-6 px-5 py-8">
        <View className="flex-row flex-wrap gap-4">
          <View className="min-w-[240px] flex-1 rounded-[1.5rem] border border-public-line/70 bg-public-panel/45 p-5">
            <Text className="text-sm font-bold uppercase tracking-[0.3em] text-public-accentSoft">
              Open World Assembly
            </Text>
            <Text className="mt-3 max-w-lg text-xl font-bold leading-tight text-public-text">
              A decentralized system for shared decision-making, coordination, and alignment.
            </Text>

            <Link href="/nexus/dashboard" asChild>
              <Pressable className="mt-4 w-fit rounded-full bg-public-accent px-4 py-2.5">
                <Text className="text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas">
                  Enter the Nexus
                </Text>
              </Pressable>
            </Link>
          </View>

          <View className="min-w-[280px] flex-[1.4] flex-row flex-wrap gap-4">
            {footerLinkGroups.map((group) => (
              <View
                key={group.title}
                className="min-w-[160px] flex-1 rounded-[1.5rem] border border-public-line/70 bg-public-panel/35 p-4"
              >
                <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
                  {group.title}
                </Text>

                {'links' in group ? (
                  <View className="mt-3 gap-2.5">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href} asChild>
                        <Pressable>
                          <Text className="text-sm font-semibold text-public-text">
                            {link.label}
                          </Text>
                        </Pressable>
                      </Link>
                    ))}
                  </View>
                ) : (
                  <View className="mt-3 gap-2.5">
                    {group.items.map((item) => (
                      <Text key={item} className="text-xs leading-5 text-public-muted">
                        {item}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View className="flex-row flex-wrap items-center justify-between gap-3 border-t border-public-line/60 pt-4">
          <Text className="text-xs uppercase tracking-[0.26em] text-public-muted">
            Open World Assembly
          </Text>
          <Text className="text-sm text-public-muted">
            Democratic coordination without centralized control.
          </Text>
        </View>
      </View>
    </View>
  );
}
