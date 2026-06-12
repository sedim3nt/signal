import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const signalPath = path.join(root, "public", "data", "signal.json");
const schemaPath = path.join(root, "data", "schema.sql");
const dbPath = path.join(root, "data", "signal.sqlite");
const publicDbPath = path.join(root, "public", "data", "signal.sqlite");
const dbExportPath = path.join(root, "public", "data", "signal-db.json");

function asJson(value) {
  return JSON.stringify(value || []);
}

async function main() {
  const signal = JSON.parse(await fs.readFile(signalPath, "utf8"));
  const schema = await fs.readFile(schemaPath, "utf8");

  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.rm(dbPath, { force: true });
  await fs.rm(`${dbPath}-wal`, { force: true });
  await fs.rm(`${dbPath}-shm`, { force: true });

  const db = new DatabaseSync(dbPath);
  db.exec(schema);
  db.exec("BEGIN");

  db.prepare(
    `INSERT INTO runs (generated_at, cutoff, video_count, active_channel_count, warning_count)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    signal.generatedAt,
    signal.cutoff,
    signal.videos.length,
    signal.channels.filter((channel) => channel.active).length,
    signal.coverage?.warnings?.length || 0
  );

  const insertTopic = db.prepare(
    `INSERT INTO topics (id, label, description) VALUES (?, ?, ?)`
  );
  const insertChannel = db.prepare(
    `INSERT INTO channels (id, name, handle, channel_id, url, tier, active, cadence, why_watch, lens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertChannelTopic = db.prepare(
    `INSERT OR IGNORE INTO channel_topics (channel_id, topic_id) VALUES (?, ?)`
  );
  const insertVideo = db.prepare(
    `INSERT INTO videos (
      id, channel_id, source_channel_id, title, url, published_at, published_date,
      duration_seconds, thumbnail, score, transcript_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertVideoTopic = db.prepare(
    `INSERT OR IGNORE INTO video_topics (video_id, topic_id) VALUES (?, ?)`
  );
  const insertSummary = db.prepare(
    `INSERT INTO summaries (
      video_id, tldr, portfolio_signal, career_signal, alpha_json, bullets_json,
      actions_json, risks_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertWarning = db.prepare(
    `INSERT INTO coverage_warnings (warning) VALUES (?)`
  );
  const insertNarrative = db.prepare(
    `INSERT INTO narratives (
      id, title, summary, strength, momentum, why_it_matters, watch_next_json, generated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertNarrativeTopic = db.prepare(
    `INSERT OR IGNORE INTO narrative_topics (narrative_id, topic_id) VALUES (?, ?)`
  );
  const insertNarrativeEvidence = db.prepare(
    `INSERT OR IGNORE INTO narrative_evidence (narrative_id, video_id, rank) VALUES (?, ?, ?)`
  );

  for (const topic of signal.topics) {
    insertTopic.run(topic.id, topic.label, topic.description || null);
  }

  for (const channel of signal.channels) {
    insertChannel.run(
      channel.id,
      channel.name,
      channel.handle || null,
      channel.channelId || null,
      channel.url || null,
      channel.tier || null,
      channel.active ? 1 : 0,
      channel.cadence || null,
      channel.whyWatch || null,
      channel.lens || null
    );
    for (const topic of channel.topics || []) {
      insertChannelTopic.run(channel.id, topic);
    }
  }

  for (const video of signal.videos) {
    insertVideo.run(
      video.id,
      video.channelId,
      video.sourceChannelId || null,
      video.title,
      video.url,
      video.publishedAt || null,
      video.publishedDate || null,
      video.durationSeconds || null,
      video.thumbnail || null,
      video.score || 0,
      video.transcriptStatus || "unknown"
    );
    for (const topic of video.topics || []) {
      insertVideoTopic.run(video.id, topic);
    }
    insertSummary.run(
      video.id,
      video.summary?.tldr || "",
      video.summary?.portfolioSignal || "",
      video.summary?.careerSignal || "",
      asJson(video.summary?.alpha),
      asJson(video.summary?.bullets),
      asJson(video.summary?.actions),
      asJson(video.summary?.risks)
    );
  }

  for (const warning of signal.coverage?.warnings || []) {
    insertWarning.run(warning);
  }

  for (const narrative of signal.synthesis?.narratives || []) {
    insertNarrative.run(
      narrative.id,
      narrative.title,
      narrative.summary || null,
      narrative.strength || 0,
      narrative.momentum || null,
      narrative.whyItMatters || null,
      asJson(narrative.watchNext),
      signal.synthesis?.generatedAt || signal.generatedAt
    );
    for (const topic of narrative.topics || []) {
      insertNarrativeTopic.run(narrative.id, topic);
    }
    for (const [index, videoId] of (narrative.evidence || []).entries()) {
      insertNarrativeEvidence.run(narrative.id, videoId, index + 1);
    }
  }

  db.exec("COMMIT");
  db.exec("PRAGMA wal_checkpoint(FULL)");
  db.close();

  const normalized = {
    generatedAt: signal.generatedAt,
    cutoff: signal.cutoff,
    tables: {
      channels: signal.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        handle: channel.handle,
        tier: channel.tier,
        active: channel.active,
        topics: channel.topics || [],
        url: channel.url,
        whyWatch: channel.whyWatch,
        lens: channel.lens
      })),
      topics: signal.topics,
      videos: signal.videos.map((video) => ({
        id: video.id,
        channelId: video.channelId,
        title: video.title,
        url: video.url,
        publishedAt: video.publishedAt,
        durationSeconds: video.durationSeconds,
        score: video.score,
        transcriptStatus: video.transcriptStatus,
        topics: video.topics || []
      })),
      summaries: signal.videos.map((video) => ({
        videoId: video.id,
        ...video.summary
      })),
      narratives: signal.synthesis?.narratives || [],
      coverageWarnings: signal.coverage?.warnings || []
    }
  };

  await fs.writeFile(dbExportPath, `${JSON.stringify(normalized, null, 2)}\n`);
  await fs.copyFile(dbPath, publicDbPath);
  console.log(`Wrote SQLite database: ${dbPath}`);
  console.log(`Wrote public SQLite database: ${publicDbPath}`);
  console.log(`Wrote normalized JSON database: ${dbExportPath}`);
  console.log(`Rows: ${signal.videos.length} videos, ${signal.channels.length} channels`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
