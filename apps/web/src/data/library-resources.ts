export interface LibraryResource {
  id: string;
  title: string;
  tagline: string;
  creator: string;
  creatorUrl?: string;
  url: string;
  category: 'visualizers' | 'devtools' | 'architecture' | 'frontend' | 'ai' | 'inspiration';
  categoryLabel: string;
  featured?: boolean;
  badge?: string;
  tags: string[];
  description: string;
  accentColor: string;
}

export const LIBRARY_RESOURCES: LibraryResource[] = [
  {
    id: 'vizly',
    title: 'Vizly',
    tagline: 'Interactive Web Data Visualization & Chart Engine',
    creator: 'Obydul (Team Lead / Creator)',
    creatorUrl: 'https://github.com/obydul',
    url: 'https://vizly.dev/',
    category: 'visualizers',
    categoryLabel: 'Data & Charts',
    featured: true,
    badge: '🌟 Flagship Community Spotlight',
    tags: ['Charts', 'Data Viz', 'TypeScript', 'Web APIs', 'Open Source'],
    description:
      'A blazing-fast, modular web-native data visualization engine built to render interactive, publication-quality diagrams and financial analytics with zero configuration bloat.',
    accentColor: '#00f0ff',
  },
  {
    id: 'bundlephobia',
    title: 'Bundlephobia',
    tagline: 'Find the cost of adding an npm package',
    creator: 'Shubham Kanodia',
    creatorUrl: 'https://github.com/pastelsky',
    url: 'https://bundlephobia.com/',
    category: 'devtools',
    categoryLabel: 'Dev Tools',
    featured: false,
    badge: 'Essential',
    tags: ['npm', 'Performance', 'Bundle Size', 'Optimization'],
    description:
      'Instantly check the minified and gzipped bundle size of any npm package before importing it into your codebase, complete with download speed estimations on 3G/4G.',
    accentColor: '#38bdf8',
  },
  {
    id: 'excalidraw',
    title: 'Excalidraw',
    tagline: 'Virtual whiteboard for hand-drawn diagrams',
    creator: 'Excalidraw Team',
    url: 'https://excalidraw.com/',
    category: 'architecture',
    categoryLabel: 'Architecture & Diagrams',
    featured: true,
    badge: 'Top Pick',
    tags: ['Whiteboard', 'System Design', 'Collaboration', 'SVG'],
    description:
      'The gold standard sketch tool for distributed system architecture, database ER diagrams, and UI wireframes with organic hand-drawn aesthetics and end-to-end encryption.',
    accentColor: '#f59e0b',
  },
  {
    id: 'system-design-101',
    title: 'System Design 101',
    tagline: 'Visual guide to complex distributed systems',
    creator: 'Alex Xu (ByteByteGo)',
    creatorUrl: 'https://bytebytego.com/',
    url: 'https://github.com/alexeygrigorev/data-science-interviews',
    category: 'architecture',
    categoryLabel: 'Architecture & Diagrams',
    featured: false,
    tags: ['Microservices', 'Distributed Systems', 'Caching', 'Databases'],
    description:
      'Clear, visual animated explanations of real-world backend architecture: load balancers, message queues, Raft consensus, database sharding, and edge CDNs.',
    accentColor: '#10b981',
  },
  {
    id: 'roadmap-sh',
    title: 'Roadmap.sh',
    tagline: 'Community-driven developer roadmaps & skill trees',
    creator: 'Kamran Ahmed',
    url: 'https://roadmap.sh/',
    category: 'devtools',
    categoryLabel: 'Dev Tools',
    featured: false,
    badge: 'Learning Hub',
    tags: ['Roadmaps', 'Fullstack', 'DevOps', 'Cybersecurity', 'AI'],
    description:
      'Interactive step-by-step career path guides for frontend, backend, DevOps, and blockchain development, with comprehensive resources vetted by thousands of engineers.',
    accentColor: '#a855f7',
  },
  {
    id: 'transform-tools',
    title: 'Transform.tools',
    tagline: 'Polyglot web developer converter engine',
    creator: 'Ritz078',
    url: 'https://transform.tools/',
    category: 'devtools',
    categoryLabel: 'Dev Tools',
    featured: false,
    tags: ['JSON to TS', 'SVG to JSX', 'CSS to Tailwind', 'GraphQL'],
    description:
      'Zero-latency browser engine to convert JSON into TypeScript types, SVG into React JSX, CSS into CSS-in-JS, and HTML into clean Markdown without backend roundtrips.',
    accentColor: '#ec4899',
  },
  {
    id: 'caniuse',
    title: 'Can I Use',
    tagline: 'Browser support tables for modern HTML5 & CSS',
    creator: 'Alexis Deveria',
    url: 'https://caniuse.com/',
    category: 'frontend',
    categoryLabel: 'Frontend',
    featured: false,
    tags: ['CSS', 'HTML5', 'Web APIs', 'Browser Support'],
    description:
      'The definitive compatibility checker for cutting-edge CSS features (container queries, :has, popover API, view transitions) across modern browsers.',
    accentColor: '#f97316',
  },
  {
    id: 'realtime-colors',
    title: 'Realtime Colors',
    tagline: 'Visualize color palettes on a live UI',
    creator: 'Juxtopposed',
    url: 'https://www.realtimecolors.com/',
    category: 'inspiration',
    categoryLabel: 'Design & UI',
    featured: false,
    badge: 'Designer Gem',
    tags: ['Colors', 'UI Design', 'Accessibility', 'Contrast'],
    description:
      'Test and adjust complete harmonious UI color schemes directly on a simulated real-world dashboard with automatic WCAG contrast validation.',
    accentColor: '#06b6d4',
  },
  {
    id: 'svgl',
    title: 'SVGL',
    tagline: 'Curated library of high-resolution SVG tech logos',
    creator: 'Eray Ates',
    url: 'https://svgl.app/',
    category: 'frontend',
    categoryLabel: 'Frontend',
    featured: false,
    tags: ['SVG', 'Logos', 'Frameworks', 'Icons'],
    description:
      'Searchable catalog of pixel-perfect SVG logos for every modern framework, language, database, cloud provider, and developer tool.',
    accentColor: '#8b5cf6',
  },
  {
    id: 'http-cats',
    title: 'HTTP Cats & Dogs',
    tagline: 'Visual HTTP status code reference',
    creator: 'Tomomi Imura',
    url: 'https://httpcats.com/',
    category: 'inspiration',
    categoryLabel: 'Design & UI',
    featured: false,
    tags: ['HTTP', 'Status Codes', 'Fun', 'Reference'],
    description:
      'Never forget what HTTP 418 I am a teapot or HTTP 429 Too Many Requests means with hilarious and memorable feline API illustrations.',
    accentColor: '#eab308',
  },
  {
    id: 'sqlite-wasm',
    title: 'SQLite in Browser (WASM)',
    tagline: 'Official SQLite WebAssembly demonstration',
    creator: 'SQLite Consortium',
    url: 'https://sqlite.org/wasm/doc/trunk/demo-123.html',
    category: 'architecture',
    categoryLabel: 'Architecture & Diagrams',
    featured: false,
    tags: ['WebAssembly', 'SQLite', 'Client-side DB', 'Storage'],
    description:
      'Run a full ACID-compliant relational SQL engine directly in client-side browser memory backed by the Origin Private File System (OPFS).',
    accentColor: '#3b82f6',
  },
  {
    id: 'shadcn-ui',
    title: 'shadcn/ui',
    tagline: 'Beautifully designed accessible components',
    creator: 'Shadcn',
    url: 'https://ui.shadcn.com/',
    category: 'frontend',
    categoryLabel: 'Frontend',
    featured: false,
    tags: ['Components', 'Tailwind', 'Radix UI', 'Accessible'],
    description:
      'Copy-and-paste accessible React and Tailwind components that you own and can customize completely without third-party library locks.',
    accentColor: '#ffffff',
  },
];
