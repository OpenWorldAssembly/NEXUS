# Nexus DAN
## A Decentralized Action Network

**Nexus is an open-source, antifragile coordination layer designed to turn ideas into real-world action, clearly, measurably, and repeatably.**

**Quick links**
- Discord: <YOUR_DISCORD_INVITE_LINK>
- Docs: `./docs` (in progress)
- Roadmap: see “Roadmap” below
- Issues: GitHub Issues

> Naming note: “Nexus” is a crowded name. Public references may use **Nexus DAN** (Decentralized Action Network).

---

## ⚡ Philosophy

- **Alignment without uniformity**
- **Coordination without control**
- **Action over theory**

---

## Why Nexus Exists
Human coordination is entering a decisive era. Technology now enables two opposite futures:

- **unprecedented surveillance, manipulation, and concentration of power**
- **unprecedented coordination, transparency, and voluntary cooperation at scale**

Most coordination platforms centralize authority and fail poorly under pressure. Nexus explores a different approach: treat coordination as **portable, inspectable data** that can survive outages, partitions, censorship, and low bandwidth.

Nexus is **not** a movement, party, or command structure. It is an open-source system communities and initiatives can **use, contribute to, improve, fork, or ignore**.
---

## What This Is

Nexus helps individuals and groups:

- **organize meaningful actions**
- **coordinate without centralization**
- **learn from results**
- **improve over time**

Nexus is not a platform you join. **It treats data as the system and platforms as adapters.**

## ⚙️ How It Works

Nexus is built around a simple but powerful loop:

### Templates
Reusable blueprints for action.

> “What does a good mission look like?”

### Mission Plans
A specific instance of a template.

> “We’re doing this, here, at this time.”

### Mission Reports
What actually happened.

> “Here’s what worked, what didn’t, and what changed.”

---

## 🔁 The Feedback Loop

Every action feeds back into the system:

- **Templates → generate Plans**
- **Plans → produce Reports**
- **Reports → improve Templates**

Over time, this creates a **living library of proven actions**.

---

## 🤝 Participation Modes

Nexus supports different ways of contributing:

### Integrated
- Join the mission directly
- Coordinate with the group
- Eligible for structured collaboration

### Independent
- Align with the mission
- Act autonomously
- Share results without being managed

Both are valid. Both contribute to the system.

---

## 📊 Why This Matters

Some coordination systems fail because they:

- lose track of results
- centralize too heavily
- don’t evolve based on reality

Nexus is designed to:

- stay decentralized
- track real outcomes
- surface what actually works

---

## 🧠 What Nexus Becomes Over Time

As usage grows, Nexus evolves into:

- a **map of real-world activity**
- a **library of effective actions**
- a **coordination layer across groups**
- a **foundation for decentralized governance**

Not utopia. Not perfection. Just a more livable trajectory enabled by better coordination primitives.

---

## The Core Idea

> **Mental model:** Think of Nexus as Git + a knowledge graph + mission coordination, applied to real-world action.

### Everything is a packet

A **packet** is a portable unit of coordination: a proposal, mission, report, policy, module, identity element, and so on.

Packets are designed to be:
- **portable** → easy to export, import, and share
- **composable** → packets connect into larger structures
- **inspectable** → readable without hidden context
- **extensible** → new packet types and relationships can emerge over time

### Packets form a living graph

Packets link to other packets. Those links become a **living graph**:
- **Outgoing links**: what this packet references
- **Incoming links**: what references this packet

**The system is not the packets themselves, but the evolving graph they form together.**

The graph becomes a navigable, evolving structure for discovery, trust, governance, and coordination without hardcoded hierarchies.

---

## Sense → Think → Act

Nexus is built around a simple civilizational loop:

1) **SENSE (Perception)**  
   Distributed reporting and multi-perspective validation (human and/or technical).

2) **THINK (Coordination)**  
   Proposals, discussion, iteration, and governance mechanics (planned).

3) **ACT (Execution)**  
   Missions in the real world, online collaboration, and after-action learning.

Nexus makes these layers **legible, portable, and syncable as packets**.

---

## Architecture

### Core (engine)

The core is the portable logic layer with no UI assumptions:

- packet schema validation
- graph construction (relationships between packets)
- link resolution (incoming/outgoing)
- bundle import/export (planned)
- merge logic (planned)
- cryptographic identity + signatures (planned)
- trust and governance mechanics (planned)

The core should be:
- platform-agnostic
- UI-agnostic
- re-implementable across environments

### Adapters (interfaces)

Adapters are platform-specific layers on top of the core:
- Discord bot (current)
- Web app (planned)
- Mobile app (planned)
- CLI tools (planned)
- Mesh / embedded nodes (planned)

