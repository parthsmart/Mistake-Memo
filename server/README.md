# MistakeMemo API

Run the API with `npm start` from this folder. It persists memories in `data/memories.json`.

## Semantic AI recall

Copy `.env.example` to `.env`, then set `OPENAI_API_KEY` before starting the server. Call `POST /api/reindex` once to create embeddings for the seeded memories. New and edited memories are embedded automatically. Without an API key, the API stays fully functional using keyword recall.

The semantic mode uses `text-embedding-3-small`, which creates numerical text representations suitable for relatedness and search. See the official [OpenAI embeddings model documentation](https://developers.openai.com/api/docs/models/text-embedding-3-small).

`POST /api/assist/capture` powers the capture-page memory organizer. With an API key it uses the Responses API to return structured title, tag, severity, and takeaway suggestions; without one it produces safe local defaults. Set `OPENAI_ASSIST_MODEL` to override its model.
