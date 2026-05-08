/**
 * File: public-docs-resource-grid.tsx
 * Description: Renders compact public document resource actions.
 */
import { Text, View } from 'react-native';

import { PublicPageActions } from '@app/components/public/public-page-actions';
import { PublicPanelShell } from '@app/components/public/public-panel-shell';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
import type { PublicDocumentResource } from '@app/public/content-types';

type PublicDocsResourceGridProps = {
  resources?: PublicDocumentResource[];
};

export function PublicDocsResourceGrid({ resources }: PublicDocsResourceGridProps) {
  if (!resources?.length) {
    return null;
  }

  return (
    <PublicPanelShell className="px-6 py-7 sm:px-7 sm:py-8">
      <View className="gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Text
          className={[
            'font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]',
            PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
          ].join(' ')}
        >
          Downloads
        </Text>
        <PublicPageActions
          actions={resources.map((resource) => ({
            label: resource.title,
            target: resource.target,
            href: resource.href,
            variant: 'outline',
            disabled: resource.disabled,
          }))}
          className="mt-0 lg:justify-end"
        />
      </View>
    </PublicPanelShell>
  );
}

export default PublicDocsResourceGrid;
