import { useEffect, useState } from "react";
import { CheckCircle2, CircleDot, Lightbulb, Save, Sparkles, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Toast from "../components/Toast";
import { addMemory, assistCapture, evaluateSolution, extractRawError } from "../memories";

export default function AddMemory() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", mistake: "", context: "", solution: "", tags: "", severity: "yellow" });
  const [status, setStatus] = useState(null);
  const [toast, setToast] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [assistNote, setAssistNote] = useState("");
  const [severityRecommendation, setSeverityRecommendation] = useState(null);
  const [quality, setQuality] = useState(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [captureMode, setCaptureMode] = useState("guided");
  const [rawError, setRawError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const problemReady = form.mistake.trim().length >= 8;
  const solutionReady = form.solution.trim().length >= 8;
  const canAssessQuality = problemReady && solutionReady;
  useEffect(() => {
    if (!canAssessQuality) return undefined;
    const timeout = setTimeout(async () => {
      setQualityLoading(true);
      try { setQuality(await evaluateSolution({ mistake: form.mistake, context: form.context, solution: form.solution })); } finally { setQualityLoading(false); }
    }, 650);
    return () => clearTimeout(timeout);
  }, [canAssessQuality, form.mistake, form.context, form.solution]);
  const showToast = (message) => { setToast(message); setTimeout(() => setToast(""), 2000); };
  const change = (event) => { setForm({ ...form, [event.target.name]: event.target.value }); if (event.target.name === "severity") setSeverityRecommendation(null); };
  const handleAssist = async () => {
    setAssisting(true); setAssistNote("");
    try {
      const suggestion = await assistCapture(form);
      setForm((current) => {
        const existingTags = current.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
        const aiTags = Array.isArray(suggestion.tags) ? suggestion.tags : [];
        const tags = [...new Map([...existingTags, ...aiTags].map((tag) => [tag.toLowerCase(), tag])).values()].slice(0, 5);
        return { ...current, title: current.title || suggestion.title, tags: tags.join(", "), severity: suggestion.severity || current.severity };
      });
      setSeverityRecommendation({ severity: suggestion.severity, source: suggestion.source });
      setAssistNote(`${suggestion.source === "AI" ? "AI" : "Smart suggestions"} added ${suggestion.tags?.length || 0} topic tag${suggestion.tags?.length === 1 ? "" : "s"}, plus a title and recurrence recommendation. Review before saving.`);
    } catch (error) { setAssistNote(error.message || "AI suggestions are unavailable right now."); }
    finally { setAssisting(false); }
  };
  const handleExtract = async () => {
    setExtracting(true); setAssistNote("");
    try {
      const extracted = await extractRawError(rawError);
      setForm((current) => ({ ...current, title: current.title || extracted.title, mistake: current.mistake || extracted.mistake, context: current.context || extracted.context, solution: current.solution || extracted.solution, tags: current.tags || extracted.tags.join(", "), severity: extracted.severity || current.severity }));
      setSeverityRecommendation({ severity: extracted.severity, source: extracted.source });
      setCaptureMode("guided");
      setAssistNote(`${extracted.source === "AI" ? "AI" : "Smart extraction"} filled the lesson fields. Verify the proposed fix before saving.`);
    } catch (error) { setAssistNote(error.message || "Could not extract this error."); }
    finally { setExtracting(false); }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("saving");
    try {
      await addMemory({ ...form, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) });
      setStatus("saved");
      showToast("Memory saved");
      setTimeout(() => navigate("/"), 500);
    } catch { setStatus("error"); }
  };
  const qualityState = !problemReady ? { state: "is-idle", label: "Start with the problem", detail: "Describe what happened first. The coach will then judge whether your fix actually addresses it.", value: 0, icon: CircleDot } : !solutionReady ? { state: "is-building", label: "Now add your proposed fix", detail: "Tell us exactly what you changed or would try. Avoid vague fixes like “fixed it”.", value: 34, icon: Lightbulb } : qualityLoading ? { state: "is-checking", label: "Reviewing the connection", detail: "Comparing the problem, context, and solution for relevance and specificity.", value: 72, icon: Sparkles } : { state: quality?.score < 50 ? "needs-work" : "is-ready", label: quality?.score < 50 ? "Needs a more specific fix" : "Strong reusable lesson", detail: quality?.suggestion || "Reviewing your solution.", value: quality?.score || 0, icon: Target };
  const QualityIcon = qualityState.icon;
  return <div className="page">
    <div className="page-intro"><p className="eyebrow">CAPTURE THE LESSON</p><h2 className="gradient-text">Make this mistake<br />your last time.</h2><p>Your future self only needs enough context to recognize the problem—and the fix.</p></div>
    <section className={`capture-progress ${qualityState.state}`} aria-live="polite"><div className="quality-orb"><QualityIcon size={18} /></div><div className="quality-copy"><span>SOLUTION COACH</span><strong>{qualityState.label}</strong><p>{qualityState.detail}</p></div><div className="quality-score"><strong>{canAssessQuality && !qualityLoading && quality ? `${qualityState.value}%` : "—"}</strong><span>quality</span></div><div className="capture-progress-track"><span style={{ width: `${qualityState.value}%` }} /></div></section>
    <div className="card capture-card"><div className="capture-tabs" role="tablist" aria-label="Capture method"><button type="button" role="tab" aria-selected={captureMode === "guided"} className={captureMode === "guided" ? "is-active" : ""} onClick={() => setCaptureMode("guided")}>Guided capture</button><button type="button" role="tab" aria-selected={captureMode === "raw"} className={captureMode === "raw" ? "is-active" : ""} onClick={() => setCaptureMode("raw")}><Sparkles size={14} /> Paste raw error</button></div>{captureMode === "raw" && <section className="raw-extract"><div><p className="eyebrow">AI SMART EXTRACTION</p><h3>Turn terminal noise into a useful lesson.</h3><p>Paste a stack trace, API response, or console output. We’ll structure it without losing the original details.</p></div><textarea value={rawError} onChange={(event) => setRawError(event.target.value)} placeholder={'Error: 401 Unauthorized\nTraceback (most recent call last):\n...'} rows={8} /><button type="button" onClick={handleExtract} disabled={extracting || rawError.trim().length < 6}><Sparkles size={15} />{extracting ? "Extracting…" : "Extract structured lesson"}</button></section>}<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="form-section"><div className="field-label"><label>Title</label><span>01</span></div><input name="title" placeholder="Short summary of the lesson" value={form.title} onChange={change} required /></div>
      <div className="form-section"><div className="field-label"><label>What happened?</label><span>02</span></div><textarea name="mistake" placeholder="Describe the exact issue or moment that went wrong" value={form.mistake} onChange={change} required rows={3} /><small>Be concrete: what failed, where, and under what condition?</small></div>
      <div className="form-section"><div className="field-label"><label>Why did it happen?</label><span>03 · optional</span></div><textarea name="context" placeholder="Root cause, trigger, or relevant context" value={form.context} onChange={change} rows={2} /></div>
      <div className="form-section"><div className="field-label"><label>How did you fix it?</label><span>04</span></div><textarea name="solution" placeholder="State the exact change and how you verified it worked" value={form.solution} onChange={change} required rows={3} /><small>A strong fix includes the action, why it worked, and the check you ran.</small></div>
      <div className="assist-row"><div><p className="assist-label"><Sparkles size={15} /> AI memory organizer</p><p>Turn your note into a cleaner title, tags, and recurrence signal.</p></div><button className="secondary" type="button" onClick={handleAssist} disabled={assisting}><Sparkles size={15} />{assisting ? "Organizing…" : "Organize with AI"}</button></div>
      {assistNote && <p className="assist-note">{assistNote}</p>}
      <div><label>Tags</label><input name="tags" placeholder="e.g. react, api, auth" value={form.tags} onChange={change} /></div>
      <div className="form-section recurrence-section"><div className="field-label"><label htmlFor="severity">How likely is this to repeat?</label><span>AI-ASSISTED</span></div><p className="recurrence-copy">This helps the memory layer decide what to surface proactively.</p><div className="severity-options" role="radiogroup" aria-label="How likely this lesson is to repeat">{[{ value: "green", title: "Low", copy: "One-off lesson" }, { value: "yellow", title: "Medium", copy: "Worth remembering" }, { value: "red", title: "High", copy: "Recurring risk" }].map((option) => <button key={option.value} type="button" role="radio" aria-checked={form.severity === option.value} className={`severity-option ${option.value} ${form.severity === option.value ? "is-selected" : ""}`} onClick={() => { setForm((current) => ({ ...current, severity: option.value })); setSeverityRecommendation(null); }}><span className="severity-dot" /><b>{option.title}</b><small>{option.copy}</small></button>)}</div><select id="severity" name="severity" value={form.severity} onChange={change} className="visually-hidden"><option value="green">Low — a one-off lesson</option><option value="yellow">Medium — worth remembering</option><option value="red">High — a recurring risk</option></select>{severityRecommendation && <p className="severity-recommendation"><Sparkles size={14} />{severityRecommendation.source === "AI" ? "AI" : "Smart analysis"} recommends <b>{severityRecommendation.severity === "red" ? "High recurrence risk" : severityRecommendation.severity === "green" ? "Low recurrence risk" : "Medium recurrence risk"}</b> based on the lesson context.</p>}</div>
      <button className="primary-action" type="submit" disabled={status === "saving"}><Save size={16} />{status === "saving" ? "Saving..." : "Save this lesson"}{quality?.score >= 70 && <CheckCircle2 size={16} />}</button>
      {status === "error" && <p style={{ color: "var(--danger)", fontSize: 14 }}>Could not save this memory. Please try again.</p>}
    </form></div><Toast message={toast} show={!!toast} />
  </div>;
}
