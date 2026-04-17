/**
 * File: public-card-grid.tsx
 * Description: Provides the shared wrapping grid layout for public informational cards.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

type PublicCardGridProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Inputs: card children and an optional outer spacing class.
 * Output: a flexible wrapping grid used by public docs/support pages.
 */
export default function PublicCardGrid({ children, className = 'mt-8' }: PublicCardGridProps) {
  return <View className={`${className} flex-row flex-wrap gap-4`}>{children}</View>;
}
