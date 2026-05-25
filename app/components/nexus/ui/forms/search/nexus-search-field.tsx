/**
 * File: nexus-search-field.tsx
 * Description: Shared Nexus search input chrome.
 */
import { forwardRef, type ComponentProps } from 'react';
import { TextInput } from 'react-native';

import { useNexusAppearance } from '../../layout';

export type NexusSearchFieldProps = Omit<
  ComponentProps<typeof TextInput>,
  'className' | 'placeholderTextColor'
> & {
  hasAttachedResults?: boolean;
  inputClassName?: string;
  isInset?: boolean;
};

function joinClasses(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const NexusSearchField = forwardRef<TextInput, NexusSearchFieldProps>(
  function NexusSearchField(
    {
      hasAttachedResults = false,
      inputClassName,
      isInset = false,
      returnKeyType = 'search',
      ...textInputProps
    },
    ref
  ) {
    const appearance = useNexusAppearance();

    return (
      <TextInput
        ref={ref}
        placeholderTextColor={appearance.textInputPlaceholderColor}
        returnKeyType={returnKeyType}
        {...textInputProps}
        className={joinClasses(
          hasAttachedResults
            ? 'rounded-t-[18px] rounded-b-none border px-4 py-3'
            : 'rounded-[18px] border px-4 py-3',
          isInset ? appearance.cardInsetClass : appearance.textInputClass,
          inputClassName
        )}
      />
    );
  }
);
