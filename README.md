# OWA

OWA is an Expo Router application with a public website shell, a dedicated `/nexus/*` workspace, local packet-backed API routes, and a Node SQLite runtime for the current web deployment path.

## Local development

Install dependencies:

```bash
npm install
```

Run the normal Expo development server:

```bash
npm run web
```

This remains the primary local iteration flow for UI and route work. The current local SQLite runtime data defaults to `data/nexus`.

## Local production-parity server

Export the production web bundle:

```bash
npm run export:web
```

Serve the exported bundle with the same Node entry used for Railway:

```bash
npm run serve:web
```

The production-parity server listens on `PORT` when provided and falls back to `3000`. It serves client assets from `dist/client`, forwards dynamic pages and `app/api/**` requests to the Expo server build in `dist/server`, and exposes a lightweight `/health` endpoint for Railway healthchecks.

## Runtime data

The Node SQLite runtime uses `NEXUS_DATA_DIR` when set. If it is not set, the app stores runtime data in:

```text
data/nexus
```

Files currently written there:

- `owa-packets.db`
- `discussion-seed-version.txt`

For Railway, mount a persistent volume and point `NEXUS_DATA_DIR` at that mount path.

## Railway deployment

The repo includes `railway.toml` for the Railway build and start commands:

- build: `npm run railway:build`
- start: `npm run railway:start`
- healthcheck: `/health`

Recommended Railway settings for this pass:

- use Node `24.x`
- mount a persistent volume and set `NEXUS_DATA_DIR`
- run a single replica

This pass intentionally keeps the current single-service Expo Router server shape and does not split the backend or migrate away from SQLite.
