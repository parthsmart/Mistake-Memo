# MistakeMemo

MistakeMemo is a personal archive for debugging lessons: capture what went wrong, why it happened, and the fix; then recall the relevant lesson when a similar problem appears.

## Run locally

Open two terminals from this folder:

```powershell
cd server
npm start
```

```powershell
cd client
npm install
npm run dev
```

Open the Vite URL shown in the second terminal. The development server forwards `/api` requests to the API at port `5000`.

## Configuration

The app works without any external services. Memories are persisted to `server/data/memories.json`.

To enable the full AI memory layer, copy `server/.env.example` to `server/.env`, set `OPENAI_API_KEY`, then restart the API and call `POST /api/reindex` once. The server uses `text-embedding-3-small` for semantic retrieval, and the Responses API for the optional capture organizer. Set `OPENAI_ASSIST_MODEL` to choose the organizer model; otherwise the server uses its default. Without a key the project still works with keyword recall and local smart suggestions.

The API exposes a compact, dependency-free vector layer: embeddings are persisted with each memory and compared with cosine similarity during recall. This makes semantic matching portable for local development; swap the persistence adapter for PostgreSQL/MongoDB plus a managed vector index when deploying at larger scale.

For a separately deployed API, set `VITE_API_URL` to its `/api` base URL when building the client.

## Checks

```powershell
cd client
npm run lint
npm run build
```
