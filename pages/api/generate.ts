import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

type Lane = "Music Artist" | "All Creators";
type Platform = "TikTok" | "Instagram Reels" | "YouTube Shorts";

type Payload = {
  topic: string;
  platform: Platform;
  lane: Lane;
  styles?: string[];
  count?: number; // default 10
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 8000;

const lastRequestByIp = new Map<string, number>();
const cache = new Map<string, { hooks: string[]; expires: number }>();

function buildPrompt(p: Payload) {
  const count = Math.min(Math.max(p.count ?? 10, 10), 25);
  const styles = (p.styles ?? []).slice(0, 6);
  const styleLine = styles.length
    ? `Prioritize these hook styles: ${styles.join(", ")}.`
    : "";

  const laneRules =
    p.lane === "Music Artist"
      ? `
You are writing for an indie music artist promoting a new SINGLE dropping Friday.
Hooks should feel authentic, artist-led, and fan-facing. Avoid corporate marketing language.
Encourage saves/presaves/first-listen without sounding like an ad.
`
      : `
You are writing for creators (general). Keep examples platform-native and broadly relatable.
`;

  return `
You are a world-class short-form video hook writer.

Goal:
Generate ${count} hooks optimized for ${p.platform}.

Hard constraints:
- Each hook is 6–12 words (tight, spoken aloud in ~1 second).
- No emojis. No hashtags. No quotes around the hook.
- No generic fluff (e.g., "game changer", "unlock your potential").
- Make them scroll-stopping: high contrast, clear promise, curiosity gap.
- Vary patterns heavily; do NOT repeat the same structure.

${laneRules}
${styleLine}

Topic: ${p.topic}

Return ONLY valid JSON:
{"hooks": ["hook 1", "hook 2", ...]}
`.trim();
}

function parseHooksFromText(text: string): string[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.hooks)) return parsed.hooks;
  } catch {
    // ignore
  }

  return text
    .split("\n")
    .map((l) => l.replace(/^\d+[\).\s-]+/, "").trim())
    .filter(Boolean);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAIWithRetry(client: OpenAI, prompt: string, maxRetries = 3) {
  let delay = 1200;
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.responses.create({
        model: "gpt-4.1-mini",
        input: prompt,
        max_output_tokens: 300,
      });
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const message = String(err?.message ?? "");
      const is429 = status === 429 || message.includes("429");
      if (!is429 || attempt >= maxRetries) throw err;
      await sleep(delay);
      delay = Math.min(delay * 2, 15000);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as Payload;

    if (!body?.topic || !body?.platform || !body?.lane) {
      res.status(400).json({ error: "Missing required fields: topic, platform, lane" });
      return;
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string | undefined) ||
      req.socket.remoteAddress ||
      "anon";

    const now = Date.now();
    const last = lastRequestByIp.get(ip) ?? 0;
    if (now - last < REQUEST_COOLDOWN_MS) {
      const waitSec = Math.ceil((REQUEST_COOLDOWN_MS - (now - last)) / 1000);
      res.status(429).json({ error: `Slow down: wait ${waitSec}s before generating again.` });
      return;
    }
    lastRequestByIp.set(ip, now);

    const styles = (body.styles ?? []).slice(0, 6);
    const count = Math.min(Math.max(body.count ?? 10, 10), 25);

    const cacheKey = JSON.stringify({
      topic: body.topic.trim().toLowerCase(),
      platform: body.platform,
      lane: body.lane,
      count,
      styles: [...styles].sort().join("|")
    });

    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now) {
      res.status(200).json({ hooks: cached.hooks });
      return;
    }

    const response = await callOpenAIWithRetry(client, buildPrompt({ ...body, styles, count }));
    const text = response.output_text?.trim() ?? "";

    const hooks = parseHooksFromText(text)
      .map((h) => h.replace(/^\"+|\"+$/g, "").trim())
      .filter(Boolean)
      .slice(0, count);

    cache.set(cacheKey, { hooks, expires: Date.now() + CACHE_TTL_MS });
    res.status(200).json({ hooks });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
