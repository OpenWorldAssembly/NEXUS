import type {
  CharterPrincipleCard,
  PublicDocumentEntry,
  PublicDocumentResource,
} from "@/app/public/content-types";

const CHARTER_PAIRS: Array<[string, string]> = [
  ["I", "The People Are the Source"],
  ["II", "Consent Above Control"],
  ["III", "Power Must Be Limited"],
  ["IV", "Participation Over Passivity"],
  ["V", "Decentralize What Can Be Local"],
  ["VI", "Coordinate What Must Be Shared"],
  ["VII", "Unity Without Uniformity"],
  ["VIII", "Nonviolence Is Strength"],
  ["IX", "Truth Must Be Visible"],
  ["X", "Fatalism Is Folly"],
];

const CHARTER_BODIES = [
  "All legitimate power rises from the people and remains answerable to them.",
  "No authority is just without consent. No consent is real without the freedom to refuse.",
  "Any power not checked will drift toward abuse.",
  "Those affected by decisions should have a voice in them.",
  "What can be decided locally should never be captured from afar.",
  "What concerns many may be aligned by many through open cooperation.",
  "People may differ in culture, belief, and way of life while building peace together.",
  "Violence breeds the systems it claims to defeat. Disciplined peace outlasts fear.",
  "Transparency builds trust. Hidden power corrodes it.",
  "We need not wait for war, collapse, or nuclear fire to become wise.",
];

const CHARTER_RESOURCES: PublicDocumentResource[] = [
  {
    slug: "charter-pdf",
    title: "Download PDF",
    summary: "Printable public release placeholder for the charter.",
    disabled: true,
  },
];

export const CHARTER_PRINCIPLE_CARDS: CharterPrincipleCard[] = CHARTER_PAIRS.map(
  ([principle, title], index) => ({
    principle,
    title,
    body: CHARTER_BODIES[index] ?? "",
    anchor: index % 2 === 0 ? "left" : "right",
  }),
);

export const PUBLIC_DOCUMENTS: PublicDocumentEntry[] = [
  {
    slug: "charter",
    title: "The Charter of the Open World Assembly",
    description: "Founding document for the public site.",
    hero: {
      eyebrow: "Founding Documents",
      title: "The Charter of the Open World Assembly",
      summary: [
        "Humanity now possesses the means to communicate, coordinate, and act together across the planet.",
        "We need not wait for kings, parties, corporations, or catastrophes to decide our future. We declare these principles.",
      ],
      noteTitle: "Structured as a readable, reusable set of principles for every scope.",
      noteBody:
        "The page now reads as an adaptive field of panels that can grow as the document library expands.",
      actions: [
        { label: "About OWA", href: "/about", variant: "outline" },
        { label: "Support OWA", href: "/support", variant: "outline" },
        { label: "Enter Nexus", href: "/nexus/dashboard", variant: "outline" },
        { label: "Download PDF", variant: "outline", disabled: true },
      ],
    },
    sections: CHARTER_PRINCIPLE_CARDS,
    closing: {
      title: "Closing",
      body: [
        "The future is not owned by tyrants, algorithms, or inherited power.",
        "The future belongs to free peoples who choose to build it together.",
        "Let assemblies rise wherever people are. Let consent become visible. Let cooperation outrun coercion. Let the age of participation begin.",
      ],
    },
    resources: CHARTER_RESOURCES,
  },
];

export const DEFAULT_PUBLIC_DOCUMENT = PUBLIC_DOCUMENTS[0];
