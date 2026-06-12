import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

const root = process.cwd();
const signalPath = path.join(root, "public", "data", "signal.json");
const TOPICS = ["ai-tools", "operator", "macro", "crypto", "investing", "space"];

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found");
  return JSON.parse(text.slice(start, end + 1));
}

function topicLabel(data, id) {
  return data.topics.find((topic) => topic.id === id)?.label || id;
}

function compactVideo(video) {
  return {
    id: video.id,
    title: video.title,
    channel: video.channelName,
    date: video.publishedDate,
    score: video.score,
    topics: video.topics,
    tldr: video.summary?.tldr,
    alpha: (video.summary?.alpha || []).slice(0, 3),
    portfolioSignal: video.summary?.portfolioSignal,
    careerSignal: video.summary?.careerSignal
  };
}

function fallbackNarratives(data) {
  const groups = [
    {
      id: "ai-agent-operating-stack",
      title: "Agentic work is moving from prompts to managed operating systems",
      topics: ["ai-tools", "operator"],
      keywords: ["agent", "workflow", "codex", "claude", "openclaw", "cursor"],
      implication: "Freelance advantage shifts toward designing, supervising, and instrumenting agent loops rather than writing isolated prompts."
    },
    {
      id: "ai-infrastructure-capex",
      title: "AI infrastructure remains the bridge between career signal and portfolio signal",
      topics: ["ai-tools", "investing", "macro"],
      keywords: ["nvidia", "dell", "memory", "capex", "energy", "compute", "gpu"],
      implication: "The investable layer is increasingly power, memory, chips, data centers, and workflow software, not only model labs."
    },
    {
      id: "crypto-market-structure",
      title: "Crypto is being absorbed by market structure, regulation, and TradFi rails",
      topics: ["crypto", "macro", "investing"],
      keywords: ["clarity", "stablecoin", "tradfi", "blackrock", "etf", "bank", "tokenized"],
      implication: "Quarterly crypto posture should track regulation, custody, liquidity, and institutional access as much as token narratives."
    },
    {
      id: "bitcoin-cycle-risk",
      title: "Bitcoin risk signals are clustered around bear-market bands and liquidity regime",
      topics: ["crypto", "macro", "investing"],
      keywords: ["bitcoin", "bear market", "resistance", "cycle", "liquidity", "gold"],
      implication: "The dashboard should separate accumulation evidence from repeated fear/greed narratives before any rebalance."
    },
    {
      id: "space-commercialization",
      title: "Space signal is converging around Starship cadence and private-market access",
      topics: ["space", "investing"],
      keywords: ["spacex", "starship", "artemis", "space", "rocket", "satellite"],
      implication: "Space remains more thesis/watchlist than liquid allocation, but launch cadence and satellite infrastructure deserve monitoring."
    }
  ];

  return groups.map((group) => {
    const evidence = data.videos
      .filter((video) => group.topics.some((topic) => video.topics?.includes(topic)))
      .filter((video) => group.keywords.some((keyword) => `${video.title} ${video.summary?.tldr}`.toLowerCase().includes(keyword)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return {
      id: group.id,
      title: group.title,
      summary: group.implication,
      topics: group.topics,
      strength: Math.min(100, Math.max(45, Math.round(evidence.reduce((sum, video) => sum + video.score, 0) / Math.max(1, evidence.length)))),
      momentum: evidence.some((video) => new Date(video.publishedAt) > new Date(Date.now() - 14 * 86400000)) ? "active" : "watching",
      whyItMatters: group.implication,
      watchNext: [
        "Look for the same claim repeated by at least two independent source types.",
        "Promote to action only when it changes a portfolio, workflow, or business decision."
      ],
      evidence: evidence.map((video) => video.id)
    };
  });
}

async function synthesizeWithOpenAI(data) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

  const videos = data.videos
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 220)
    .map(compactVideo);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = [
    {
      role: "system",
      content: [
        "You are the CEO/analyst of a private signal dashboard.",
        "Find cross-video narratives that matter for investing and AI-age career relevance.",
        "Return strict JSON only. Do not invent evidence; cite video ids from the provided list.",
        "Use sober language. This is not financial advice."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Synthesize this YouTube summary database into the ongoing narrative layer for a private signal dashboard.",
        goals: data.strategy?.purpose,
        allowedTopics: TOPICS,
        outputShape: {
          executiveBrief: ["5-8 bullets for today's top synthesis"],
          narratives: [
            {
              id: "kebab-case",
              title: "short narrative name",
              summary: "2 sentence synthesis",
              topics: ["allowed topic ids"],
              strength: "0-100 integer",
              momentum: "emerging | active | crowded | fading | watching",
              whyItMatters: "portfolio/career/business implication",
              watchNext: ["2-4 concrete things to monitor"],
              evidence: ["video ids from provided videos"]
            }
          ],
          rebalanceWatch: ["portfolio items to watch before quarterly rebalance"],
          careerWatch: ["tools/skills/business ideas to evaluate"]
        },
        videos
      })
    }
  ];

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: prompt,
    max_output_tokens: 5000
  });
  return extractJson(response.output_text || "");
}

async function main() {
  const data = JSON.parse(await fs.readFile(signalPath, "utf8"));
  let synthesis;

  try {
    synthesis = await synthesizeWithOpenAI(data);
  } catch (error) {
    const narratives = fallbackNarratives(data);
    synthesis = {
      executiveBrief: [
        "Agentic workflow skill remains the strongest recurring career signal.",
        "AI infrastructure and energy/memory constraints are the bridge between AI relevance and investment theses.",
        "Crypto signal is dominated by regulation, institutional rails, stablecoins, security, and Bitcoin cycle risk.",
        "Space signal is strongest around Starship cadence, Artemis tradeoffs, and private-market access."
      ],
      narratives,
      rebalanceWatch: narratives
        .filter((item) => item.topics.some((topic) => ["macro", "crypto", "investing", "space"].includes(topic)))
        .map((item) => item.whyItMatters),
      careerWatch: narratives
        .filter((item) => item.topics.some((topic) => ["ai-tools", "operator"].includes(topic)))
        .map((item) => item.whyItMatters),
      fallbackReason: String(error.message || error)
    };
  }

  data.synthesis = {
    generatedAt: new Date().toISOString(),
    ...synthesis,
    narratives: (synthesis.narratives || []).map((narrative) => ({
      ...narrative,
      topics: (narrative.topics || []).filter((topic) => TOPICS.includes(topic)),
      evidence: (narrative.evidence || []).filter((id) => data.videos.some((video) => video.id === id)).slice(0, 10),
      strength: Math.max(0, Math.min(100, Number(narrative.strength) || 50))
    }))
  };

  data.daily = {
    ...data.daily,
    synthesis: data.synthesis.executiveBrief || [],
    rebalanceWatch: data.synthesis.rebalanceWatch || [],
    careerWatch: data.synthesis.careerWatch || []
  };

  await fs.writeFile(signalPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote synthesis: ${data.synthesis.narratives.length} narratives`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
