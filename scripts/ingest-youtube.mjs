import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import OpenAI from "openai";

const root = process.cwd();
const channelsPath = path.join(root, "data", "channels.json");
const cacheDir = path.join(root, ".cache", "youtube");
const transcriptDir = path.join(cacheDir, "transcripts");
const rawInfoDir = path.join(cacheDir, "raw-info");
const summaryDir = path.join(cacheDir, "summaries");
const publicDataDir = path.join(root, "public", "data");
const signalPath = path.join(publicDataDir, "signal.json");
const localOpenClawYoutube = "/Users/spirittree/.openclaw/workspace/reference/youtube-monitor";

const TOPIC_IDS = ["ai-tools", "operator", "macro", "crypto", "investing", "space"];
const DEFAULT_MODEL_CHAIN = [
  process.env.OPENAI_MODEL,
  "gpt-4.1-mini",
  "gpt-4o-mini"
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    days: 92,
    scanLimit: 80,
    limitPerChannel: 0,
    includeScout: false,
    noOpenAI: false,
    metadataOnly: false,
    reuseLocal: true,
    mergeExisting: true,
    discovery: "auto",
    channel: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--days") args.days = Number(next), i += 1;
    else if (arg === "--scan-limit") args.scanLimit = Number(next), i += 1;
    else if (arg === "--limit-per-channel") args.limitPerChannel = Number(next), i += 1;
    else if (arg === "--include-scout") args.includeScout = true;
    else if (arg === "--no-openai") args.noOpenAI = true;
    else if (arg === "--metadata-only") args.metadataOnly = true;
    else if (arg === "--no-reuse-local") args.reuseLocal = false;
    else if (arg === "--replace") args.mergeExisting = false;
    else if (arg === "--discovery") args.discovery = next, i += 1;
    else if (arg === "--channel") args.channel = next, i += 1;
  }
  return args;
}

async function ensureDirs() {
  await fs.mkdir(transcriptDir, { recursive: true });
  await fs.mkdir(rawInfoDir, { recursive: true });
  await fs.mkdir(summaryDir, { recursive: true });
  await fs.mkdir(publicDataDir, { recursive: true });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: root, env: process.env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: String(error) });
    });

    if (options.timeoutMs) {
      setTimeout(() => {
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }
  });
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "signal-dashboard/1.0"
      }
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function uploadDateToIso(uploadDate) {
  if (!uploadDate || !/^\d{8}$/.test(uploadDate)) return null;
  const year = uploadDate.slice(0, 4);
  const month = uploadDate.slice(4, 6);
  const day = uploadDate.slice(6, 8);
  return `${year}-${month}-${day}T00:00:00.000Z`;
}

function dateKey(iso) {
  return iso ? iso.slice(0, 10) : "unknown";
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripCaptionMarkup(text) {
  const lines = text
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("WEBVTT"))
    .filter((line) => !line.startsWith("Kind:"))
    .filter((line) => !line.startsWith("Language:"))
    .filter((line) => !line.startsWith("NOTE"))
    .filter((line) => !/^\d+$/.test(line))
    .filter((line) => !line.includes("-->"))
    .map((line) => line.replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, ""))
    .map((line) => line.replace(/<[^>]+>/g, ""))
    .map((line) => line.replace(/\[[^\]]+\]/g, ""))
    .map((line) => line.trim())
    .filter(Boolean);

  const deduped = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return normalizeWhitespace(deduped.join("\n"));
}

function transcriptHash(text) {
  return crypto.createHash("sha256").update(text || "").digest("hex").slice(0, 16);
}

