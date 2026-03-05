import Head from "next/head";
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

  const canGenerate = useMemo(() => topic.trim().length > 3 && !loading, [topic, loading]);

  function toggleStyle(s: Style) {
    setStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
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
    <>
      <Head>
        <title>Viral Hook Generator</title>
      </Head>

      <div className="page">
        <div className="hero">
          <div className="logo">LYV LOUD</div>
          <h1>Viral Hook Generator</h1>
          <p>
            Hooks optimized for short-form video. Fast to speak. Built to stop the
            scroll.
          </p>
        </div>

        <div className="card">
          <div className="controls">
            <div className="row">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Topic</label>
                <textarea
                  className="input"
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="ex: indie single dropping Friday; theme: heartbreak but hopeful"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>Platform</label>
                <select
                  className="input"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Creator lane</label>
                <select className="input" value={lane} onChange={(e) => setLane(e.target.value as Lane)}>
                  {LANES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Count</label>
                <input
                  className="input"
                  type="number"
                  value={count}
                  min={10}
                  max={50}
                  onChange={(e) => setCount(parseInt(e.target.value || "25", 10))}
                />
              </div>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Hook styles (tap to toggle)</label>
              <div className="pills">
                {STYLES.map((s) => {
                  const on = styles.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStyle(s)}
                      className={`pill ${on ? "pillOn" : "pillOff"}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <button className="primary" onClick={generate} disabled={!canGenerate}>
              {loading ? "Generating…" : "Generate Hooks"}
            </button>

            {error && <div className="error">{error}</div>}

            {hooks.length > 0 && (
              <section className="results" style={{ gridColumn: "1 / -1" }}>
                <div className="resultsHead">
                  <h2>Results</h2>
                  <div className="row">
                    <button className="copyBtn" onClick={copyAll}>
                      Copy all
                    </button>
                    <button className="copyBtn" onClick={generate}>
                      Regenerate
                    </button>
                  </div>
                </div>

                <ol className="list">
                  {hooks.map((h, i) => (
                    <li key={i}>
                      <div className="hookRow">
                        <span style={{ flex: 1 }}>{h}</span>
                        <button className="copyBtn" onClick={() => copyOne(h)}>
                          Copy
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>

        <footer>
          Next step: add saves/collections + preset hook packs per lane.
        </footer>
      </div>
    </>
  );
}
