import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(join(serverDirectory, ".env")); } catch { /* A local .env file is optional. */ }
const port = Number(process.env.PORT || 5000);
const dataFile = join(serverDirectory, "data", "memories.json");
const geminiKey = process.env.GEMINI_API_KEY;
const assistantModel = process.env.GEMINI_ASSIST_MODEL || "gemini-3.6-flash";

const seedMemories = [
  { id: "seed-auth", title: "Python API Authentication", mistake: "Requests began failing after an access token expired.", context: "The client did not refresh its bearer token before protected requests.", solution: "Added token refresh logic and retried the original request.", tags: ["python", "api", "auth"], severity: "red", createdAt: "2026-06-22T00:00:00.000Z" },
  { id: "seed-react", title: "React state not updating", mistake: "Read state immediately after calling setState.", context: "React batches state updates, so the old value was still in scope.", solution: "Used a functional update and reacted to the change in useEffect.", tags: ["react", "state"], severity: "yellow", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "seed-git", title: "Git merge conflict", mistake: "A dependency lockfile conflicted after merging branches.", context: "Both branches changed the generated lockfile.", solution: "Resolved the source changes, regenerated the lockfile, and tested the install.", tags: ["git", "dependencies"], severity: "green", createdAt: "2026-08-15T00:00:00.000Z" },
  { id: "seed-cors", title: "CORS blocked frontend request", mistake: "The browser blocked a request from the React app to the API.", context: "The API did not allow the frontend origin and preflight headers.", solution: "Configured CORS for the frontend origin and allowed the required methods and headers, then retested from the browser.", tags: ["cors", "api", "frontend"], severity: "red", createdAt: "2026-07-03T00:00:00.000Z" },
  { id: "seed-jwt", title: "JWT refresh token loop", mistake: "Requests kept retrying after an expired access token.", context: "The refresh interceptor retried its own failed refresh request.", solution: "Excluded the refresh endpoint from interception, queued one refresh operation, and retried each original request once.", tags: ["jwt", "authentication", "api"], severity: "red", createdAt: "2026-07-12T00:00:00.000Z" },
  { id: "seed-fastapi", title: "FastAPI validation error", mistake: "The endpoint returned a 422 validation response for a valid-looking request.", context: "The client sent snake_case fields while the request model expected different names.", solution: "Aligned the client payload with the Pydantic model aliases and added a request-contract test.", tags: ["fastapi", "validation", "api"], severity: "yellow", createdAt: "2026-07-20T00:00:00.000Z" },
  { id: "seed-db", title: "Database migration missing in production", mistake: "The deployment succeeded but the app failed on a missing database column.", context: "Migrations were not run as part of the production release process.", solution: "Added a migration step to deployment, verified schema version before serving traffic, and tested a clean release.", tags: ["database", "migration", "deployment"], severity: "red", createdAt: "2026-07-26T00:00:00.000Z" },
  { id: "seed-timeout", title: "API request timeout under load", mistake: "A report endpoint timed out when the dataset grew.", context: "The query scanned unindexed rows and serialized too much data in one response.", solution: "Added the required index, paginated the response, and load-tested the endpoint against production-sized data.", tags: ["performance", "database", "api"], severity: "yellow", createdAt: "2026-08-05T00:00:00.000Z" },
  { id: "seed-env", title: "Environment variable unavailable in Vite", mistake: "The frontend saw an undefined API URL after deployment.", context: "The variable did not use the VITE_ prefix required for browser exposure.", solution: "Renamed it with the VITE_ prefix, rebuilt the client, and verified the deployed configuration.", tags: ["vite", "environment", "deployment"], severity: "green", createdAt: "2026-08-10T00:00:00.000Z" },
  { id: "seed-test", title: "Flaky async test", mistake: "A test passed locally but intermittently failed in CI.", context: "The assertion ran before the asynchronous state update completed.", solution: "Awaited the user-visible state change, removed timing assumptions, and repeated the test in CI-like conditions.", tags: ["testing", "async", "ci"], severity: "yellow", createdAt: "2026-08-18T00:00:00.000Z" }
];

