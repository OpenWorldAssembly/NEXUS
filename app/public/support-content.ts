/**
 * File: support-content.ts
 * Description: Stores the public support page copy and structured content blocks.
 */
import type { PublicPageAction } from '@app/public/content-types';

export type SupportCard = {
  title: string;
  body: string;
};

export type SupportPageContent = {
  eyebrow: string;
  title: string;
  body: string;
  calloutEyebrow: string;
  calloutBody: string;
  priorities: SupportCard[];
  waysToHelp: SupportCard[];
  actions: PublicPageAction[];
};

const supportActions: PublicPageAction[] = [
  { href: '/about', label: 'Learn More', variant: 'primary' },
  { href: '/docs', label: 'Read the Charter', variant: 'secondary' },
  { href: '/nexus/dashboard', label: 'Browse the Nexus', variant: 'secondary' },
];

export const supportPageContent: SupportPageContent = {
  eyebrow: 'Support',
  title: 'Help build the future together.',
  body:
    'Open World Assembly is in early development. Support helps move the project toward a stable open beta: clearer tools, stronger infrastructure, better writing, and wider testing.',
  calloutEyebrow: 'Current need',
  calloutBody:
    'The project currently needs practical and/or financial support for: server hosting, code development, systems testing, and feedback integration',
  priorities: [
    {
      title: 'Infrastructure',
      body:
        'Keep the foundation stable and decentralized: hosting, deployment, testing, monitoring, and the baseline systems needed for a public coordination tool people can trust.',
    },
    {
      title: 'Development',
      body:
        'Participate in the open-source work that makes the idea real: implementation, bug fixing, interface polish, content architecture, and the core logic behind OWA Nexus.',
    },
    {
      title: 'Distribution',
      body:
        'Help the project become legible to diverse populations through localization of core literature, onboarding materials, demos, launch preparations, and accessibility options.',
    },
  ],
  waysToHelp: [
    {
      title: 'Financial support',
      body:
        'Monetary support helps with all facets of project development, especially allowing for the aquisition of technological infrastructure and professional services.',
    },
    {
      title: 'Signal boosting',
      body:
        'Share the project with anyone who might care about civic technology, decentralization, peace on Earth, regaining public trust, building open systems, or large-scale human coordination.',
    },
    {
      title: 'Feedback and testing',
      body:
        'Test the site, challenge the language, report bugs and areas of friction, and help sharpen the project to ensure it becomes a tool truly of, by and for the people it serves.',
    },
  ],
  actions: supportActions,
};
