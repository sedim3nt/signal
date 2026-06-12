export const fallbackData = {
  generatedAt: new Date().toISOString(),
  cutoff: new Date(Date.now() - 92 * 86400000).toISOString(),
  strategy: {
    purpose: [
      'Investing signal for quarterly rebalance decisions.',
      'AI-age relevance for freelance/operator work.'
    ]
  },
  topics: [
    { id: 'ai-tools', label: 'AI Tools' },
    { id: 'operator', label: 'Operator Edge' },
    { id: 'macro', label: 'Macro' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'investing', label: 'Investing' },
    { id: 'space', label: 'Space' }
  ],
  channels: [],
  daily: {
    date: new Date().toISOString().slice(0, 10),
    tldr: ['Run `npm run ingest:seed` or `npm run ingest:full` to populate live YouTube signal.'],
    mostImportant: [],
    watchItems: [],
    investingSignals: [],
    careerSignals: [],
    topicPulse: [],
    coverage: {
      lookbackDays: 92,
      activeChannelCount: 0,
      processedVideoCount: 0,
      recentVideoCount: 0,
      warnings: []
    }
  },
  videos: [],
  coverage: { warnings: [], channels: [] }
};
