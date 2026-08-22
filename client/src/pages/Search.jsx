import { useState } from "react";
import { Brain, Sparkles, WandSparkles } from "lucide-react";
import MatchCard from "../components/MatchCard";
import { recallMemories } from "../memories";

export default function Search() {
  const [problem, setProblem] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const quickPrompts = ["pythonn authentication", "React state not updating", "Git dependency conflict"];
  const handleRecall = async () => {
    setLoading(true); setSearched(true); setMatches([]); setError("");
    try {
      setMatches(await recallMemories(problem));
    } catch {
      setError("We couldn't search your lessons right now. Please try again.");
    } finally { setLoading(false); }
  };
  return <div className="page">
    <div className="page-intro search-intro"><p className="eyebrow">RECALL MODE</p><h2 className="gradient-text">Your past self<br />has the answer.</h2><p>Describe the problem in front of you. We&apos;ll surface lessons from the problems you&apos;ve already solved.</p></div>
    <div className="card search-card"><div className="search-card-top"><div className="search-icon"><Brain size={20} /></div><span><Sparkles size={14} /> Smart recall</span></div><textarea aria-label="Current problem" placeholder="e.g. My API keeps returning 401 after login..." value={problem} onChange={(event) => setProblem(event.target.value)} rows={4} style={{ marginBottom: 12 }} /><p className="search-hint">Typo-tolerant recall is on — “pythonn” can still find “python”.</p><div className="quick-prompts"><span>Try one:</span>{quickPrompts.map((prompt) => <button key={prompt} className="prompt-chip" onClick={() => { setProblem(prompt); setSearched(false); }}>{prompt}</button>)}</div><button className="primary-action" onClick={handleRecall} disabled={loading || !problem.trim()}><WandSparkles size={16} />{loading ? "Recalling..." : "Find relevant lessons"}</button></div>
    <div style={{ marginTop: "1.25rem" }}>
      {loading && <div className="skeleton" />}
      {error && <div className="empty-state">{error}</div>}
      {searched && !loading && matches.length === 0 && <div className="empty-state">No familiar mistakes yet.<br />Looks like you&apos;re breaking new ground.</div>}
      {!loading && matches.map((match) => <MatchCard key={match.id} match={match} />)}
    </div>
  </div>;
}
