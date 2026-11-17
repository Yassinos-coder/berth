import { defineConfig } from 'vitepress';

const repo = 'https://github.com/Yassinos-coder/berth';

export default defineConfig({
  title: 'Berth',
  description:
    'Self-hosted deployment panel for your own VPS. Deploy apps, databases and services on servers you own.',
  lang: 'en-US',
  base: '/berth/',
  srcDir: '../../docs',
  outDir: './dist',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['**/roadmap-v1.md.bak'],
  head: [
    ['meta', { name: 'theme-color', content: '#22b8cf' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/berth/logo.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Berth',
    nav: [
      { text: 'Guide', link: '/installation', activeMatch: '^/(installation|first-deploy|guides)' },
      { text: 'Concepts', link: '/concepts' },
      { text: 'Operate', link: '/operations', activeMatch: '^/(operations|security-lifecycle|reliability|environments|scaling)' },
      { text: 'Contribute', link: '/developer-guide' },
    ],
    sidebar: [
      {
        text: 'Getting started',
        items: [
          { text: 'What is Berth', link: '/introduction' },
          { text: 'Installation', link: '/installation' },
          { text: 'Deploy your first app', link: '/first-deploy' },
          { text: 'Concepts', link: '/concepts' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'GitHub deploys', link: '/guides/github-deploys' },
          { text: 'Domains and HTTPS', link: '/guides/domains-https' },
          { text: 'Databases and templates', link: '/guides/databases-templates' },
          { text: 'Several servers', link: '/guides/multi-server' },
          { text: 'Storage', link: '/guides/storage' },
          { text: 'AI advisor', link: '/guides/ai-advisor' },
          { text: 'Browser notifications', link: '/guides/browser-notifications' },
          { text: 'Teams and access', link: '/guides/teams-access' },
          { text: 'CLI and MCP', link: '/guides/cli' },
          { text: 'Scaling', link: '/scaling' },
        ],
      },
      {
        text: 'Operations',
        items: [
          { text: 'Operations runbooks', link: '/operations' },
          { text: 'Reliability and observability', link: '/reliability' },
          { text: 'Environments', link: '/environments' },
        ],
      },
      {
        text: 'Security',
        items: [
          { text: 'Security policy', link: '/security' },
          { text: 'Security lifecycle', link: '/security-lifecycle' },
        ],
      },
      {
        text: 'Internals',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'Protocol versioning', link: '/protocol-versioning' },
          { text: 'Developer guide', link: '/developer-guide' },
          { text: 'v1 roadmap', link: '/roadmap-v1' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    search: { provider: 'local' },
    editLink: {
      pattern: `${repo}/edit/production/docs/:path`,
      text: 'Edit this page on GitHub',
    },
    outline: { level: [2, 3], label: 'On this page' },
    docFooter: { prev: 'Previous', next: 'Next' },
    footer: {
      message: 'Berth is in alpha. Free for non-commercial use under the PolyForm Noncommercial License 1.0.0.',
    },
  },
});
