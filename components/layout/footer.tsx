/**
 * File: footer.tsx
 * Description: Renders the public-site footer with a multi-column public-site summary.
 */
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

const footerLinkGroups = [
  {
    title: 'Explore',
    links: [
      { href: '/about' as const, label: 'About OWA' },
      { href: '/docs' as const, label: 'Charter' },
      { href: '/portal' as const, label: 'Nexus' },
    ],
  },
  {
    title: 'Themes',
    items: ['Decentralized by design', 'Aligned through consent', 'Synchronized at scale'],
  },
  {
    title: 'Status',
    items: [
      'Public explanation surface is live.',
      'Charter route is reserved and ready for drafting.',
      'Portal access lives inside the Nexus.',
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
      <View className="mx-auto flex w-full max-w-6xl gap-8 px-5 py-10">
        <View className="flex-row flex-wrap gap-6">
          <View className="min-w-[280px] flex-[1.2] gap-4 rounded-[1.75rem] border border-public-line/70 bg-public-panel/50 p-6">
            <Text className="text-sm font-bold uppercase tracking-[0.3em] text-public-accentSoft">
              Open World Assembly
            </Text>
            <Text className="max-w-xl text-2xl font-bold leading-tight text-public-text">
              A decentralized system for shared decision-making, coordination, and alignment.
            </Text>
            <Text className="max-w-xl text-base leading-7 text-public-muted">
              The public site introduces the civic model. The Nexus is where the portal experience begins.
            </Text>

            <Link href="/portal" asChild>
              <Pressable className="w-fit rounded-full bg-public-accent px-5 py-3">
                <Text className="text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas">
                  Enter the Nexus
                </Text>
              </Pressable>
            </Link>
          </View>

          <View className="min-w-[280px] flex-[1.6] flex-row flex-wrap gap-4">
            {footerLinkGroups.map((group) => (
              <View
                key={group.title}
                className="min-w-[180px] flex-1 rounded-[1.5rem] border border-public-line/70 bg-public-panel/35 p-5"
              >
                <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
                  {group.title}
                </Text>

                {'links' in group ? (
                  <View className="mt-4 gap-3">
                    {group.links.map((link) => (
                      <Link key={link.href} href={link.href} asChild>
                        <Pressable>
                          <Text className="text-base font-semibold text-public-text">
                            {link.label}
                          </Text>
                        </Pressable>
                      </Link>
                    ))}
                  </View>
                ) : (
                  <View className="mt-4 gap-3">
                    {group.items.map((item) => (
                      <Text key={item} className="text-sm leading-6 text-public-muted">
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
