// In development Vite proxies this path to the local API. In production it can
// point at a deployed API through VITE_API_URL, without requiring a rebuild for
// a particular localhost port.
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const STORAGE_KEY = "mistake-memo-memories";

const starterMemories = [
  { id: "seed-auth", title: "Python API Authentication", mistake: "Requests began failing after an access token expired.", context: "The client did not refresh its bearer token before protected requests.", solution: "Added token refresh logic and retried the original request.", tags: ["python", "api", "auth"], severity: "red", createdAt: "2026-06-22T00:00:00.000Z" },
  { id: "seed-react", title: "React state not updating", mistake: "Read state immediately after calling setState.", context: "React batches state updates, so the old value was still in scope.", solution: "Used a functional update and reacted to the change in useEffect.", tags: ["react", "state"], severity: "yellow", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "seed-git", title: "Git merge conflict", mistake: "A dependency lockfile conflicted after merging branches.", context: "Both branches changed the generated lockfile.", solution: "Resolved the source changes, regenerated the lockfile, and tested the install.", tags: ["git", "dependencies"], severity: "green", createdAt: "2026-08-15T00:00:00.000Z" }
];

function localMemories() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(starterMemories));
  } catch { /* Browser storage is optional. */ }
  return starterMemories;
}
function saveLocal(memories) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memories)); } catch { /* no-op */ } return memories; }
async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API request failed (${response.status})`);
  }
  return response.json();
}

export async function getMemories() {
  try { const { memories } = await request("/memories"); return saveLocal(memories); }
  catch { return localMemories(); }
}
export async function addMemory(memory) {
  const fallback = { ...memory, id: crypto.randomUUID(), severity: "yellow", createdAt: new Date().toISOString() };
  try { const { memory: saved } = await request("/memories", { method: "POST", body: JSON.stringify(memory) }); return saved; }
  catch { saveLocal([fallback, ...localMemories()]); return fallback; }
}
export async function updateMemory(id, changes) {
  try { const { memory } = await request(`/memories/${id}`, { method: "PUT", body: JSON.stringify(changes) }); saveLocal((await getMemories()).map((item) => item.id === id ? memory : item)); return memory; }
  catch { const next = localMemories().map((item) => item.id === id ? { ...item, ...changes } : item); saveLocal(next); return next.find((item) => item.id === id); }
}
export async function deleteMemory(id) {
  try { await request(`/memories/${id}`, { method: "DELETE" }); }
  catch { /* Keep the local-first demo functional when the API is offline. */ }
  return saveLocal(localMemories().filter((item) => item.id !== id));
}
export async function confirmMemory(id) {
  try { const { memory } = await request(`/memories/${id}/confirm`, { method: "POST" }); return memory; }
  catch {
    const confirmed = { ...localMemories().find((memory) => memory.id === id), confirmedAt: new Date().toISOString() };
    saveLocal(localMemories().map((memory) => memory.id === id ? confirmed : memory));
    return confirmed;
  }
}
export async function sendRecallFeedback(id, helpful) {
  const { memory } = await request(`/memories/${id}/feedback`, { method: "POST", body: JSON.stringify({ helpful }) });
  return memory;
}
export async function getInsights() {
  try { return await request("/insights"); }
  catch {
    const memories = localMemories();
    const memory = memories.find((item) => item.severity === "red") || memories[0] || null;
    return { nudge: memory ? { memory, reason: "A useful lesson from your personal archive." } : null };
  }
}
export async function assistCapture(memory) {
  try {
    const { suggestion, aiAvailable } = await request("/assist/capture", { method: "POST", body: JSON.stringify(memory) });
    return { ...suggestion, aiAvailable };
  } catch {
    const source = [memory.mistake, memory.context, memory.solution].join(" ");
    const severity = /again|repeat|repeated|recurr|always|every time|keeps|often|frequently|ongoing|intermittent|still happens/i.test(source) ? "red" : /one.?off|single|accident|isolated|first time|never happened before/i.test(source) ? "green" : "yellow";
    return { title: memory.title || (memory.mistake || "New lesson").slice(0, 72), tags: usefulTags(source), severity, takeaway: memory.solution || "Add the final fix before saving.", source: "smart defaults", aiAvailable: false };
  }
}
export async function extractRawError(raw) {
  try { const { extraction, aiAvailable } = await request("/assist/extract", { method: "POST", body: JSON.stringify({ raw }) }); return { ...extraction, aiAvailable }; }
  catch {
    const lines = String(raw || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const error = lines.find((line) => /(?:error|exception|failed|cannot|timeout|401|403|404|500)\b/i.test(line)) || lines[0] || "Unclassified error";
    return { title: error.slice(0, 72), mistake: error, context: "Raw error captured — inspect the failing line and trigger.", solution: "Investigate the error, apply a targeted change, then rerun the original command to verify it.", tags: usefulTags(raw), severity: "yellow", source: "smart extraction", aiAvailable: false };
  }
}
const tagNoise = new Set(["about", "after", "again", "also", "because", "could", "didnt", "dont", "going", "goind", "have", "into", "just", "know", "like", "more", "really", "should", "that", "then", "than", "their", "there", "they", "this", "very", "was", "were", "what", "when", "which", "with", "would", "your"]);
const tagSignals = [[/(python|django|flask|pandas|pip)\b/i, "python"], [/(javascript|typescript|node|npm|vite)\b/i, "javascript"], [/(react|useeffect|usestate|setstate|render)\b/i, "react"], [/(api|endpoint|request|response|http)\b/i, "api"], [/(auth|token|bearer|oauth|login|password|credential)\b/i, "authentication"], [/(database|sql|query|postgres|mysql|mongodb)\b/i, "database"], [/(deploy|deployment|production|vercel|docker|server)\b/i, "deployment"], [/(test|testing|jest|vitest|assert)\b/i, "testing"], [/(git|merge|branch|commit|conflict)\b/i, "git"], [/(sleep|tired|fatigue|rest)\b/i, "wellbeing"], [/(slip|trip|fall|floor|hazard)\b/i, "safety"], [/(performance|slow|latency|timeout)\b/i, "performance"]];
function usefulTags(value) {
  const text = String(value || "");
  const signalTags = tagSignals.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag);
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  const counts = words.filter((word) => !tagNoise.has(word)).reduce((all, word) => ({ ...all, [word]: (all[word] || 0) + 1 }), {});
  const repeated = Object.entries(counts).filter(([word, count]) => count > 1 && word.length >= 4).map(([word]) => word);
  return [...new Set(signalTags.length ? signalTags : repeated)].slice(0, 5);
}
function fallbackDraft(memory) {
  const text = [memory.title, memory.mistake, memory.context, memory.solution].join(" ").toLowerCase();
  if (/\b(slipped|slip|trip|fall|floor)\b/.test(text)) return "Stopped using the area, inspected the floor for moisture, debris, or unevenness, removed or marked the hazard, then tested the route safely before reopening it.";
  if (/\b(token|auth|401|bearer|login)\b/.test(text)) return "Added token-expiry handling before the protected request, refreshed the credential when needed, retried the original request, and verified that the 401 no longer occurs.";
  if (/\b(react|state|setstate|render)\b/.test(text)) return "Moved the dependent logic out of the stale state path, used a functional state update where needed, and verified the UI after the next render.";
  if (/\b(git|merge|conflict|lockfile)\b/.test(text)) return "Resolved the source conflict first, regenerated the derived lockfile, ran a clean install, and verified the project still builds and tests successfully.";
  return "The current note does not establish a verified fix yet. Reproduce the issue, record the exact cause you find, make one specific change, then repeat the original scenario and save the observed result.";
}
function localSolutionAssessment(memory) {
  const problemWords = new Set(tokens([memory.title, memory.mistake, memory.context].join(" ")).filter((word) => word.length > 3));
  const solution = String(memory.solution || "").trim();
  const solutionWords = [...new Set(tokens(solution).filter((word) => word.length > 3))];
  const overlap = solutionWords.filter((word) => problemWords.has(word)).length;
  const action = /\b(add|use|set|configure|replace|remove|retry|refresh|validate|update|check|test|run|create|install|handle|return|change|enable|disable)\b/i.test(solution) ? 18 : 0;
  const score = Math.max(0, Math.min(100, Math.min(34, Math.round(solution.length / 2.4)) + Math.min(26, overlap * 7) + action + Math.min(22, Math.max(0, solutionWords.length - 2) * 3)));
  const needsImprovement = score < 50;
  return { score, needsImprovement, suggestion: needsImprovement ? "Name the exact change you made, why it addresses the root cause, and how you verified it worked." : "This solution is specific enough to be useful when the problem returns.", suggestedSolution: needsImprovement ? fallbackDraft(memory) : "", source: "local quality check", aiAvailable: false };
}
export async function evaluateSolution(memory) {
  try {
    const { assessment, aiAvailable } = await request("/assist/evaluate", { method: "POST", body: JSON.stringify(memory) });
    return { ...assessment, aiAvailable };
  } catch { return localSolutionAssessment(memory); }
}
export function relativeTime(date) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date)) / 86400000));
  if (days === 0) return "today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}
function tokens(value) { return String(value || "").toLowerCase().match(/[a-z0-9+#.-]{2,}/g) || []; }
export async function recallMemories(problem) {
  const { matches } = await request("/recall", { method: "POST", body: JSON.stringify({ problem }) });
  return matches.map((memory) => ({ ...memory, timeAgo: relativeTime(memory.createdAt) }));
}