Adapters:
- render packets
- accept user input
- translate actions → core operations

**Adapters do not own system logic.** They orchestrate and display. They should not introduce dependencies that compromise portability or decentralization.

---

## Nodes, bundles, and offline-first networking

### Node (local-first)

Each instance of Nexus acts as a **local node**:
- stores packets locally
- builds a local graph
- operates offline
- syncs when it can

There is no required central server.

### Bundles (planned)

A **bundle** is a portable collection of packets used for distribution and sync:
- local sharing
- peer-to-peer sharing
- hosted mirrors
- archival snapshots

Nodes can import bundles, merge packets, and rebuild/update their graph.

### Bandwidth tiers (design goal)

Nexus is designed to function across multiple “network realities”:

- **High bandwidth**: interactive, near real-time sync (adapter-dependent)
- **Low bandwidth**: compressed bundles, delayed sync windows
- **Intermittent**: store-and-forward behavior, retry when links exist
- **Offline-first**: full local operation with later reconciliation
- **Mesh-capable**: transport-agnostic routing across local relays (Wi‑Fi, LoRa-class links, etc.)
- **Sneakernet**: bundle exchange via file transfer (USB, SD card, manual handoff)

**Coordination should not fail when connectivity does.**

The point is **graceful degradation**: coordination should not collapse when the internet gets weird.

---

## Packet Types (current schema)

Nexus defines packet headers plus several packet bodies (TypeScript + Zod):

**Identity / participation**
- **Element**: person, org, node, service (identity anchor; trust hooks planned)

**Direction**
- **Initiative**: umbrella direction
- **Program**: repeatable effort inside an initiative
- **Campaign**: timeboxed push inside an initiative/program

**Execution lifecycle**
- **MissionTemplate**: reusable mission blueprint (objectives, default modules/policies)
- **MissionPlan**: instantiated mission (logistics, modules, policies)
- **MissionReport**: after-action report (outcomes, notes, improvements)

**Constraints / building blocks**
- **Module**: capability block (safety, comms, supply, reporting, coordination)
- **Policy**: human-readable constraints/rules (validators planned)

---

## Trust & Verification (preview)

Nexus treats trust as **local, inspectable, and composable**. Planned mechanisms include:

- cryptographic identities (keypairs)
- signed packets and verification
- relationship proofs (planned)
- trust signals derived from the graph (who references what, reuse/forks, attestations)
- local filtering and policy-based validation (instead of global enforcement)

Nexus does not require a single global governance model. Governance can be packetized and adapted, including approaches that resemble **distributed direct or participatory decision-making**.

---

## Current Implementation (prototype)

**Discord adapter works today:**
- local node storage using SQLite
- packet persistence and retrieval
- outgoing link extraction + link indexing
- incoming/outgoing link browsing in Discord UI
- `/seed` to generate sample packets
- `/list-packets` to browse by type and preview packets
- `/delete-packet` to remove packets
- `/ping` sanity check

**Explicitly “future”:**
- cryptographic identity (keypairs)
- signed packets and verification
- trust graph scoring
- governance mechanics + voting layers (including SBMS experiments)
- bundle exchange + merge conflict strategy
- full browser-style UI (Discord and web)

---

## Project Principles

- **Decentralized by default**
- **Offline-first**
- **Data over platform**
- **Alignment over enforcement**
- **Local autonomy with shared, inspectable context**
- **Extensible schemas, not rigid hierarchies**
- **Antifragile networking and distribution**

---

## Roadmap

### 🔜 What’s Next
- Mission creation interface
- Report submission system
- Cross-linking and tracking
- Activity and impact indicators

### Near term
- graph utility layer (`graph.ts`)
- cleaner separation between core logic and Discord adapter
- better browsing UX (navigation-first, not command-first)
- search, filter, sorting

### Mid term
- bundles (import/export) as first-class objects
- merge strategy + conflict handling
- cloning/forking packets
- packetized communications (comments, signals)

### Long term
- cryptographic identity, signing, verification
- trust graph and reputation signals
- governance mechanics + voting layers (including SBMS experiments)
- mesh-first transports and embedded nodes
- resilient synchronization under real-world constraints

---

## Community

If you want to follow development, discuss design, or help build:

**Join the Discord:** <YOUR_DISCORD_INVITE_LINK>

Tip: pin a “Start Here” thread explaining `/seed`, `/list-packets`, and link navigation.

---

## Contributing

Nexus is still taking shape. High-leverage areas:

- core graph logic and link modeling
- packet schema evolution (Zod + TypeScript)
- adapter UX (Discord today, web later)
- distributed systems and sync models
- bundle design and merge strategy

Open an issue with what you want to tackle and your approach.

---

## License

TBD
