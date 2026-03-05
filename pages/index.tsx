import { useMemo, useState } from "react";

const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts"] as const;
type Platform = (typeof PLATFORMS)[number];

const LANES = ["Music Artist", "All Creators"] as const;
type Lane = (typeof LANES)[number];

const STYLES = [
  "Curiosity",
  "Hot Take",
  "Confession",
  "Micro-Story",
  "Mistake",
  "Challenge",
  "List Hook",
] as const;

type Style = (typeof STYLES)[number];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<Platform>("TikTok");
  const [lane, setLane] = useState<Lane>("Music Artist");
  const [count, setCount] = useState(25);
  const [styles, setStyles] = useState<Style[]>(["Curiosity", "Confession"]);

  const [loading, setLoading] = useState(false);
  const [hooks, setHooks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = useMemo(
    () => topic.trim().length > 3 && !loading,
    [topic, loading]
  );

  function toggleStyle(s: Style) {
    setStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setHooks([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, platform, lane, styles, count }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      setHooks(Array.isArray(data.hooks) ? data.hooks : []);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    navigator.clipboard.writeText(hooks.map((h) => `• ${h}`).join("\n"));
  }

  function copyOne(h: string) {
    navigator.clipboard.writeText(h);
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 34, marginBottom: 6 }}>Viral Hook Generator</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Creator lanes + short-form constraints = hooks that don’t sound like AI.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <label>
          Topic
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='e.g., "indie single dropping Friday—heartbreak but hopeful"'
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Platform
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label>
            Creator Lane
            <select
              value={lane}
              onChange={(e) => setLane(e.target.value as Lane)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            >
              {LANES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              Hook Styles (tap to toggle)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {STYLES.map((s) => {
                const on = styles.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    style={{
                      padding: "8px 10px",
                      cursor: "pointer",
                      fontWeight: 700,
                      opacity: on ? 1 : 0.55,
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <label>
            Count
            <input
              type="number"
              value={count}
              min={10}
              max={50}
              onChange={(e) => setCount(parseInt(e.target.value || "25", 10))}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <button
          onClick={generate}
          disabled={!canGenerate}
          style={{ padding: 12, fontWeight: 800, cursor: canGenerate ? "pointer" : "not-allowed" }}
        >
          {loading ? "Generating..." : "Generate Hooks"}
        </button>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        {hooks.length > 0 && (
          <section style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Results</h2>
              <button onClick={copyAll} style={{ padding: "8px 10px", cursor: "pointer" }}>
                Copy All
              </button>
              <button onClick={generate} style={{ padding: "8px 10px", cursor: "pointer" }}>
                Regenerate
              </button>
            </div>

            <ol style={{ marginTop: 12, lineHeight: 1.7 }}>
              {hooks.map((h, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ flex: 1 }}>{h}</span>
                  <button
                    onClick={() => copyOne(h)}
                    style={{ padding: "6px 8px", cursor: "pointer" }}
                  >
                    Copy
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
