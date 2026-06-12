import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Brain,
  BriefcaseBusiness,
  CalendarClock,
  CircleDollarSign,
  Database,
  Filter,
  Flame,
  Gauge,
  Globe2,
  Layers3,
  LineChart,
  ListChecks,
  Play,
  Radio,
  Rocket,
  Search,
  Sparkles,
  Target,
  Telescope,
  TimerReset,
  TrendingUp,
  UsersRound,
  Video
} from 'lucide-react';
import { fallbackData } from './lib/fallbackData';
import './App.css';

const navItems = [
  { id: 'today', label: 'Today', icon: Flame },
  { id: 'narratives', label: 'Signal Map', icon: Target },
  { id: 'creators', label: 'Creators', icon: UsersRound },
  { id: 'topics', label: 'Topics', icon: Layers3 },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'watchlist', label: 'Sources', icon: Telescope },
  { id: 'ops', label: 'Ops', icon: Database }
];

const topicIcons = {
  'ai-tools': Brain,
  operator: BriefcaseBusiness,
  macro: Globe2,
  crypto: CircleDollarSign,
  investing: LineChart,
  space: Rocket
};

const topicColors = {
  'ai-tools': 'teal',
  operator: 'violet',
  macro: 'amber',
  crypto: 'green',
  investing: 'red',
  space: 'blue'
};

function cls(...parts) {
  return parts.filter(Boolean).join(' ');
}

