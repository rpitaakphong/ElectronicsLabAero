export type ToolKind = 'learn' | 'simulator';
export interface TopicDefinition {
  id: string;
  title: string;
  description: string;
  path: string;
  art: 'divider' | 'rc' | 'opamp';
  tools: readonly {
    id: ToolKind;
    label: string;
    title: string;
    path: string;
  }[];
  simulator: { url: string; download: string; description: string };
}

export const TOPICS = [
  {
    id: 'voltage-divider',
    title: 'Voltage Divider',
    path: '/voltage-divider',
    art: 'divider',
    description:
      'Discover how resistors share voltage—and what changes when you add a load, move a wiper, or connect a sensor.',
    tools: [
      {
        id: 'learn',
        label: 'Interactive Learning',
        title: 'Voltage Divider Interactive Learning',
        path: '/voltage-divider/learn',
      },
      {
        id: 'simulator',
        label: 'Simulator',
        title: 'Voltage Divider Lab Simulator',
        path: '/voltage-divider/simulator',
      },
    ],
    simulator: {
      url: '/simulators/voltage-divider/index.html',
      download:
        '/simulators/voltage-divider/voltage_divider_sim_single_file.html',
      description:
        'Build your circuit. Connect the supply. Measure and explore.',
    },
  },
  {
    id: 'rc-filter',
    title: 'RC Filter',
    path: '/rc-filter',
    art: 'rc',
    description:
      'Explore how resistors and capacitors shape signals: low-pass, high-pass, and band-pass filters in frequency and time.',
    tools: [
      {
        id: 'learn',
        label: 'Interactive Learning',
        title: 'RC Filter Interactive Learning',
        path: '/rc-filter/learn',
      },
      {
        id: 'simulator',
        label: 'Simulator',
        title: 'RC Filter Lab Simulator',
        path: '/rc-filter/simulator',
      },
    ],
    simulator: {
      url: '/simulators/rc-filter/index.html',
      download: '/simulators/rc-filter/rc_filter_sim_single_file.html',
      description:
        'Build a filter. Change the frequency. Measure the response.',
    },
  },
  {
    id: 'opamp',
    title: 'Operational Amplifier',
    path: '/operational-amplifier',
    art: 'opamp',
    description:
      'Explore op-amp gain, signals, and filtering with interactive lessons, then build and measure circuits in the breadboard simulator.',
    tools: [
      {
        id: 'learn',
        label: 'Interactive Learning',
        title: 'Op-Amp Interactive Learning',
        path: '/operational-amplifier/learn',
      },
      {
        id: 'simulator',
        label: 'Simulator',
        title: 'Op-Amp Lab Simulator',
        path: '/operational-amplifier/simulator',
      },
    ],
    simulator: {
      url: '/simulators/opamp/index.html',
      download: '/simulators/opamp/gds1202b_opamp_sim_single_file.html',
      description:
        'Build your circuit. Connect the instruments. Explore the signal.',
    },
  },
] as const satisfies readonly TopicDefinition[];

export type TopicId = (typeof TOPICS)[number]['id'];
export const getTopic = (id: TopicId) =>
  TOPICS.find((topic) => topic.id === id)!;
export const getTool = (id: TopicId, kind: ToolKind) =>
  getTopic(id).tools.find((tool) => tool.id === kind)!;

export const SITE_PAGES = {
  home: { path: '/', label: 'Home', title: 'Welcome' },
  topics: { path: '/topics', label: 'Topics', title: 'Learning Topics' },
  resources: { path: '/resources', label: 'Resources', title: 'Resources' },
} as const;

