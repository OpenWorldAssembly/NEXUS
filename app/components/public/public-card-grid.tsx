/**
 * File: public-card-grid.tsx
 * Description: Provides the shared wrapping grid layout for public informational cards.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';

import {
  PublicLayoutOffsetProvider,
  usePublicLayoutOffset,
} from '@app/components/public/animation/public-scroll-context';

type PublicCardGridProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Inputs: card children and an optional outer spacing class.
 * Output: a flexible wrapping grid used by public docs/support pages.
 */
export default function PublicCardGrid({ children, className = 'mt-8' }: PublicCardGridProps) {
  const parentOffsetY = usePublicLayoutOffset();
  const [layoutOffsetY, setLayoutOffsetY] = useState(parentOffsetY);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setLayoutOffsetY(parentOffsetY + event.nativeEvent.layout.y);
    },
    [parentOffsetY],
  );

  return (
    <PublicLayoutOffsetProvider offsetY={layoutOffsetY}>
      <View className={`${className} flex-row flex-wrap gap-4`} onLayout={handleLayout}>
        {children}
      </View>
    </PublicLayoutOffsetProvider>
  );
}
