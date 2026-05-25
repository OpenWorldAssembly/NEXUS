/**
 * File: nexus-text-input.tsx
 * Description: Shared Nexus themed single-line text input.
 */
import { forwardRef, type ComponentProps } from 'react';
import { TextInput } from 'react-native';

import { useNexusAppearance } from '../layout';

export type NexusTextInputProps = Omit<
  ComponentProps<typeof TextInput>,
  'className' | 'placeholderTextColor'
> & {
  inputClassName?: string;
  isInset?: boolean;
};

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const NexusTextInput = forwardRef<TextInput, NexusTextInputProps>(
  function NexusTextInput(
    { inputClassName, isInset = false, ...textInputProps },
    ref
  ) {
    const appearance = useNexusAppearance();

    return (
      <TextInput
        ref={ref}
        placeholderTextColor={appearance.textInputPlaceholderColor}
        {...textInputProps}
        className={joinClasses(
          'rounded-[18px] border px-4 py-3',
          isInset ? appearance.cardInsetClass : appearance.textInputClass,
          inputClassName
        )}
      />
    );
  }
);
