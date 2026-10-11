export const navigationGroups = [
  {
    label: "Research",
    links: [
      {
        to: "/ingest",
        label: "Ingest",
        description: "Bring in source material",
      },
      {
        to: "/display",
        label: "Display",
        description: "Review sources and extractions",
      },
      {
        to: "/hypotheses",
        label: "Hypotheses",
        description: "Explore testable musical ideas",
      },
      {
        to: "/theses",
        label: "Theses",
        description: "Follow research questions",
      },
      {
        to: "/correspondences",
        label: "Correspondences",
        description: "Connect concepts across domains",
      },
      {
        to: "/vocabulary-triage",
        label: "Triage",
        description: "Review the concept vocabulary",
      },
    ],
  },
  {
    label: "Compose",
    links: [
      {
        to: "/recipes",
        label: "Recipes",
        description: "Turn hypotheses into studies",
      },
      {
        to: "/compositions",
        label: "Compositions",
        description: "Develop musical work",
      },
      {
        to: "/feedback",
        label: "Feedback",
        description: "Record listening observations",
      },
      { to: "/listen", label: "Listen", description: "Listen and compare" },
    ],
  },
  {
    label: "Library",
    links: [
      {
        to: "/essays",
        label: "Essays",
        description: "Read the essay collection",
      },
      {
        to: "/weekly-turns",
        label: "Weekly Turns",
        description: "Follow the weekly synthesis",
      },
      {
        to: "/editorial",
        label: "Editorial",
        description: "Review and publish writing",
      },
      {
        to: "/failures",
        label: "Failures",
        description: "Learn from negative results",
      },
    ],
  },
  {
    label: "Operations",
    links: [
      {
        to: "/agent-runs",
        label: "Agent Runs",
        description: "Inspect research runs",
      },
      {
        to: "/agent-drafts",
        label: "Review Queue",
        description: "Review agent proposals",
      },
      {
        to: "/admin",
        label: "Admin",
        description: "Manage feeds and settings",
      },
    ],
  },
] as const;
export const appLinks = [
  { to: "/", label: "Home" },
  ...navigationGroups.flatMap<{
    to: string;
    label: string;
    description?: string;
  }>((group) => group.links),
];