async function discoverFlat(channel, scanLimit) {
  const result = await run("yt-dlp", [
    "--no-warnings",
    "--flat-playlist",
    "--playlist-end",
    String(scanLimit),
    "--dump-json",
    channel.url
  ]);

  if (result.code !== 0) {
    return { entries: [], error: result.stderr.trim() || "yt-dlp discovery failed" };
  }

  const entries = result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      url: entry.url || entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
      thumbnail: Array.isArray(entry.thumbnails) ? entry.thumbnails.at(-1)?.url : null,
      duration: entry.duration,
      channelId: entry.playlist_channel_id || channel.channelId
    }));

  return { entries, error: null };
}

function compactYouTubeId(value) {
  if (!value) return null;
  return String(value).replace(/^yt:video:/, "");
}

function isoToUploadDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function discoverRss(channel, scanLimit) {
  if (!channel.channelId) {
    return { entries: [], error: "missing channelId for RSS discovery", source: "rss" };
  }

  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}`;
  try {
    const xml = await fetchText(url);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "text"
    });
    const parsed = parser.parse(xml);
    const rawEntries = parsed?.feed?.entry
      ? Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry]
      : [];
    const entries = rawEntries.slice(0, scanLimit).map((entry) => {
      const id = compactYouTubeId(entry["yt:videoId"] || entry.id);
      const publishedAt = entry.published || entry.updated || null;
      return {
        id,
        title: typeof entry.title === "string" ? entry.title : entry.title?.text || "Untitled video",
        url: entry.link?.href || `https://www.youtube.com/watch?v=${id}`,
        webpage_url: entry.link?.href || `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        duration: null,
        upload_date: isoToUploadDate(publishedAt),
        publishedAt,
        channelId: channel.channelId,
        discoverySource: "rss"
      };
    }).filter((entry) => entry.id);

    return { entries, error: null, source: "rss", limited: false };
  } catch (error) {
    return { entries: [], error: String(error.message || error), source: "rss" };
  }
}

async function discoverUploads(channel, args) {
  if (args.discovery !== "yt-dlp") {
    const rss = await discoverRss(channel, args.scanLimit);
    if (rss.entries.length) return rss;
    if (args.discovery === "rss") return rss;
  }

  const flat = await discoverFlat(channel, args.scanLimit);
  return { ...flat, source: "yt-dlp", limited: true };
}

async function fetchVideoInfo(entry) {
  const cachedPath = path.join(rawInfoDir, `${entry.id}.json`);
  const cached = await readJson(cachedPath);
  if (cached?.id) return cached;

  const result = await run("yt-dlp", [
    "--no-warnings",
    "--dump-single-json",
    "--skip-download",
    entry.url
  ], { timeoutMs: 45000 });

  if (result.code !== 0) {
    if (entry.upload_date && entry.title && entry.id) {
      return {
        ...entry,
        webpage_url: entry.webpage_url || entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
        metadataWarning: result.stderr.trim() || "metadata fetch failed; using discovery metadata"
      };
    }
    return { ...entry, error: result.stderr.trim() || "metadata fetch failed" };
  }

  try {
    const info = JSON.parse(result.stdout);
    await writeJson(cachedPath, info);
    return info;
  } catch {
    return { ...entry, error: "metadata JSON parse failed" };
  }
}

async function findLocalTranscript(videoId) {
  const candidates = [
    path.join(localOpenClawYoutube, "transcripts", `${videoId}.txt`),
    path.join(localOpenClawYoutube, "transcripts", `${videoId}.en.txt`)
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const text = normalizeWhitespace(await fs.readFile(candidate, "utf8"));
      if (text && text !== "NO TRANSCRIPT AVAILABLE") return text;
    }
  }
  return null;
}

async function getTranscript(video, reuseLocal) {
  const outPath = path.join(transcriptDir, `${video.id}.txt`);
  if (existsSync(outPath)) {
    return normalizeWhitespace(await fs.readFile(outPath, "utf8"));
  }

  if (reuseLocal) {
    const local = await findLocalTranscript(video.id);
    if (local) {
      await fs.writeFile(outPath, `${local}\n`);
      return local;
    }
  }

  const basePath = path.join(transcriptDir, video.id);
  await run("yt-dlp", [
    "--no-warnings",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    "en.*",
    "--skip-download",
    "--sub-format",
    "vtt/srt/best",
    "-o",
    basePath,
    video.webpage_url || video.url
  ], { timeoutMs: 60000 });

  const files = await fs.readdir(transcriptDir);
  const caption = files
    .filter((file) => file.startsWith(video.id) && /\.(vtt|srt)$/.test(file))
    .sort((a, b) => {
      const aScore = a.includes(".en.") ? 0 : a.includes(".en-") ? 1 : 2;
      const bScore = b.includes(".en.") ? 0 : b.includes(".en-") ? 1 : 2;
      return aScore - bScore;
    })[0];

  if (!caption) {
    await fs.writeFile(outPath, "NO TRANSCRIPT AVAILABLE\n");
    return "NO TRANSCRIPT AVAILABLE";
  }

  const raw = await fs.readFile(path.join(transcriptDir, caption), "utf8");
  const transcript = stripCaptionMarkup(raw);
  await fs.writeFile(outPath, `${transcript || "NO TRANSCRIPT AVAILABLE"}\n`);
  return transcript || "NO TRANSCRIPT AVAILABLE";
}

async function findLocalSummary(videoId) {
  const file = path.join(localOpenClawYoutube, "summaries", `${videoId}-summary.md`);
  if (!existsSync(file)) return null;
  const text = await fs.readFile(file, "utf8");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const bullets = lines
    .filter((line) => line.startsWith("- "))
    .slice(0, 8)
    .map((line) => line.replace(/^- /, ""));
  const firstHeading = lines.find((line) => line.startsWith("# "));
  return {
    tldr: bullets[0] || firstHeading?.replace(/^#\s*/, "") || "Local summary available.",
    alpha: bullets.slice(1, 4),
    bullets: bullets.length ? bullets : ["Local summary imported from prior YouTube monitor output."],
    actions: [],
    risks: [],
    portfolioSignal: "Review source before allocation decisions.",
    careerSignal: "Review source before workflow decisions."
  };
}

function inferTopics(channelTopics, title, text = "") {
  const haystack = `${title} ${text.slice(0, 5000)}`.toLowerCase();
  const topics = new Set(channelTopics || []);
  if (/\b(agent|claude|openai|anthropic|gemini|model|llm|cursor|coding|developer|mcp|ai)\b/.test(haystack)) topics.add("ai-tools");
  if (/\b(freelance|business|startup|operator|product|workflow|career|client|agency)\b/.test(haystack)) topics.add("operator");
  if (/\b(fed|liquidity|inflation|rates|treasury|recession|dollar|macro|yield|credit)\b/.test(haystack)) topics.add("macro");
  if (/\b(bitcoin|ethereum|solana|crypto|defi|token|stablecoin|onchain|wallet)\b/.test(haystack)) topics.add("crypto");
  if (/\b(stock|equity|valuation|portfolio|invest|earnings|market|rebalance|asset)\b/.test(haystack)) topics.add("investing");
  if (/\b(spacex|starship|rocket|launch|satellite|mars|nasa|space)\b/.test(haystack)) topics.add("space");
  return [...topics].filter((topic) => TOPIC_IDS.includes(topic));
}

function heuristicSummary({ video, channel, transcript }) {
  const sentences = normalizeWhitespace(transcript || "")
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 40)
    .slice(0, 8);
  const topics = inferTopics(channel.topics, video.title, transcript);
  const source = sentences[0] || `${channel.name} published "${video.title}".`;
  return {
    tldr: source.slice(0, 260),
    alpha: [
      "Treat this as a source worth reviewing before acting; no model summary was available.",
      "Use the title, channel thesis, and transcript preview as the minimum viable signal.",
      "Prioritize against your quarterly allocation and AI-operator goals."
    ],
    bullets: sentences.slice(0, 5).map((sentence) => sentence.slice(0, 220)),
    actions: ["Open the source video if this maps to an active portfolio, tool, or business decision."],
    risks: ["Heuristic fallback summary; verify against the transcript before taking action."],
    portfolioSignal: topics.some((topic) => ["macro", "crypto", "investing", "space"].includes(topic))
      ? "Potential portfolio-relevant signal; review before any allocation decision."
      : "Low direct portfolio relevance.",
    careerSignal: topics.some((topic) => ["ai-tools", "operator"].includes(topic))
      ? "Potential workflow or career-relevance signal; review for tools/process changes."
      : "Low direct career relevance.",
    topics,
    score: 45
  };
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found");
  return JSON.parse(text.slice(start, end + 1));
}

async function openAiJson(prompt, maxOutputTokens = 1600) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let lastError = null;

  for (const model of DEFAULT_MODEL_CHAIN) {
    try {
      const response = await client.responses.create({
        model,
        input: prompt,
        max_output_tokens: maxOutputTokens
      });
      return extractJson(response.output_text || "");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("OpenAI request failed");
}

function chunkText(text, size = 45000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function summarizeWithOpenAI({ video, channel, transcript }) {
  const chunks = chunkText(transcript, 45000);
  let workingText = transcript;

  if (chunks.length > 2) {
    const chunkNotes = [];
    for (const [index, chunk] of chunks.entries()) {
      const prompt = [
        {
          role: "system",
          content: "You extract concise, decision-useful notes from YouTube transcripts. Return strict JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Extract the strongest factual claims, mechanisms, opportunities, warnings, tools, and investment/career implications from this transcript chunk.",
            chunk: index + 1,
            totalChunks: chunks.length,
            videoTitle: video.title,
            channel: channel.name,
            allowedTopics: TOPIC_IDS,
            outputShape: {
              claims: ["short bullets"],
              alpha: ["non-obvious implications"],
              risks: ["risks or counterpoints"],
              actions: ["things to try/watch"],
              topics: ["allowed topic ids only"]
            },
            transcript: chunk
          })
        }
      ];
      const notes = await openAiJson(prompt, 1200);
      chunkNotes.push(notes);
    }
    workingText = JSON.stringify(chunkNotes);
  }

  const finalPrompt = [
    {
      role: "system",
      content: [
        "You are an analyst building a private signal dashboard.",
        "Summarize transcripts into succinct bullets for a person interested in AI, space, crypto, investing, macro, and freelance/operator relevance.",
        "Do not invent facts. Do not give personalized financial advice. Use signal language, not buy/sell commands.",
        "Return strict JSON only."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        video: {
          title: video.title,
          channel: channel.name,
          publishedAt: uploadDateToIso(video.upload_date),
          durationSeconds: video.duration,
          url: video.webpage_url || video.url
        },
        allowedTopics: TOPIC_IDS,
        outputShape: {
          tldr: "one sentence under 240 characters",
          alpha: ["3-5 non-obvious takeaways or implications"],
          bullets: ["5-8 concise bullets with the actual relevant points"],
          actions: ["1-4 things to try, monitor, or research next"],
          risks: ["1-4 counterpoints, caveats, or uncertainty flags"],
          portfolioSignal: "allocation-relevant signal in one sentence, or low direct relevance",
          careerSignal: "AI-age/freelance relevance in one sentence, or low direct relevance",
          topics: ["allowed topic ids only"],
          score: "integer 0-100 for importance to this dashboard"
        },
        transcriptOrChunkNotes: workingText
      })
    }
  ];

  const summary = await openAiJson(finalPrompt, 1700);
  return {
    ...summary,
    topics: (summary.topics || []).filter((topic) => TOPIC_IDS.includes(topic)),
    score: Number.isFinite(Number(summary.score)) ? Number(summary.score) : 50
  };
}

async function summarizeVideo({ video, channel, transcript, args }) {
  const summaryPath = path.join(summaryDir, `${video.id}.json`);
  const existing = await readJson(summaryPath);
  const currentHash = transcriptHash(transcript);
  if (existing?.transcriptHash === currentHash && existing?.summary) return existing.summary;

  const local = args.reuseLocal ? await findLocalSummary(video.id) : null;
  if (local) {
    const merged = {
      ...local,
      topics: inferTopics(channel.topics, video.title, transcript),
      score: 62
    };
    await writeJson(summaryPath, { transcriptHash: currentHash, summary: merged, source: "local-openclaw" });
    return merged;
  }

  let summary;
  if (args.noOpenAI || !process.env.OPENAI_API_KEY || transcript === "NO TRANSCRIPT AVAILABLE") {
    summary = heuristicSummary({ video, channel, transcript });
  } else {
    try {
      summary = await summarizeWithOpenAI({ video, channel, transcript });
    } catch (error) {
      summary = {
        ...heuristicSummary({ video, channel, transcript }),
        risks: [`OpenAI summary fallback: ${String(error.message || error).slice(0, 180)}`]
      };
    }
  }

  summary.topics = inferTopics(channel.topics, video.title, `${transcript} ${(summary.topics || []).join(" ")}`);
  await writeJson(summaryPath, { transcriptHash: currentHash, summary, source: args.noOpenAI ? "heuristic" : "openai-or-fallback" });
  return summary;
}

function thumbnailFromInfo(info) {
  if (info.thumbnail) return info.thumbnail;
  if (Array.isArray(info.thumbnails) && info.thumbnails.length) {
    return info.thumbnails.at(-1).url;
  }
  return `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`;
}

function makeVideoRecord({ info, channel, summary, transcript }) {
  const publishedAt = uploadDateToIso(info.upload_date);
  const topics = [...new Set([...(summary.topics || []), ...inferTopics(channel.topics, info.title, transcript)])];
  const recencyBoost = publishedAt
    ? Math.max(0, 12 - Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000) / 7)
    : 0;
  const tierBoost = channel.tier === "core" ? 5 : 0;
  const score = Math.max(0, Math.min(100, Math.round((Number(summary.score) || 50) + recencyBoost + tierBoost)));

  return {
    id: info.id,
    title: info.title,
    url: info.webpage_url || info.url || `https://www.youtube.com/watch?v=${info.id}`,
    publishedAt,
    publishedDate: dateKey(publishedAt),
    durationSeconds: info.duration || null,
    thumbnail: thumbnailFromInfo(info),
    channelId: channel.id,
    channelName: channel.name,
    channelHandle: channel.handle,
    sourceChannelId: channel.channelId,
    topics,
    score,
    transcriptStatus: transcript === "NO TRANSCRIPT AVAILABLE" ? "missing" : "available",
    summary: {
      tldr: summary.tldr || "",
      alpha: summary.alpha || [],
      bullets: summary.bullets || [],
      actions: summary.actions || [],
      risks: summary.risks || [],
      portfolioSignal: summary.portfolioSignal || "",
      careerSignal: summary.careerSignal || ""
    }
  };
}

