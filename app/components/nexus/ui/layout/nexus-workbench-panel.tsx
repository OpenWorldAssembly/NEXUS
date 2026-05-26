/**
 * File: nexus-workbench-panel.tsx
 * Description: Shared Nexus panel for Explorer-style workbench surfaces.
 */
import type { ComponentProps } from 'react';

import { NexusPanel } from './nexus-panel';

export type NexusWorkbenchPanelProps = ComponentProps<typeof NexusPanel>;

export function NexusWorkbenchPanel(props: NexusWorkbenchPanelProps) {
  return <NexusPanel {...props} />;
}