function formatDate(value) {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatDuration(seconds) {
  if (!seconds) return 'unknown';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function scoreTone(score = 0) {
  if (score >= 80) return 'hot';
  if (score >= 65) return 'good';
  if (score >= 50) return 'watch';
  return 'quiet';
}

function useSignalData() {
  const [data, setData] = useState(fallbackData);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    fetch(`/data/signal.json?ts=${Date.now()}`)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      })
      .then((json) => {
        if (active) {
          setData(json);
          setStatus('live');
        }
      })
      .catch(() => {
        if (active) setStatus('fallback');
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, status };
}

function Shell({ data, status, section, setSection, children }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Radio size={18} />
          </div>
          <div>
            <div className="brand-name">Signal</div>
            <div className="brand-sub">spirittree.dev</div>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={cls('nav-button', section === item.id && 'active')}
                key={item.id}
                onClick={() => setSection(item.id)}
                type="button"
                title={item.label}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className={cls('status-dot', status)} />
          <span>{status === 'live' ? 'Live data' : status === 'loading' ? 'Loading' : 'Sample data'}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Transcript-to-signal intelligence</p>
            <h1>Daily signal brief</h1>
          </div>
          <div className="topbar-meta">
            <span>
              <CalendarClock size={15} />
              {formatDateTime(data.generatedAt)}
            </span>
            <span>
              <TimerReset size={15} />
              {data.daily?.coverage?.lookbackDays || 92}d lookback
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = 'neutral' }) {
  return (
    <div className={cls('stat-card', tone)}>
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

function TopicPill({ topic, topics }) {
  const meta = topics.find((item) => item.id === topic);
  const Icon = topicIcons[topic] || Target;
  return (
    <span className={cls('topic-pill', topicColors[topic] || 'gray')}>
      <Icon size={12} />
      {meta?.label || topic}
    </span>
  );
}

function ScoreBadge({ score }) {
  return <span className={cls('score-badge', scoreTone(score))}>{score}</span>;
}

function VideoCard({ video, topics, compact = false }) {
  return (
    <article className={cls('video-card', compact && 'compact')}>
      <a className="thumb" href={video.url} target="_blank" rel="noreferrer" aria-label={video.title}>
        <img src={video.thumbnail} alt="" loading="lazy" />
        <span>
          <Play size={13} />
          {formatDuration(video.durationSeconds)}
        </span>
      </a>
      <div className="video-body">
        <div className="video-head">
          <div>
            <p className="source-line">{video.channelName} · {formatDate(video.publishedAt)}</p>
            <h3>{video.title}</h3>
          </div>
          <ScoreBadge score={video.score} />
        </div>
        <p className="video-tldr">{video.summary?.tldr}</p>
        <div className="pill-row">
          {(video.topics || []).slice(0, 4).map((topic) => (
            <TopicPill key={topic} topic={topic} topics={topics} />
          ))}
        </div>
        {!compact && (
          <div className="signal-grid">
            <div>
              <span>Portfolio</span>
              <p>{video.summary?.portfolioSignal || 'Low direct relevance.'}</p>
            </div>
            <div>
              <span>Career</span>
              <p>{video.summary?.careerSignal || 'Low direct relevance.'}</p>
            </div>
          </div>
        )}
        <a className="source-link" href={video.url} target="_blank" rel="noreferrer">
          Source <ArrowUpRight size={14} />
        </a>
      </div>
    </article>
  );
}

function Today({ data }) {
  const videosById = useMemo(() => new Map(data.videos.map((video) => [video.id, video])), [data.videos]);
  const mostImportant = data.daily?.mostImportant || [];
  const synthesisBrief = data.synthesis?.executiveBrief?.length
    ? data.synthesis.executiveBrief
    : data.daily?.synthesis || data.daily?.tldr || [];
  const topNarratives = (data.synthesis?.narratives || [])
    .slice()
    .sort((a, b) => (b.strength || 0) - (a.strength || 0))
    .slice(0, 3);
  const hero = mostImportant
    .map((item) => videosById.get(item.videoId))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <section className="content-stack">
      <div className="stat-grid">
        <StatCard
          icon={Video}
          label="Videos Processed"
          value={data.daily?.coverage?.processedVideoCount || data.videos.length}
          sub={`${data.daily?.coverage?.recentVideoCount || 0} in the last 7d`}
          tone="green"
        />
        <StatCard
          icon={UsersRound}
          label="Active Creators"
          value={data.daily?.coverage?.activeChannelCount || data.channels.filter((channel) => channel.active).length}
          sub={`${data.channels.filter((channel) => channel.tier === 'scout').length} scouts`}
          tone="violet"
        />
        <StatCard
          icon={Gauge}
          label="Top Score"
          value={data.videos.length ? Math.max(...data.videos.map((video) => video.score || 0)) : 0}
          sub="importance 0-100"
          tone="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Coverage Flags"
          value={data.coverage?.warnings?.length || 0}
          sub="scan or transcript issues"
          tone="red"
        />
      </div>

      <div className="today-layout">
        <section className="panel lead-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Today’s signal</p>
              <h2>What matters now</h2>
            </div>
            <Sparkles size={20} />
          </div>
          <ul className="tldr-list">
            {synthesisBrief.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Decision queue</p>
              <h2>Act, monitor, ignore</h2>
            </div>
            <ListChecks size={20} />
          </div>
          <div className="action-list">
            {(data.daily?.watchItems || []).slice(0, 7).map((item, index) => {
              const video = videosById.get(item.videoId);
              return (
                <a key={`${item.videoId}-${index}`} href={video?.url || '#'} target="_blank" rel="noreferrer">
                  <span>{index + 1}</span>
                  <p>{item.text}</p>
                </a>
              );
            })}
            {!data.daily?.watchItems?.length && <p className="empty">No action items yet.</p>}
          </div>
        </section>
      </div>

      {!!topNarratives.length && (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Cross-source synthesis</p>
              <h2>Live narratives</h2>
            </div>
            <Target size={20} />
          </div>
          <div className="narrative-grid">
            {topNarratives.map((narrative) => (
              <NarrativeCard
                key={narrative.id}
                narrative={narrative}
                topics={data.topics}
                videosById={videosById}
              />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Evidence trail</p>
            <h2>Most important source items</h2>
          </div>
          <TrendingUp size={20} />
        </div>
        <div className="video-grid">
          {hero.map((video) => (
            <VideoCard key={video.id} video={video} topics={data.topics} />
          ))}
          {!hero.length && <p className="empty">Run ingestion to populate top source items.</p>}
        </div>
      </section>

      <div className="split-panels">
        <SignalList title="Investing Signals" icon={BarChart3} items={data.daily?.investingSignals || []} videosById={videosById} />
        <SignalList title="AI-Age Career Signals" icon={BriefcaseBusiness} items={data.daily?.careerSignals || []} videosById={videosById} />
      </div>
    </section>
  );
}

function NarrativeCard({ narrative, topics, videosById }) {
  const evidence = (narrative.evidence || [])
    .map((id) => videosById.get(id))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <article className="narrative-card">
      <div className="narrative-head">
        <div>
          <p>{narrative.momentum || 'watching'}</p>
          <h3>{narrative.title}</h3>
        </div>
        <ScoreBadge score={narrative.strength || 0} />
      </div>
      <p className="narrative-summary">{narrative.summary}</p>
      <div className="pill-row">
        {(narrative.topics || []).map((topic) => (
          <TopicPill key={topic} topic={topic} topics={topics} />
        ))}
      </div>
      {narrative.whyItMatters && (
        <div className="why-box">
          <span>Why it matters</span>
          <p>{narrative.whyItMatters}</p>
        </div>
      )}
      {!!narrative.watchNext?.length && (
        <ul className="watch-next-list">
          {narrative.watchNext.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {!!evidence.length && (
        <div className="evidence-strip">
          {evidence.map((video) => (
            <a key={video.id} href={video.url} target="_blank" rel="noreferrer">
              <strong>{video.channelName}</strong>
              <span>{video.title}</span>
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

function SignalList({ title, icon: Icon, items, videosById }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Signal stream</p>
          <h2>{title}</h2>
        </div>
        <Icon size={20} />
      </div>
      <div className="signal-list">
        {items.map((item, index) => {
          const video = videosById.get(item.videoId);
          return (
            <a key={`${item.videoId}-${index}`} href={video?.url || '#'} target="_blank" rel="noreferrer">
              <strong>{video?.channelName || 'Source'}</strong>
              <p>{item.text}</p>
            </a>
          );
        })}
        {!items.length && <p className="empty">No signal yet.</p>}
      </div>
    </section>
  );
}

function Narratives({ data }) {
  const videosById = useMemo(() => new Map(data.videos.map((video) => [video.id, video])), [data.videos]);
  const narratives = (data.synthesis?.narratives || [])
    .slice()
    .sort((a, b) => (b.strength || 0) - (a.strength || 0));
  const top = narratives[0];
  const evidenceCount = narratives.reduce((sum, item) => sum + (item.evidence?.length || 0), 0);

  return (
    <section className="content-stack">
      <div className="stat-grid">
        <StatCard icon={Target} label="Narratives" value={narratives.length} sub="cross-source themes" tone="green" />
        <StatCard icon={Gauge} label="Strongest" value={top?.strength || 0} sub={top?.momentum || 'no synthesis'} tone="amber" />
        <StatCard icon={Video} label="Evidence Links" value={evidenceCount} sub="video-backed claims" tone="violet" />
        <StatCard icon={CalendarClock} label="Synthesized" value={formatDate(data.synthesis?.generatedAt)} sub="latest run" tone="red" />
      </div>

      <div className="split-panels">
        <PlainSignalPanel
          title="Quarterly Rebalance Watch"
          eyebrow="Portfolio"
          icon={BarChart3}
          items={data.daily?.rebalanceWatch || data.synthesis?.rebalanceWatch || []}
        />
        <PlainSignalPanel
          title="AI-Age Operator Watch"
          eyebrow="Career"
          icon={BriefcaseBusiness}
          items={data.daily?.careerWatch || data.synthesis?.careerWatch || []}
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Signal map</p>
            <h2>Durable themes with evidence</h2>
          </div>
          <Layers3 size={20} />
        </div>
        <div className="narrative-grid wide">
          {narratives.map((narrative) => (
            <NarrativeCard
              key={narrative.id}
              narrative={narrative}
              topics={data.topics}
              videosById={videosById}
            />
          ))}
          {!narratives.length && <p className="empty">Run synthesis to populate the signal map.</p>}
        </div>
      </section>
    </section>
  );
}

function PlainSignalPanel({ title, eyebrow, icon: Icon, items }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <Icon size={20} />
      </div>
      <ul className="plain-signal-list">
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{item}</li>
        ))}
        {!items.length && <li>No synthesis yet.</li>}
      </ul>
    </section>
  );
}

function Creators({ data }) {
  const byChannel = useMemo(() => {
    const map = new Map();
    for (const channel of data.channels) map.set(channel.id, []);
    for (const video of data.videos) {
      if (!map.has(video.channelId)) map.set(video.channelId, []);
      map.get(video.channelId).push(video);
    }
    return map;
  }, [data.channels, data.videos]);

  return (
    <section className="content-stack">
      <div className="table-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Source quality</p>
            <h2>Creator tabs</h2>
          </div>
          <UsersRound size={20} />
        </div>
        <div className="creator-grid">
          {data.channels.map((channel) => {
            const videos = byChannel.get(channel.id) || [];
            const top = [...videos].sort((a, b) => b.score - a.score)[0];
            return (
              <article className={cls('creator-card', channel.active ? 'active' : 'scout')} key={channel.id}>
                <div className="creator-head">
                  <div>
                    <p>{channel.tier}</p>
                    <h3>{channel.name}</h3>
                    <span>{channel.handle}</span>
                  </div>
                  <ScoreBadge score={top?.score || 0} />
                </div>
                <p className="creator-why">{channel.whyWatch}</p>
                <div className="pill-row">
                  {(channel.topics || []).map((topic) => (
                    <TopicPill key={topic} topic={topic} topics={data.topics} />
                  ))}
                </div>
                <div className="creator-metrics">
                  <span>{videos.length} videos</span>
                  <span>{channel.cadence} cadence</span>
                </div>
                {top && <VideoCard video={top} topics={data.topics} compact />}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Topics({ data }) {
  const [activeTopic, setActiveTopic] = useState(data.topics[0]?.id || 'ai-tools');
  const videos = data.videos
    .filter((video) => video.topics?.includes(activeTopic))
    .sort((a, b) => b.score - a.score);
  const activeMeta = data.topics.find((topic) => topic.id === activeTopic);

  return (
    <section className="content-stack">
      <div className="segmented-wrap">
        {data.topics.map((topic) => {
          const Icon = topicIcons[topic.id] || Target;
          return (
            <button
              key={topic.id}
              className={cls('segment', activeTopic === topic.id && 'active')}
              onClick={() => setActiveTopic(topic.id)}
              type="button"
            >
              <Icon size={15} />
              {topic.label}
            </button>
          );
        })}
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Topic tab</p>
            <h2>{activeMeta?.label || activeTopic}</h2>
          </div>
          <Target size={20} />
        </div>
        <div className="video-grid">
          {videos.slice(0, 12).map((video) => (
            <VideoCard key={video.id} video={video} topics={data.topics} />
          ))}
          {!videos.length && <p className="empty">No videos tagged to this topic yet.</p>}
        </div>
      </section>
    </section>
  );
}

function Videos({ data }) {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('all');
  const [creator, setCreator] = useState('all');

  const filtered = data.videos.filter((video) => {
    const matchesTopic = topic === 'all' || video.topics?.includes(topic);
    const matchesCreator = creator === 'all' || video.channelId === creator;
    const haystack = `${video.title} ${video.channelName} ${video.summary?.tldr}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    return matchesTopic && matchesCreator && matchesQuery;
  });

  return (
    <section className="content-stack">
      <div className="filterbar">
        <div className="searchbox">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search signal" />
        </div>
        <label>
          <Filter size={15} />
          <select value={topic} onChange={(event) => setTopic(event.target.value)}>
            <option value="all">All topics</option>
            {data.topics.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label>
          <UsersRound size={15} />
          <select value={creator} onChange={(event) => setCreator(event.target.value)}>
            <option value="all">All creators</option>
            {data.channels.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Video index</p>
            <h2>{filtered.length} source items</h2>
          </div>
          <Video size={20} />
        </div>
        <div className="video-list">
          {filtered.map((video) => (
            <VideoCard key={video.id} video={video} topics={data.topics} />
          ))}
        </div>
      </section>
    </section>
  );
}

function Watchlist({ data }) {
  const active = data.channels.filter((channel) => channel.active);
  const scouts = data.channels.filter((channel) => !channel.active);

  return (
    <section className="content-stack">
      <div className="split-panels">
        <WatchGroup title="Core Sources" icon={Radio} channels={active} topics={data.topics} />
        <WatchGroup title="Scout Sources" icon={Telescope} channels={scouts} topics={data.topics} />
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Channel thesis</p>
            <h2>Why this list</h2>
          </div>
          <Target size={20} />
        </div>
        <div className="principle-grid">
          {(data.strategy?.selectionPrinciples || []).map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </section>
  );
}

function WatchGroup({ title, icon: Icon, channels, topics }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Sources</p>
          <h2>{title}</h2>
        </div>
        <Icon size={20} />
      </div>
      <div className="watch-group">
        {channels.map((channel) => (
          <a key={channel.id} href={channel.url} target="_blank" rel="noreferrer">
            <div>
              <strong>{channel.name}</strong>
              <span>{channel.lens}</span>
            </div>
            <div className="pill-row">
              {(channel.topics || []).slice(0, 3).map((topic) => (
                <TopicPill key={topic} topic={topic} topics={topics} />
              ))}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Ops({ data, status }) {
  return (
    <section className="content-stack">
      <div className="stat-grid">
        <StatCard icon={Database} label="Data Status" value={status} sub="frontend payload" tone="green" />
        <StatCard icon={TimerReset} label="Cutoff" value={formatDate(data.cutoff)} sub="retro window" tone="amber" />
        <StatCard icon={Video} label="Transcript Missing" value={data.videos.filter((video) => video.transcriptStatus === 'missing').length} sub="caption failures" tone="red" />
        <StatCard icon={Radio} label="Scout Channels" value={data.channels.filter((channel) => !channel.active).length} sub="not in daily run" tone="violet" />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Run state</p>
            <h2>Coverage warnings</h2>
          </div>
          <AlertTriangle size={20} />
        </div>
        <div className="warning-list">
          {(data.coverage?.warnings || []).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {!data.coverage?.warnings?.length && <p className="empty">No coverage warnings.</p>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Per-channel scrape</p>
            <h2>Discovery table</h2>
          </div>
          <Database size={20} />
        </div>
        <div className="ops-table">
          <div className="ops-row head">
            <span>Channel</span>
            <span>Found</span>
            <span>Accepted</span>
            <span>Cutoff</span>
          </div>
          {(data.coverage?.channels || []).map((row) => {
            const channel = data.channels.find((item) => item.id === row.id);
            return (
              <div className="ops-row" key={row.id}>
                <span>{channel?.name || row.id}</span>
                <span>{row.found}</span>
                <span>{row.accepted}</span>
                <span>{row.reachedOlder ? 'reached' : 'not reached'}</span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default function App() {
  const { data, status } = useSignalData();
  const [section, setSection] = useState('today');

  const page = {
    today: <Today data={data} />,
    narratives: <Narratives data={data} />,
    creators: <Creators data={data} />,
    topics: <Topics data={data} />,
    videos: <Videos data={data} />,
    watchlist: <Watchlist data={data} />,
    ops: <Ops data={data} status={status} />
  }[section];

  return (
    <Shell data={data} status={status} section={section} setSection={setSection}>
      {page}
    </Shell>
  );
}
