# OWA

Open World Assembly is a web-first civic coordination app built on a packet-backed Nexus runtime. The repo includes a public site, a dedicated `/nexus/*` workspace, local API routes, and a SQLite-backed packet store for the current deployment path.

Today the live Nexus slice includes:

- packet-backed discussions with signed actor writes
- scoped trust and roles surfaces
- a read-only votes workspace
- a scoped Library browse surface
- a shell-level Packet Explorer overlay for deep packet inspection

Packet Explorer is currently:

- separate from Library
- opened from the Nexus shell and packet cards
- read-only in the current implementation phase
- focused on inspection, lineage, links, and runtime action visibility

## Source layout

- `core/*` for portable packet logic, schemas, builders, interpreters, and contracts
- `runtime/*` for storage adapters, runtime services, and API-facing glue
- `app/*` for application-layer UI, hooks, and shared state
- `src/app/*` for the Expo Router route shell and API entrypoints

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

Recommended Railway settings for the current deployment shape:

- use Node `24.x`
- mount a persistent volume and set `NEXUS_DATA_DIR`
- run a single replica

## Docs

- [Current Specifications](docs/specifications.md)
- [Implementation Guide](docs/implementation-guide.md)
- [Roadmap](docs/roadmap.md)
