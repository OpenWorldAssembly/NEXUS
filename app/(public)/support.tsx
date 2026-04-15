/**
 * File: support.tsx
 * Description: Renders the public support page with current needs, contribution paths, and non-financial ways to help OWA grow.
 */
import PublicCardGrid from '@/components/public/public-card-grid';
import PublicFeatureCard from '@/components/public/public-feature-card';
import PublicPageActions from '@/components/public/public-page-actions';
import PublicPageHero from '@/components/public/public-page-hero';
import PublicPageShell from '@/components/public/public-page-shell';
import { supportPageContent } from '@/data/public/support-content';

/**
 * Inputs: none.
 * Output: the public support destination for OWA with current framing and next-step routes.
 */
export default function SupportPage() {
  return (
    <PublicPageShell>
      <PublicPageHero
        eyebrow={supportPageContent.eyebrow}
        title={supportPageContent.title}
        body={supportPageContent.body}
        calloutEyebrow={supportPageContent.calloutEyebrow}
        calloutBody={supportPageContent.calloutBody}
        eyebrowClassName="text-public-accentSoft"
        calloutEyebrowClassName="text-public-sand"
        glowPrimaryClassName="bg-public-accent/10"
        glowSecondaryClassName="bg-public-cyan/15"
      />

      <PublicCardGrid>
        {supportPageContent.priorities.map((priority) => (
          <PublicFeatureCard
            key={priority.title}
            eyebrow="Priority"
            title={priority.title}
            body={priority.body}
            eyebrowClassName="text-public-cyan"
          />
        ))}
      </PublicCardGrid>

      <PublicCardGrid>
        {supportPageContent.waysToHelp.map((path) => (
          <PublicFeatureCard
            key={path.title}
            eyebrow="Ways to help"
            title={path.title}
            body={path.body}
            eyebrowClassName="text-public-sand"
          />
        ))}
      </PublicCardGrid>

      <PublicPageActions actions={supportPageContent.actions} />
    </PublicPageShell>
  );
}
