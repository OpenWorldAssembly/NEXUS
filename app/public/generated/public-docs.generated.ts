/**
 * File: public-docs.generated.ts
 * Description: Generated-style readable public documents for the docs route.
 *
 * This file is currently maintained by hand, but its shape is intended to be
 * overwritten later by the public docs build pipeline.
 */
import type { PublicReadableDocument } from '@app/public/content-types';

export const PUBLIC_READABLE_DOCUMENTS: Record<string, PublicReadableDocument> = {
  charter: {
    slug: 'charter',
    title: 'The Charter of the Open World Assembly',
    subtitle: 'Founding principles for peaceful decentralized coordination.',
    version: 'Public draft',
    updatedLabel: 'Current working version',
    intro: [
      'Humanity now possesses the means to communicate, coordinate, and act together across the planet.',
      'We need not wait for kings, parties, corporations, or catastrophes to decide our future. We declare the following principles:',
    ],
    sections: [
      {
        id: 'people-source',
        eyebrow: 'I',
        title: 'The People Are the Source',
        body: ['All legitimate power rises from the people and remains answerable to them.'],
      },
      {
        id: 'consent-above-control',
        eyebrow: 'II',
        title: 'Consent Above Control',
        body: ['No authority is just without consent. No consent is real without the freedom to refuse.'],
      },
      {
        id: 'limited-power',
        eyebrow: 'III',
        title: 'Power Must Be Limited',
        body: ['Any power not checked will drift toward abuse.'],
      },
      {
        id: 'participation',
        eyebrow: 'IV',
        title: 'Participation Over Passivity',
        body: ['Those affected by decisions should have a voice in them.'],
      },
      {
        id: 'local-first',
        eyebrow: 'V',
        title: 'Decentralize What Can Be Local',
        body: ['What can be decided locally should never be captured from afar.'],
      },
      {
        id: 'shared-coordination',
        eyebrow: 'VI',
        title: 'Coordinate What Must Be Shared',
        body: ['What concerns many may be aligned by many through open cooperation.'],
      },
      {
        id: 'unity-without-uniformity',
        eyebrow: 'VII',
        title: 'Unity Without Uniformity',
        body: ['People may differ in culture, belief, and way of life while building peace together.'],
      },
      {
        id: 'nonviolence',
        eyebrow: 'VIII',
        title: 'Nonviolence Is Strength',
        body: ['Violence breeds the systems it claims to defeat. Disciplined peace outlasts fear.'],
      },
      {
        id: 'visible-truth',
        eyebrow: 'IX',
        title: 'Truth Must Be Visible',
        body: ['Transparency builds trust. Hidden power corrodes it.'],
      },
      {
        id: 'fatalism',
        eyebrow: 'X',
        title: 'Fatalism Is Folly',
        body: ['We need not wait for war, collapse, or nuclear fire to become wise.'],
      },
    ],
    closing: {
      title: 'Closing',
      body: [
        'The future is not owned by tyrants, algorithms, or inherited power.',
        'The future belongs to free peoples who choose to build it together.',
        'Let assemblies rise wherever people are. Let consent become visible. Let cooperation outrun coercion. Let the age of participation begin.',
      ],
    },
  },
};
