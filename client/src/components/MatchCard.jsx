import { useState } from "react";
import { Brain, ThumbsUp, ThumbsDown } from "lucide-react";
import { sendRecallFeedback } from "../memories";

export default function MatchCard({ match }) {
  const [feedback, setFeedback] = useState(null);
  const percent = Math.round(match.similarityScore * 100);

  const matchColor =
    percent >= 85 ? "var(--success)" :
    percent >= 60 ? "var(--warn)" :
    "var(--text-dim)";

  const sendFeedback = async (value) => { setFeedback(value); try { await sendRecallFeedback(match.id, value); } catch { setFeedback(null); } };

  return (
    <div className="card" style={{ padding: "1.75rem", border: "1px solid rgba(147, 51, 234, 0.3)" }}>
      {/* Header with confidence pill */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Brain size={20} color="var(--accent-hover)" />
            <span style={{ fontWeight: 600, fontSize: 15 }}>We found something familiar</span>
        </div>
        <span style={{
            fontSize: 12, fontWeight: 700,
            padding: "5px 12px",
            background: percent >= 85 ? "var(--success-soft)" : "var(--warn-soft)",
            color: percent >= 85 ? "var(--success)" : "var(--warn)",
            border: `1px solid ${percent >= 85 ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.2)"}`,
            borderRadius: 999,
        }}>
            {percent}% Relevant Match
        </span>
        </div>

      {/* Personality line */}
      <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "4px 0 18px" }}>
        Wait... you've been here before. 👀
      </p>

      {/* Big match percentage */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{
          fontSize: "2.75rem",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: matchColor,
        }}>
          {percent}%
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: matchColor,
          letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          Match
        </span>
      </div>

      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 20 }}>
        {percent}% similar to a mistake you recorded {match.timeAgo || "a while back"}.
      </p>

      {/* Previous mistake box */}
      <div style={{
        background: "var(--input-bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "1.1rem",
        marginBottom: 16,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 12, fontWeight: 700, color: "var(--text-faint)",
          textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--danger)" }} />
          Previous Mistake
        </div>

        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>{match.title}</p>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-faint)", marginBottom: 4 }}>
            Root cause
          </div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-dim)" }}>{match.context}</p>
        </div>

        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600, color: "var(--success)", marginBottom: 4,
          }}>
            ✅ What fixed it
          </div>
          <p style={{ margin: 0, fontSize: 14 }}>{match.solution}</p>
        </div>
      </div>

      {/* Why this matches */}
      {match.explanation && (
        <div style={{
          background: "var(--accent-soft)",
          borderRadius: 10,
          padding: "0.9rem 1.1rem",
          marginBottom: 16,
          fontSize: 14,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            💡 Why this matches
          </div>
          <p style={{ margin: 0, color: "var(--text-dim)" }}>{match.explanation}</p>
        </div>
      )}

      {/* Feedback */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        borderTop: "1px solid var(--border)", paddingTop: 14,
      }}>
        <span style={{ fontSize: 13, color: "var(--text-faint)", marginRight: 4 }}>Was this helpful?</span>
        <button
          className={feedback === true ? "" : "secondary"}
          onClick={() => sendFeedback(true)}
          disabled={feedback !== null}
        >
          <ThumbsUp size={14} /> Helpful
        </button>
        <button
          className={feedback === false ? "danger" : "secondary"}
          onClick={() => sendFeedback(false)}
          disabled={feedback !== null}
        >
          <ThumbsDown size={14} /> Not Relevant
        </button>
        {feedback !== null && (
          <span style={{ color: "var(--text-faint)", fontSize: 13 }}>Thanks!</span>
        )}
      </div>
    </div>
  );
}
