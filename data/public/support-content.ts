/**
 * File: support-content.ts
 * Description: Stores the public support page copy and structured content blocks.
 */
import type { Href } from 'expo-router';
import type { PublicPageAction } from '@/components/public/public-page-actions';

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
  { href: '/about' as Href, label: 'Learn More', variant: 'primary' },
  { href: '/docs' as Href, label: 'Read the Charter', variant: 'secondary' },
  { href: '/nexus/dashboard' as Href, label: 'Browse the Nexus', variant: 'secondary' },
];

export const supportPageContent: SupportPageContent = {
  eyebrow: 'Support',
  title: 'Help accelerate the buildout.',
  body:
    'Open World Assembly is still in its build phase. Support at this stage helps turn the current public site, Nexus shell, and core architecture into a cleaner, stronger, more usable system.',
  calloutEyebrow: 'Current posture',
  calloutBody:
    'This page is the support destination for the public site. Specific contribution channels, supporter options, and updates can be layered in here as the support model solidifies.',
  priorities: [
    {
      title: 'Infrastructure',
      body:
        'Support helps cover the practical foundation: hosting, testing, deployment, and the baseline tooling required to keep the public site and Nexus moving toward a stable open beta.',
    },
    {
      title: 'Development',
      body:
        'It also buys time and momentum for design, implementation, bug fixing, content architecture, and the slow unglamorous work of turning a large idea into a durable system.',
    },
    {
      title: 'Distribution',
      body:
        'As the project matures, support can expand the public-facing surface through clearer writing, visual polish, onboarding materials, and launch preparation for wider adoption.',
    },
  ],
  waysToHelp: [
    {
      title: 'Financial support',
      body:
        'Direct support is meant to accelerate development without turning the project into a product treadmill. This route is the public placeholder for those options as they are finalized.',
    },
    {
      title: 'Signal boosting',
      body:
        'Sharing the project, discussing the idea seriously, and helping the right people find it can matter almost as much as money at this stage.',
    },
    {
      title: 'Feedback and testing',
      body:
        'Clear feedback on messaging, structure, usability, and public trust signals helps sharpen both the site and the system behind it before the beta opens wider.',
    },
  ],
  actions: supportActions,
};
