/**
 * File: public-page-shell.tsx
 * Description: Provides the shared outer scroll container and width constraints for public-site content pages.
 */
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

type PublicPageShellProps = {
  children: ReactNode;
};

/**
 * Inputs: child page sections.
 * Output: a consistent scrollable shell for public-site destination pages.
 */
export default function PublicPageShell({ children }: PublicPageShellProps) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-16">
      <View className="mx-auto w-full max-w-6xl px-5 py-8">{children}</View>
    </ScrollView>
  );
}
