/**
 * File: docs.tsx
 * Description: Renders the public charter destination page and related source-document context.
 */
import PublicCardGrid from '@/components/public/public-card-grid';
import PublicFeatureCard from '@/components/public/public-feature-card';
import PublicPageActions from '@/components/public/public-page-actions';
import PublicPageHero from '@/components/public/public-page-hero';
import PublicPageShell from '@/components/public/public-page-shell';
import { docsPageContent } from '@/data/public/docs-content';

/**
 * Inputs: none.
 * Output: the public charter destination page with current drafting status and supporting references.
 */
export default function DocsPage() {
  return (
    <PublicPageShell>
      <PublicPageHero
        eyebrow={docsPageContent.eyebrow}
        title={docsPageContent.title}
        body={docsPageContent.body}
        calloutEyebrow={docsPageContent.calloutEyebrow}
        calloutBody={docsPageContent.calloutBody}
        eyebrowClassName="text-public-sand"
        calloutEyebrowClassName="text-public-cyan"
        glowPrimaryClassName="bg-public-sand/10"
        glowSecondaryClassName="bg-public-cyan/15"
      />

      <PublicCardGrid>
        {docsPageContent.resources.map((resource) => (
          <PublicFeatureCard
            key={resource.title}
            eyebrow={resource.status}
            title={resource.title}
            body={resource.body}
            eyebrowClassName="text-public-cyan"
          />
        ))}
      </PublicCardGrid>

      <PublicPageActions actions={docsPageContent.actions} />
    </PublicPageShell>
  );
}
