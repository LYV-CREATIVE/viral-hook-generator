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
  count?: number; // default 25
};

function buildPrompt(p: Payload) {
  const count = Math.min(Math.max(p.count ?? 25, 10), 50);
  const styles = (p.styles ?? []).slice(0, 6);
  const styleLine = styles.length ? `Prioritize these hook styles: ${styles.join(", ")}.` : "";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as Payload;

    if (!body?.topic || !body?.platform || !body?.lane) {
      res
        .status(400)
        .json({ error: "Missing required fields: topic, platform, lane" });
      return;
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: buildPrompt(body),
    });

    const text = response.output_text?.trim() ?? "";

    let hooks = parseHooksFromText(text)
      .map((h) => h.replace(/^"+|"+$/g, "").trim())
      .filter(Boolean)
      .slice(0, Math.min(body.count ?? 25, 50));

    res.status(200).json({ hooks });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
