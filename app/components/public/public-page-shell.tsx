/**
 * File: public-page-shell.tsx
 * Description: Provides the shared outer scroll container and width constraints for public-site content pages.
 */
import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';

type PublicPageShellProps = {
  children: ReactNode;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  constrainWidth?: boolean;
  innerClassName?: string;
};

/**
 * Inputs: child page sections plus optional scroll and width-constraint settings.
 * Output: a consistent scrollable shell for public-site destination pages.
 */
export default function PublicPageShell({
  children,
  contentContainerClassName = 'pb-16',
  contentContainerStyle,
  showsVerticalScrollIndicator,
  constrainWidth = true,
  innerClassName = 'mx-auto w-full max-w-6xl px-5 py-8',
}: PublicPageShellProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName={contentContainerClassName}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {constrainWidth ? <View className={innerClassName}>{children}</View> : children}
    </ScrollView>
  );
}
