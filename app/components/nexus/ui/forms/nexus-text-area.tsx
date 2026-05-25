/**
 * File: nexus-text-area.tsx
 * Description: Shared Nexus themed multiline text input.
 */
import { forwardRef, type ComponentProps } from 'react';
import { TextInput } from 'react-native';

import { NexusTextInput } from './nexus-text-input';

export type NexusTextAreaProps = ComponentProps<typeof NexusTextInput>;

export const NexusTextArea = forwardRef<TextInput, NexusTextAreaProps>(
  function NexusTextArea({ style, ...textInputProps }, ref) {
    return (
      <NexusTextInput
        ref={ref}
        multiline
        textAlignVertical="top"
        {...textInputProps}
        style={[{ textAlignVertical: 'top' }, style]}
      />
    );
  }
);