function buildDaily({ videos, channels, config, args, coverage }) {
  const sorted = [...videos].sort((a, b) => b.score - a.score || String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const recent = videos.filter((video) => {
    if (!video.publishedAt) return false;
    const ageDays = (Date.now() - new Date(video.publishedAt).getTime()) / 86400000;
    return ageDays <= 7;
  });
  const top = sorted.slice(0, 12);
  const topicCounts = Object.fromEntries(TOPIC_IDS.map((topic) => [topic, 0]));
  for (const video of videos) {
    for (const topic of video.topics) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  }

  const activeChannels = channels.filter((channel) => channel.active);
  const investingSignals = sorted
    .filter((video) => video.topics.some((topic) => ["macro", "crypto", "investing", "space"].includes(topic)))
    .slice(0, 6)
    .map((video) => ({
      videoId: video.id,
      text: video.summary.portfolioSignal || video.summary.tldr
    }));
  const careerSignals = sorted
    .filter((video) => video.topics.some((topic) => ["ai-tools", "operator"].includes(topic)))
    .slice(0, 6)
    .map((video) => ({
      videoId: video.id,
      text: video.summary.careerSignal || video.summary.tldr
    }));

  return {
    date: new Date().toISOString().slice(0, 10),
    tldr: top.length
      ? top.slice(0, 4).map((video) => video.summary.tldr || video.title)
      : ["No processed video summaries yet."],
    mostImportant: top.slice(0, 7).map((video) => ({
      videoId: video.id,
      title: video.title,
      channelName: video.channelName,
      score: video.score,
      reason: video.summary.alpha?.[0] || video.summary.tldr
    })),
    watchItems: top
      .flatMap((video) => (video.summary.actions || []).map((text) => ({ videoId: video.id, text })))
      .slice(0, 10),
    investingSignals,
    careerSignals,
    topicPulse: TOPIC_IDS.map((topic) => ({
      id: topic,
      label: config.topics.find((item) => item.id === topic)?.label || topic,
      count: topicCounts[topic] || 0
    })),
    coverage: {
      lookbackDays: args.days,
      scanLimit: args.scanLimit,
      activeChannelCount: activeChannels.length,
      processedVideoCount: videos.length,
      recentVideoCount: recent.length,
      warnings: coverage.warnings
    }
  };
}

function warningKind(warning) {
  if (warning.includes("Sign in to confirm you’re not a bot") || warning.includes("Sign in to confirm you're not a bot")) {
    return "YouTube bot/auth challenge during metadata fetch";
  }
  if (warning.includes("This video is available to this channel's members")) {
    return "members-only video not accessible";
  }
  if (warning.includes("scan limit hit")) {
    return warning;
  }
  if (warning.includes("missing upload date")) {
    return "missing upload date";
  }
  if (warning.includes("metadata fetch failed")) {
    return "metadata fetch failed";
  }
  return warning;
}

function warningChannel(warning) {
  const prefix = warning.split(":")[0];
  return prefix.split("/")[0] || "unknown";
}

function warningExample(warning) {
  const prefix = warning.split(":")[0];
  const parts = prefix.split("/");
  return parts[1] || null;
}

function compactWarnings(warnings) {
  const groups = new Map();
  for (const warning of warnings) {
    const channel = warningChannel(warning);
    const kind = warningKind(warning);
    const key = `${channel}::${kind}`;
    const current = groups.get(key) || { channel, kind, count: 0, example: null, original: warning };
    current.count += 1;
    current.example ||= warningExample(warning);
    groups.set(key, current);
  }

  return [...groups.values()].map((group) => {
    if (group.count === 1 && group.kind === group.original) return group.original;
    const example = group.example ? `; example ${group.example}` : "";
    return `${group.channel}: ${group.kind} (${group.count} item${group.count === 1 ? "" : "s"}${example})`;
  });
}

async function ingest() {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs();

  const config = await readJson(channelsPath);
  if (!config) throw new Error(`Missing channel registry at ${channelsPath}`);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - args.days);
  cutoff.setUTCHours(0, 0, 0, 0);

  const channels = config.channels
    .filter((channel) => args.includeScout ? true : channel.active)
    .filter((channel) => args.channel ? [channel.id, channel.handle, channel.name].includes(args.channel) : true);

  const existing = args.mergeExisting ? await readJson(signalPath) : null;
  const existingVideoById = new Map((existing?.videos || []).map((video) => [video.id, video]));
  const videos = [];
  const coverage = { warnings: [], channels: [] };

  for (const channel of channels) {
    console.log(`\n== ${channel.name} (${channel.handle}) ==`);
    const { entries, error, source, limited } = await discoverUploads(channel, args);
    if (error) {
      coverage.warnings.push(`${channel.name}: ${error}`);
      continue;
    }
    console.log(`  discovery: ${source}`);

    let accepted = 0;
    let reachedOlder = false;
    for (const entry of entries) {
      if (args.limitPerChannel && accepted >= args.limitPerChannel) break;
      if (!entry.id) continue;

      const knownVideo = existingVideoById.get(entry.id);
      if (!args.metadataOnly && knownVideo?.summary?.tldr) {
        if (knownVideo.publishedAt && new Date(knownVideo.publishedAt) < cutoff) {
          reachedOlder = true;
          break;
        }
        accepted += 1;
        console.log(`  ${accepted}. ${knownVideo.publishedDate || "known"} ${knownVideo.title}`);
        console.log("     reused committed summary");
        videos.push(knownVideo);
        continue;
      }

      const info = await fetchVideoInfo(entry);
      if (info.error) {
        coverage.warnings.push(`${channel.name}/${entry.id}: ${info.error}`);
        continue;
      }
      if (info.metadataWarning) {
        coverage.warnings.push(`${channel.name}/${entry.id}: ${info.metadataWarning}`);
      }

      const publishedAt = uploadDateToIso(info.upload_date);
      if (publishedAt && new Date(publishedAt) < cutoff) {
        reachedOlder = true;
        break;
      }
      if (!publishedAt) {
        coverage.warnings.push(`${channel.name}/${entry.id}: missing upload date`);
      }

      accepted += 1;
      console.log(`  ${accepted}. ${info.upload_date || "unknown"} ${info.title}`);

      const existingVideo = existingVideoById.get(info.id);
      if (!args.metadataOnly && existingVideo?.summary?.tldr) {
        videos.push(existingVideo);
        console.log("     reused committed summary");
        continue;
      }

      let transcript = "NO TRANSCRIPT AVAILABLE";
      let summary = heuristicSummary({ video: info, channel, transcript });

      if (!args.metadataOnly) {
        transcript = await getTranscript(info, args.reuseLocal);
        summary = await summarizeVideo({ video: info, channel, transcript, args });
      }

      videos.push(makeVideoRecord({ info, channel, summary, transcript }));
    }

    if (limited && !reachedOlder && entries.length >= args.scanLimit) {
      coverage.warnings.push(`${channel.name}: scan limit hit before an older-than-cutoff video; increase --scan-limit for strict completeness.`);
    }
    coverage.channels.push({ id: channel.id, found: entries.length, accepted, reachedOlder, discovery: source });
  }

  const freshVideos = [...new Map(videos.map((video) => [video.id, video])).values()]
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const existingVideos = (existing?.videos || []).filter((video) => {
    if (!video.publishedAt) return true;
    return new Date(video.publishedAt) >= cutoff;
  });
  const uniqueVideos = [...new Map([...existingVideos, ...freshVideos].map((video) => [video.id, video])).values()]
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  coverage.warnings = compactWarnings(coverage.warnings);

  const output = {
    generatedAt: new Date().toISOString(),
    cutoff: cutoff.toISOString(),
    source: {
      type: "youtube-transcript-ingest",
      registry: "data/channels.json",
      discovery: args.discovery,
      transcriptCache: ".cache/youtube/transcripts",
      summaryCache: "public/data/signal.json plus .cache/youtube/summaries"
    },
    strategy: config.strategy,
    topics: config.topics,
    channels: config.channels,
    daily: buildDaily({ videos: uniqueVideos, channels: config.channels, config, args, coverage }),
    videos: uniqueVideos,
    coverage
  };

  await writeJson(signalPath, output);
  console.log(`\nWrote ${uniqueVideos.length} videos to ${signalPath}`);
  if (coverage.warnings.length) {
    console.log("\nCoverage warnings:");
    for (const warning of coverage.warnings) console.log(`- ${warning}`);
  }
}

ingest().catch((error) => {
  console.error(error);
  process.exit(1);
});