async function readMemories() {
  try {
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    const known = new Set(saved.map((memory) => memory.id));
    const missingSeeds = seedMemories.filter((memory) => !known.has(memory.id));
    if (missingSeeds.length) await writeMemories([...saved, ...missingSeeds]);
    return [...saved, ...missingSeeds].map(enrichMemory);
  }
  catch { await writeMemories(seedMemories); return seedMemories; }
}
async function writeMemories(memories) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(memories, null, 2));
}
function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
  response.end(JSON.stringify(body));
}
async function bodyOf(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  try { return JSON.parse(body); }
  catch { const error = new Error("Request body must be valid JSON"); error.status = 400; throw error; }
}
function validate(memory) {
  return memory && ["title", "mistake", "solution"].every((key) => typeof memory[key] === "string" && memory[key].trim());
}
function fallbackDraft(memory) {
  const text = [memory.title, memory.mistake, memory.context, memory.solution].join(" ").toLowerCase();
  if (/\b(slipped|slip|trip|fall|floor)\b/.test(text)) return "Stopped using the area, inspected the floor for moisture, debris, or unevenness, removed or marked the hazard, then tested the route safely before reopening it.";
  if (/\b(token|auth|401|bearer|login)\b/.test(text)) return "Added token-expiry handling before the protected request, refreshed the credential when needed, retried the original request, and verified that the 401 no longer occurs.";
  if (/\b(react|state|setstate|render)\b/.test(text)) return "Moved the dependent logic out of the stale state path, used a functional state update where needed, and verified the UI after the next render.";
  if (/\b(git|merge|conflict|lockfile)\b/.test(text)) return "Resolved the source conflict first, regenerated the derived lockfile, ran a clean install, and verified the project still builds and tests successfully.";
  return "The current note does not establish a verified fix yet. Reproduce the issue, record the exact cause you find, make one specific change, then repeat the original scenario and save the observed result.";
}
function solutionQuality(memory) {
  const problemWords = new Set(tokens([memory.title, memory.mistake, memory.context].join(" ")).filter((word) => word.length > 3));
  const solutionWords = [...new Set(tokens(memory.solution).filter((word) => word.length > 3))];
  const solution = String(memory.solution || "").trim();
  const actionWords = /\b(add|use|set|configure|replace|remove|retry|refresh|validate|update|check|test|run|create|install|handle|return|change|enable|disable)\b/i.test(solution);
  const overlap = solutionWords.filter((word) => problemWords.has(word)).length;
  const specificity = solutionWords.length;
  const lengthScore = Math.min(34, Math.round(solution.length / 2.4));
  const relevanceScore = Math.min(26, overlap * 7);
  const actionScore = actionWords ? 18 : 0;
  const detailScore = Math.min(17, Math.max(0, specificity - 2) * 3) + (/[,.;:`]|\bthen\b|\bafter\b/i.test(solution) ? 5 : 0);
  const score = Math.max(0, Math.min(100, lengthScore + relevanceScore + actionScore + detailScore));
  const needsImprovement = score < 50;
  const suggestion = needsImprovement ? "Name the exact change you made, why it addresses the root cause, and how you verified it worked." : "This solution is specific enough to be useful when the problem returns.";
  const suggestedSolution = needsImprovement ? fallbackDraft(memory) : "";
  return { score, needsImprovement, suggestion, suggestedSolution, factors: { relevance: relevanceScore, actionability: actionScore, detail: Math.min(22, detailScore), completeness: lengthScore } };
}
function enrichMemory(memory) {
  const tags = Array.isArray(memory.tags) ? memory.tags : [];
  const completion = [memory.title, memory.mistake, memory.context, memory.solution].filter((value) => String(value || "").trim()).length;
  const solutionStrength = Math.min(20, Math.floor(String(memory.solution || "").length / 12));
  const tagStrength = Math.min(15, tags.length * 5);
  const confirmedBoost = memory.confirmedAt ? 12 : 0;
  const recurrenceBoost = memory.severity === "red" ? 16 : memory.severity === "yellow" ? 8 : 3;
  const memoryScore = Math.min(100, completion * 11 + solutionStrength + tagStrength + confirmedBoost + recurrenceBoost);
  const confidence = Math.min(98, 35 + completion * 10 + solutionStrength + (memory.confirmedAt ? 10 : 0));
  return { ...memory, tags, memoryScore, confidence, solutionQuality: solutionQuality(memory), surfaceCount: memory.surfaceCount || 0, confirmedAt: memory.confirmedAt || null };
}
function nudgeFor(memories) {
  const ranked = memories.map(enrichMemory).sort((a, b) => {
    const aPriority = a.memoryScore + a.confidence * 0.35 + (a.severity === "red" ? 18 : 0) - a.surfaceCount * 2;
    const bPriority = b.memoryScore + b.confidence * 0.35 + (b.severity === "red" ? 18 : 0) - b.surfaceCount * 2;
    return bPriority - aPriority;
  });
  const memory = ranked[0];
  if (!memory) return null;
  const reason = memory.severity === "red" ? "This is marked as recurring, so it is worth keeping front of mind." : `High-value lesson: ${memory.confidence}% confidence and a ${memory.memoryScore}/100 memory score.`;
  return { memory, reason };
}
function memoryHealth(memories) {
  const enriched = memories.map(enrichMemory);
  const confirmed = enriched.filter((memory) => memory.confirmedAt).length;
  const wellFormed = enriched.filter((memory) => memory.memoryScore >= 70).length;
  const averageConfidence = enriched.length ? Math.round(enriched.reduce((sum, memory) => sum + memory.confidence, 0) / enriched.length) : 0;
  return { confirmed, wellFormed, averageConfidence, semanticSearch: Boolean(geminiKey) };
}
function tokens(value) { return String(value || "").toLowerCase().match(/[a-z0-9+#.-]{2,}/g) || []; }
function editDistance(first, second) {
  if (first === second) return 0;
  if (Math.abs(first.length - second.length) > 2) return 3;
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (first[row - 1] === second[column - 1] ? 0 : 1));
    previous = current;
  }
  return previous[second.length];
}
function bestTokenMatch(query, candidates) {
  if (candidates.includes(query)) return { term: query, score: 1, fuzzy: false };
  const maxDistance = query.length >= 7 ? 2 : 1;
  let best = null;
  for (const candidate of candidates) {
    if (candidate.length < 4 || Math.abs(candidate.length - query.length) > maxDistance) continue;
    const distance = editDistance(query, candidate);
    if (distance > maxDistance) continue;
    const score = Math.max(0.72, 1 - distance / Math.max(query.length, candidate.length));
    if (!best || score > best.score) best = { term: candidate, score, fuzzy: true };
  }
  return best;
}
function recall(memories, problem) {
  const terms = [...new Set(tokens(problem))];
  return memories.map((memory) => {
    const searchable = [memory.title, memory.mistake, memory.context, memory.solution, memory.tags.join(" ")].join(" ");
    const matches = terms.map((term) => bestTokenMatch(term, [...new Set(tokens(searchable))])).filter(Boolean);
    const similarityScore = terms.length ? matches.reduce((total, match) => total + match.score, 0) / terms.length : 0;
    const labels = matches.slice(0, 4).map((match) => match.fuzzy ? `${match.term} (typo-tolerant)` : match.term);
    return { ...memory, similarityScore, explanation: labels.length ? `Matched on: ${labels.join(", ")}.` : "" };
  }).filter((memory) => memory.similarityScore >= 0.34).sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
}

function searchableText(memory) {
  return [memory.title, memory.mistake, memory.context, memory.solution, memory.tags.join(" ")].filter(Boolean).join("\n");
}
function publicMemory(memory) {
  const { embedding, ...safeMemory } = enrichMemory(memory);
  return safeMemory;
}
async function embed(text) {
  if (!geminiKey) return null;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({ model: "models/gemini-embedding-001", taskType: "SEMANTIC_SIMILARITY", content: { parts: [{ text }] } })
  });
  if (!response.ok) throw new Error(`Gemini embeddings request failed (${response.status})`);
  const data = await response.json();
  return data.embedding?.values;
}
function cosineSimilarity(a, b) {
  let dot = 0, aLength = 0, bLength = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; aLength += a[i] ** 2; bLength += b[i] ** 2; }
  return dot / (Math.sqrt(aLength) * Math.sqrt(bLength));
}
async function semanticRecall(memories, problem) {
  if (!geminiKey || !memories.every((memory) => Array.isArray(memory.embedding))) return recall(memories, problem);
  const queryEmbedding = await embed(problem);
  return memories.map((memory) => ({
    ...memory,
    similarityScore: Math.max(0, cosineSimilarity(queryEmbedding, memory.embedding)),
    explanation: "Matched by semantic similarity across your saved lesson."
  })).sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 3);
}

function fallbackSuggestion(input) {
  const source = [input.mistake, input.context, input.solution].filter(Boolean).join(" ");
  const tags = usefulTags(source);
  const title = input.title?.trim() || (input.mistake || "New lesson").split(/[.!?]/)[0].trim().slice(0, 72);
  // Do not reuse the selected UI value here: that creates a feedback loop where
  // the organizer only repeats the user's existing choice instead of assessing it.
  const severity = /again|repeat|repeated|recurr|always|every time|keeps|often|frequently|ongoing|intermittent|still happens/i.test(source) ? "red" : /one.?off|single|accident|isolated|first time|never happened before/i.test(source) ? "green" : "yellow";
  return { title, tags, severity, takeaway: input.solution?.trim() || "Add the final fix so this lesson is easy to reuse.", source: "smart defaults" };
}
const tagNoise = new Set(["about", "after", "again", "also", "because", "could", "didnt", "dont", "going", "goind", "have", "into", "just", "know", "like", "more", "really", "should", "that", "then", "than", "their", "there", "they", "this", "very", "was", "were", "what", "when", "which", "with", "would", "your"]);
const tagSignals = [
  [/(python|django|flask|pandas|pip)\b/i, "python"], [/(javascript|typescript|node|npm|vite)\b/i, "javascript"],
  [/(react|useeffect|usestate|setstate|render)\b/i, "react"], [/(api|endpoint|request|response|http)\b/i, "api"],
  [/(auth|token|bearer|oauth|login|password|credential)\b/i, "authentication"], [/(database|sql|query|postgres|mysql|mongodb)\b/i, "database"],
  [/(deploy|deployment|production|vercel|docker|server)\b/i, "deployment"], [/(test|testing|jest|vitest|assert)\b/i, "testing"],
  [/(git|merge|branch|commit|conflict)\b/i, "git"], [/(sleep|tired|fatigue|rest)\b/i, "wellbeing"],
  [/(slip|trip|fall|floor|hazard)\b/i, "safety"], [/(performance|slow|latency|timeout)\b/i, "performance"]
];
function usefulTags(value) {
  const text = String(value || "");
  const signalTags = tagSignals.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag);
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  const candidates = words.filter((word) => !tagNoise.has(word) && !/^(?:[a-z])\1{2,}$/.test(word));
  // Prefer recognized concepts. For a free-form note, only use a repeated
  // meaningful term rather than promoting a random word or typo into a tag.
  const counts = candidates.reduce((all, word) => ({ ...all, [word]: (all[word] || 0) + 1 }), {});
  const repeated = Object.entries(counts).filter(([word, count]) => count > 1 && word.length >= 4).map(([word]) => word);
  return [...new Set(signalTags.length ? signalTags : repeated)].slice(0, 5);
}
function sanitizeTags(tags, source) {
  const allowed = new Set(usefulTags(source));
  const aliases = { "fast api": "fastapi", "rest api": "api", rest: "api", jwt: "authentication", oauth: "authentication", typescript: "javascript", nodejs: "javascript", "node.js": "javascript", "ci/cd": "ci", pydantic: "fastapi" };
  const cleaned = (Array.isArray(tags) ? tags : [])
    .map((tag) => String(tag).toLowerCase().trim())
    .map((tag) => aliases[tag] || tag.replace(/[^a-z0-9+#.-]/g, ""))
    .filter((tag) => tag.length >= 3 && tag.length <= 24 && !tagNoise.has(tag) && !tag.includes("goind"))
    .filter((tag) => allowed.has(tag) || tagSignals.some(([pattern, label]) => label === tag && pattern.test(source)));
  return [...new Set(cleaned)].slice(0, 5);
}
function normalizeSeverity(value) {
  const severity = String(value || "").toLowerCase();
  if (["low", "green", "one-off", "oneoff"].includes(severity)) return "green";
  if (["high", "red", "recurring"].includes(severity)) return "red";
  return "yellow";
}
async function geminiJson(instructions, input, schema, maxOutputTokens) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${assistantModel}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: `${instructions}\nReturn exactly one JSON object with only these required fields: ${Object.keys(schema.properties).join(", ")}.` }] }, contents: [{ role: "user", parts: [{ text: input }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: Math.max(maxOutputTokens, 1024) } })
  });
  if (!response.ok) throw new Error(`Gemini generation request failed (${response.status})`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return JSON.parse(text);
}
async function suggestMemory(input) {
  const fallback = fallbackSuggestion(input);
  if (!geminiKey) return fallback;
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      title: { type: "string" }, tags: { type: "array", items: { type: "string" }, maxItems: 5 },
      severity: { type: "string", enum: ["green", "yellow", "red"] }, takeaway: { type: "string" }
    }, required: ["title", "tags", "severity", "takeaway"]
  };
  try { const suggestion = await geminiJson("You turn a user's note into concise, reusable memory metadata. Do not invent facts. Tags are a retrieval taxonomy, not words copied from the note: return 0–5 lower-case topic labels such as 'python', 'authentication', 'api', 'testing', 'wellbeing', or 'safety'. Never output filler, verbs, pronouns, generic words, or misspellings (for example 'goind', 'going', 'didnt', 'thing', 'problem'). If no durable topic is clear, return an empty tags array.", JSON.stringify({ title: input.title || "", mistake: input.mistake || "", context: input.context || "", solution: input.solution || "" }), schema, 220); return { ...suggestion, tags: sanitizeTags(suggestion.tags, [input.title, input.mistake, input.context, input.solution].join(" ")), severity: normalizeSeverity(suggestion.severity), source: "AI" }; }
  catch { return fallback; }
}
async function assessSolution(input) {
  const fallback = solutionQuality(input);
  if (!geminiKey) return { ...fallback, source: "quality engine" };
  const schema = { type: "object", additionalProperties: false, properties: { score: { type: "integer", minimum: 0, maximum: 100 }, suggestion: { type: "string" }, suggestedSolution: { type: "string" } }, required: ["score", "suggestion", "suggestedSolution"] };
  try { const assessed = await geminiJson("Evaluate whether a debugging solution directly and precisely resolves the described problem and context. Score 0-100. Give one concise improvement suggestion and a conservative draft solution. Do not claim unknown facts: clearly frame unknown diagnostic work as an investigation.", JSON.stringify({ problem: input.mistake || "", context: input.context || "", solution: input.solution || "" }), schema, 220); return { ...fallback, ...assessed, needsImprovement: assessed.score < 50, source: "AI" }; }
  catch { return { ...fallback, source: "quality engine" }; }
}
function extractRawFallback(raw) {
  const lines = String(raw || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const errorLine = lines.find((line) => /(?:error|exception|traceback|failed|cannot|denied|timeout|401|403|404|500)\b/i.test(line)) || lines[0] || "Unclassified error";
  const title = errorLine.replace(/^(?:error|exception)\s*[:|-]?\s*/i, "").slice(0, 72);
  const context = lines.filter((line) => /(?:traceback|at\s+\S|file\s+\"|line\s+\d+|stack)/i.test(line)).slice(0, 4).join("\n");
  return { title, mistake: errorLine, context: context || "Raw error captured — inspect the failing line and trigger.", solution: "Investigate the error, identify the failing dependency or input, apply the smallest targeted change, then rerun the original command to verify it.", tags: usefulTags(raw), severity: "yellow", source: "smart extraction" };
}
async function extractRawError(raw) {
  const fallback = extractRawFallback(raw);
  if (!geminiKey) return fallback;
  const schema = { type: "object", additionalProperties: false, properties: { title: { type: "string" }, mistake: { type: "string" }, context: { type: "string" }, solution: { type: "string" }, tags: { type: "array", items: { type: "string" }, maxItems: 5 }, severity: { type: "string", enum: ["green", "yellow", "red"] } }, required: ["title", "mistake", "context", "solution", "tags", "severity"] };
  try { const extracted = await geminiJson("Extract a reusable mistake record from raw terminal logs or an error message. Do not invent a resolved fix. If the log does not prove a fix, write a concise investigation and verification plan in solution. Keep the title short. Tags must be durable retrieval topics only, never copied filler or typos.", raw, schema, 320); return { ...extracted, tags: sanitizeTags(extracted.tags, raw), severity: normalizeSeverity(extracted.severity), source: "AI" }; }
  catch { return fallback; }
}

createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") return send(response, 204, {});
    const url = new URL(request.url, `http://${request.headers.host}`);
    const id = url.pathname.match(/^\/api\/memories\/([^/]+)$/)?.[1];
    const confirmId = url.pathname.match(/^\/api\/memories\/([^/]+)\/confirm$/)?.[1];
    const feedbackId = url.pathname.match(/^\/api\/memories\/([^/]+)\/feedback$/)?.[1];
    const memories = await readMemories();
    if (request.method === "GET" && url.pathname === "/api/health") return send(response, 200, { ok: true, semanticSearch: Boolean(geminiKey), aiAssist: Boolean(geminiKey), provider: geminiKey ? "Gemini" : null });
    if (request.method === "GET" && url.pathname === "/api/memories") return send(response, 200, { memories: memories.map(publicMemory) });
    if (request.method === "GET" && url.pathname === "/api/insights") {
      const nudge = nudgeFor(memories);
      return send(response, 200, { nudge: nudge ? { memory: publicMemory(nudge.memory), reason: nudge.reason } : null, totalMemories: memories.length, recurringMemories: memories.filter((memory) => memory.severity === "red").length, health: memoryHealth(memories) });
    }
    if (request.method === "POST" && url.pathname === "/api/assist/capture") {
      const input = await bodyOf(request);
      if (![input.title, input.mistake, input.context, input.solution].some((value) => String(value || "").trim())) return send(response, 400, { error: "Add a few details before asking AI to organize the lesson" });
      return send(response, 200, { suggestion: await suggestMemory(input), aiAvailable: Boolean(geminiKey) });
    }
    if (request.method === "POST" && url.pathname === "/api/assist/evaluate") {
      const input = await bodyOf(request);
      if (!String(input.mistake || "").trim() || !String(input.solution || "").trim()) return send(response, 400, { error: "Add both the problem and solution to assess quality" });
      return send(response, 200, { assessment: await assessSolution(input), aiAvailable: Boolean(geminiKey) });
    }
    if (request.method === "POST" && url.pathname === "/api/assist/extract") {
      const raw = String((await bodyOf(request)).raw || "").trim();
      if (raw.length < 6) return send(response, 400, { error: "Paste an error message or terminal output first" });
      return send(response, 200, { extraction: await extractRawError(raw), aiAvailable: Boolean(geminiKey) });
    }
    if (request.method === "POST" && url.pathname === "/api/memories") {
      const input = await bodyOf(request);
      if (!validate(input)) return send(response, 400, { error: "title, mistake, and solution are required" });
      const memory = enrichMemory({ ...input, id: crypto.randomUUID(), tags: Array.isArray(input.tags) ? input.tags : [], severity: input.severity || "yellow", createdAt: new Date().toISOString() });
      memory.embedding = await embed(searchableText(memory));
      await writeMemories([memory, ...memories]);
      return send(response, 201, { memory: publicMemory(memory) });
    }
    if (request.method === "PUT" && id) {
      const changes = await bodyOf(request);
      const index = memories.findIndex((memory) => memory.id === id);
      if (index < 0) return send(response, 404, { error: "memory not found" });
      const updated = { ...memories[index], ...changes, id };
      if (!validate(updated)) return send(response, 400, { error: "title, mistake, and solution are required" });
      memories[index] = enrichMemory(updated);
      memories[index].embedding = await embed(searchableText(memories[index]));
      await writeMemories(memories);
      return send(response, 200, { memory: publicMemory(memories[index]) });
    }
    if (request.method === "POST" && confirmId) {
      const index = memories.findIndex((memory) => memory.id === confirmId);
      if (index < 0) return send(response, 404, { error: "memory not found" });
      memories[index] = enrichMemory({ ...memories[index], confirmedAt: new Date().toISOString(), reviewCount: (memories[index].reviewCount || 0) + 1 });
      await writeMemories(memories);
      return send(response, 200, { memory: publicMemory(memories[index]) });
    }
    if (request.method === "POST" && feedbackId) {
      const { helpful } = await bodyOf(request);
      const index = memories.findIndex((memory) => memory.id === feedbackId);
      if (index < 0) return send(response, 404, { error: "memory not found" });
      memories[index] = { ...memories[index], feedback: { helpful: (memories[index].feedback?.helpful || 0) + (helpful ? 1 : 0), notRelevant: (memories[index].feedback?.notRelevant || 0) + (helpful ? 0 : 1), lastAt: new Date().toISOString() } };
      await writeMemories(memories);
      return send(response, 200, { memory: publicMemory(memories[index]) });
    }
    if (request.method === "DELETE" && id) {
      const next = memories.filter((memory) => memory.id !== id);
      if (next.length === memories.length) return send(response, 404, { error: "memory not found" });
      await writeMemories(next);
      return send(response, 200, { deleted: id });
    }
    if (request.method === "POST" && url.pathname === "/api/reindex") {
      if (!geminiKey) return send(response, 400, { error: "GEMINI_API_KEY is required for semantic indexing" });
      const indexed = await Promise.all(memories.map(async (memory) => ({ ...memory, embedding: await embed(searchableText(memory)) })));
      await writeMemories(indexed);
      return send(response, 200, { indexed: indexed.length });
    }
    if (request.method === "POST" && url.pathname === "/api/recall") {
      const problem = String((await bodyOf(request)).problem || "").trim();
      if (!problem) return send(response, 400, { error: "Describe the problem you want to recall" });
      const matches = await semanticRecall(memories, problem);
      const ids = new Set(matches.map((memory) => memory.id));
      const surfaced = memories.map((memory) => ids.has(memory.id) ? { ...memory, surfaceCount: (memory.surfaceCount || 0) + 1, lastSurfacedAt: new Date().toISOString() } : memory);
      await writeMemories(surfaced);
      return send(response, 200, { matches: matches.map(publicMemory), semanticSearch: Boolean(geminiKey) });
    }
    return send(response, 404, { error: "route not found" });
  } catch (error) {
    console.error(error);
    const message = String(error?.message || "");
    return send(response, error.status || 500, { error: error.status ? message : message.startsWith("Gemini ") ? message : "internal server error" });
  }
}).listen(port, () => console.log(`MistakeMemo API listening on http://localhost:${port}`));