export interface Breadcrumb {
  label: string;
  path?: string;
}
export interface PageMetadata {
  path: string;
  title: string;
  section: keyof typeof SITE_PAGES;
  breadcrumbs: readonly Breadcrumb[];
}
const homeCrumb = { label: SITE_PAGES.home.label, path: SITE_PAGES.home.path };
const topicsCrumb = {
  label: SITE_PAGES.topics.label,
  path: SITE_PAGES.topics.path,
};
export const PAGE_METADATA: readonly PageMetadata[] = [
  ...Object.entries(SITE_PAGES).map(([section, page]) => ({
    path: page.path,
    title: page.title,
    section: section as keyof typeof SITE_PAGES,
    breadcrumbs: section === 'home' ? [] : [homeCrumb, { label: page.label }],
  })),
  ...TOPICS.flatMap((topic) => [
    {
      path: topic.path,
      title: topic.title,
      section: 'topics' as const,
      breadcrumbs: [homeCrumb, topicsCrumb, { label: topic.title }],
    },
    ...topic.tools.map((tool) => ({
      path: tool.path,
      title: tool.title,
      section: 'topics' as const,
      breadcrumbs: [
        homeCrumb,
        topicsCrumb,
        { label: topic.title, path: topic.path },
        { label: tool.label },
      ],
    })),
  ]),
];
export const pageMetadata = (pathname: string) =>
  PAGE_METADATA.find(
    (page) => page.path === (pathname.replace(/\/+$/, '') || '/'),
  );

export type ResourceDefinition = {
  id: string;
  title: string;
  description: string;
  href: string;
} & (
  | { kind: 'guide'; paragraphs: readonly string[] }
  | { kind: 'download'; topicId: TopicId }
);
export const RESOURCES: readonly ResourceDefinition[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    kind: 'guide',
    href: '/resources#getting-started',
    description:
      'A little theory. A circuit you build. A measurement you can explain.',
    paragraphs: [
      'Choose a topic and open Interactive Learning. Change one parameter at a time, predict the result, and compare the equations and measurements.',
      'Open the Simulator to build the circuit on a breadboard. Connect the supply and instruments, then measure what happens. Each simulator includes reference diagrams and connection guidance.',
      'Start with Voltage Divider if you are new to circuits. Continue with RC Filter to explore frequency and time response, then Operational Amplifier for gain and active circuits.',
    ],
  },
  {
    id: 'saving-your-work',
    title: 'Saving your work',
    kind: 'guide',
    href: '/resources#saving-your-work',
    description: 'Save deliberately before leaving a simulator.',
    paragraphs: [
      'Interactive Learning settings last while you stay in that tool. Leaving the learning page or refreshing restores its defaults.',
      'Simulators start with a blank board on every visit. Use Save lab to store your circuit and instrument settings, then Recall lab to restore them. There is no automatic save. Reset lab clears the current board without deleting your saved lab.',
      'Saves belong to this browser and website address. Each simulator saves independently. A different device, browser, website address, or offline file does not automatically share those saves.',
      'Opening the navigation menu keeps your work in place. Following a link away from the lab leaves the current tool, so save first when you want to return to your circuit.',
    ],
  },
  {
    id: 'model-limitations',
    title: 'Model limitations',
    kind: 'guide',
    href: '/resources#model-limitations',
    description: 'Use these models to build intuition and compare predictions.',
    paragraphs: [
      'The voltage-divider tools use ideal DC supplies and resistive components. In its simulator, voltage mode has infinite input resistance and current mode has zero resistance. Resistance mode requires the supply output to be off. Sensor resistance is adjusted directly.',
      'RC Filter Interactive Learning uses an ideal source and ideal passive components, including interstage and optional output loading. Its simulator uses the bench generator’s 50 Ω source resistance and common instrument grounds. Compare output with the measured filter input.',
      'Op-amp Interactive Learning uses ideal equations with supply-rail limits. The breadboard simulator uses a simplified UA741 model that includes bandwidth, slew rate, and output headroom. The two tools can therefore give different results.',
      'Read each tool’s model notes when interpreting a measurement. Real components and instruments have additional limitations and tolerances; these educational models do not replace measurements on your physical circuit.',
    ],
  },
  ...TOPICS.map((topic) => ({
    id: `offline-${topic.id}`,
    title: getTool(topic.id, 'simulator').title,
    kind: 'download' as const,
    href: topic.simulator.download,
    topicId: topic.id,
    description:
      'Self-contained HTML. Download the file and open it in a browser to use the simulator without an internet connection.',
  })),
];
