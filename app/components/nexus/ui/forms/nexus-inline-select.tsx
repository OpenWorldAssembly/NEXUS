/**
 * File: nexus-inline-select.tsx
 * Description: Shared Nexus inline select primitive.
 */
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import {
  NexusThemedBevelEdges,
  getNexusChromeClasses,
  joinClasses,
} from '../layout/nexus-chrome';

export type NexusInlineSelectProps = {
  label?: string;
  valueLabel: string;
  options: {
    id: string;
    label: string;
  }[];
  onSelect: (optionId: string) => void;
  disabled?: boolean;
  menuLayerClassName?: string;
};

export function NexusInlineSelect({
  label,
  valueLabel,
  options,
  onSelect,
  disabled = false,
  menuLayerClassName,
}: NexusInlineSelectProps) {
  const { themeMode, uiDensity } = useNexusShell();
  const chrome = getNexusChromeClasses(themeMode, uiDensity);
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const triggerRef = useRef<View | null>(null);
  const triggerClass = chrome.inlineSelectTriggerClass;
  const menuClass = chrome.inlineSelectMenuClass;
  const textClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const metaClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const menuWidth = Math.min(260, Math.max(220, viewportWidth - 32));
  const horizontalPadding = 16;
  const verticalPadding = 16;
  const overlayLeft = anchorRect
    ? Math.min(
        Math.max(anchorRect.x, horizontalPadding),
        viewportWidth - menuWidth - horizontalPadding
      )
    : horizontalPadding;
  const overlayTop = anchorRect
    ? Math.max(
        verticalPadding,
        Math.min(
          Math.max(anchorRect.y + anchorRect.height + 8, verticalPadding),
          viewportHeight - 240
        )
      )
    : verticalPadding;

  const handleToggleMenu = () => {
    if (disabled) {
      return;
    }

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (!triggerRef.current?.measureInWindow) {
      setIsOpen(true);
      return;
    }

    triggerRef.current.measureInWindow((x, y, width, height) => {
      setAnchorRect({ x, y, width, height });
      setIsOpen(true);
    });
  };

  return (
    <View className="gap-2">
      {label ? <Text className={`text-xs uppercase tracking-[3px] ${metaClass}`}>{label}</Text> : null}
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          className={joinClasses(
            triggerClass,
            disabled ? 'opacity-45' : ''
          )}
          disabled={disabled}
          onPress={handleToggleMenu}
        >
          <Text
            className={joinClasses(
              uiDensity === 'large' ? 'text-base' : 'text-sm',
              'font-semibold',
              textClass
            )}
          >
            {valueLabel}
          </Text>
          <NexusThemedBevelEdges themeMode={themeMode} subtle />
        </Pressable>
      </View>
      <Modal
        animationType="none"
        onRequestClose={() => setIsOpen(false)}
        transparent
        visible={isOpen && !disabled}
      >
        <View className="flex-1">
          <Pressable
            accessibilityRole="button"
            className="absolute inset-0"
            onPress={() => setIsOpen(false)}
          />
          <View
            className={joinClasses(
              'absolute overflow-hidden rounded-nexus border p-2 definition-none',
              menuClass,
              menuLayerClassName
            )}
            style={{
              left: overlayLeft,
              top: overlayTop,
              width: menuWidth,
            }}
          >
            {options.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                className={chrome.inlineSelectOptionClass}
                onPress={() => {
                  setIsOpen(false);
                  onSelect(option.id);
                }}
              >
                <Text className={joinClasses('text-sm font-semibold', textClass)}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
            <NexusThemedBevelEdges themeMode={themeMode} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
