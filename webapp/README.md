# L3 — Bitcoin Portfolio Risk Engine

**Automated trust scoring and fund migration for Bitcoin ecash mints.**

L3 continuously monitors Cashu mint health across 11 trust signals, computes probabilistic safety grades using Bayesian inference, and automatically migrates funds away from risky mints via Lightning Network — protecting your Bitcoin without manual intervention.

Built by **Jackson Zheng** for the **MIT Bitcoin Hackathon 2026**.

**Live Demo: https://mit-bitcoin.vercel.app**

---

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Architecture](#architecture)
- [Trust Scoring Engine](#trust-scoring-engine)
- [Migration Decision Engine](#migration-decision-engine)
- [Wallet Engine](#wallet-engine)
- [Mint Discovery (NIP-87)](#mint-discovery-nip-87)
- [On-Chain Intelligence (Allium)](#on-chain-intelligence-allium)
- [Discord Alert System](#discord-alert-system)
- [File Structure](#file-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## Problem

Cashu ecash mints are custodial — the mint operator holds your Bitcoin. If a mint goes offline, gets hacked, or rugs, your funds are gone. Users currently have no automated way to:

- Assess which mints are trustworthy
- Detect when a mint's risk profile changes
- Move funds before a mint fails

## Solution

L3 solves this with three core systems working together:

1. **Trust Engine** — Scores each mint 0–100 using 11 weighted signals (on-chain + direct probe), with uncertainty quantification
2. **Migration Engine** — Automatically moves funds from dangerous mints to safe ones via Lightning
3. **Wallet Engine** — Manages Cashu ecash proofs with durable persistence across serverless cold starts

The scoring loop runs every 60 seconds. No manual intervention required.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend — React 19 + TypeScript + Vite + Tailwind CSS     │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Trust    │ │Migration │ │  Alert   │ │  Simulation  │   │
│  │  Engine   │ │  Engine  │ │  Engine  │ │    Engine    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────────────┘   │
│       │             │            │                           │
│  ┌────▼─────────────▼────────────▼──────────────────────┐   │
│  │              State Store (React Context)              │   │
│  │   60s interval → probe → score → alert → migrate     │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼───────────────────────────────┐   │
│  │              Wallet API Client (walletApi.ts)         │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTPS
┌─────────────────────────▼───────────────────────────────────┐
│  Vercel Serverless Functions                                │
│                                                             │
│  /api/wallet/[action].js  — Cashu wallet (receive/send/    │
│                              migrate via Lightning)         │
│  /api/allium.js           — On-chain data proxy (keeps     │
│                              API key server-side)           │
│  /api/cashu-proxy.js      — CORS proxy for mint endpoints  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Vercel Blob Storage (proof persistence)      │   │
│  │   Ecash proofs saved after every mutation —          │   │
│  │   survives cold starts, prevents fund loss           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ Cashu Mints│  │ Allium API │  │  Nostr     │
   │ (7 mints)  │  │ (on-chain) │  │  Relays    │
   └────────────┘  └────────────┘  └────────────┘
```

---

## Trust Scoring Engine

**File: `src/core/trustEngine.ts` (795 lines)**

Each mint receives a composite score from 0–100 computed from 11 weighted signals. Every signal produces both a point estimate (μ) and an uncertainty value (σ), enabling probabilistic grading rather than hard thresholds.

### Signal Breakdown

| Signal | Weight | Source | What It Measures |
|--------|--------|--------|-----------------|
| `operator_identity` | 10% | Allium API | On-chain labels, wallet age, tx count, BTC holdings |
| `reserve_behavior` | 10% | Allium API | BTC reserve levels and historical balance trends |
| `transaction_patterns` | 5% | Allium API | Wash trading detection, circular activity, counterparty diversity |
| `counterparty_network` | 5% | Allium API | Entity labels, DeFi activity, network relationships |
| `availability` | 15% | Direct probe | Binary online/offline via `/v1/info` endpoint |
| `latency` | 10% | Direct probe | Response time (linear decay 0–3000ms) |
| `keyset_stability` | 10% | Direct probe | Unexpected key rotation detection via `/v1/keysets` |
| `tx_success_rate` | 10% | Direct probe | Accumulated transaction completion rate |
| `protocol_version` | 5% | Direct probe | Cashu NUT protocol version currency |
| `capabilities` | 10% | Direct probe | NUT support breadth (NUT-04, 05, 07, 09, 10, 11, 12, 14) |
| `metadata_quality` | 10% | Direct probe | Accountability signals: name, description, contact info |

### Probabilistic Grading

Instead of simple threshold grades, L3 computes three probabilities using Gaussian CDF over the score distribution:

- **pSafe** = P(true score ≥ 75) — probability the mint is genuinely safe
- **pWarning** = P(50 ≤ true score < 75)
- **pCritical** = P(true score < 50) — probability the mint is genuinely dangerous

The grade is the argmax of these three probabilities. Anonymous operators (no known Bitcoin address) receive σ = 0.45 (uninformative Bayesian prior), which naturally caps their score at ~70 regardless of probe signals.

### Allocation Algorithm

Two complementary portfolio allocation methods:

1. **MVO-Optimal (Sharpe-weighted)**: `w_i ∝ (μ_i − r_f) / σ_i²` — allocates proportional to risk-adjusted returns
2. **Kelly Criterion**: `kelly_i = max(0, 2 × pSafe_i − 1)` — allocates based on probability of safety

Both are capped at 40% per mint with iterative redistribution to prevent concentration risk.

### Momentum Adjustment

Scores incorporate velocity (Δ from previous cycle) with λ = 0.3 weighting:

```
adjustedScore = compositeScore + 0.3 × velocity
```

A mint trending downward gets penalized before it crosses the critical threshold.

---

## Migration Decision Engine

**File: `src/core/migrationEngine.ts` (150 lines)**

Conservative approach — only moves funds when there's a real safety reason. Every Lightning hop costs fees, so L3 never churns between safe mints.

### Three Phases

| Phase | Trigger | Action |
|-------|---------|--------|
| **Evacuate** | Score < 50 (critical) | Move ALL funds out to highest-scoring safe mint |
| **Reduce Exposure** | Score 50–74 (warning) AND holding > 25% of portfolio | Move EXCESS above 25% to safe mint |
| **Leave Alone** | Score ≥ 75 (safe) | No action — don't rebalance between safe mints |

### Hysteresis

A mint must score ≥ 60 (threshold + hysteresis of 10) to be eligible as a migration target. This prevents oscillation where funds bounce back and forth between mints near the threshold.

### Automation Modes

| Mode | Behavior |
|------|----------|
| **Auto** | Migrations execute immediately without user approval |
| **Alert** | Migrations are suggested — user must approve each one |
| **Manual** | No automated migrations; scoring only |

---

## Wallet Engine

**File: `api/wallet/[action].js` (310 lines)**

The wallet runs as a Vercel serverless function handling all Cashu ecash operations via the `@cashu/cashu-ts` library.

### Operations

| Route | Method | Description |
|-------|--------|-------------|
| `/api/wallet/mode` | GET | Current network mode (mutinynet/testnet/mainnet) |
| `/api/wallet/balances` | GET | All mint balances with totals |
| `/api/wallet/set-mode` | POST | Switch between network modes |
| `/api/wallet/receive` | POST | Generate Lightning invoice via best-scoring mint |
| `/api/wallet/poll` | POST | Poll for Lightning payment confirmation |
| `/api/wallet/send` | POST | Pay Lightning invoice (drains riskiest mint first) |
| `/api/wallet/migrate` | POST | Move funds between mints via Lightning |

### Smart Routing

- **Receive**: Routes to the highest-scoring online mint that isn't critical
- **Send**: Drains the riskiest funded mint first (lowest score) to naturally improve portfolio safety
- **Migrate**: Melt from source mint → Lightning invoice → Mint at target

### Proof Persistence (Vercel Blob)

Ecash proofs ARE the money — losing them means losing funds. The serverless function persists all proofs to Vercel Blob storage after every mutation (receive, send, migrate). On cold start, proofs are restored from Blob before processing any request.

```
Cold Start → Load proofs from Blob → Initialize wallets → Process request
Mutation   → Update in-memory proofs → Save to Blob → Return response
```

---

## Mint Discovery (NIP-87)

**File: `src/core/mintDiscovery.ts` (216 lines)**

L3 discovers Cashu mints through Nostr relays using the NIP-87 protocol (kind 38172 events).

### Discovery Flow

1. Query 3 Nostr relays in parallel: `relay.primal.net`, `relay.damus.io`, `nos.lol`
2. Filter for kind 38172 events (Cashu mint info)
3. Extract mint URLs from `"u"` tags
4. Deduplicate by URL, keep latest event per mint
5. Verify each mint is alive by probing `/v1/info` through the CORS proxy
6. Enrich with known operator Bitcoin addresses for Allium scoring
7. Sort: known operators first, then alphabetically

### Fallback

If all relays fail, falls back to 6 seed mints: Minibits, Coinos, 0xChat, LN Voltz, Kinda Reckless Mint, lnwCash.

---

## On-Chain Intelligence (Allium)

**Files: `src/core/network.ts` + `api/allium.js`**

The Allium Labs API provides on-chain wallet data for mint operator addresses, contributing 30% of the trust score weight.

### Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /wallet/transactions` | Transaction history for operator address |
| `POST /wallet/balances` | Current BTC holdings |
| `POST /wallet/balances/history` | 1-year historical balance trend |

### Rate Limit Management

- **Batched scoring**: 2 mints scored concurrently (not all 6 at once)
- **Response caching**: 5-minute TTL in-memory cache
- **429 backoff**: 3s × attempt exponential backoff on rate limits
- **30s timeout**: Prevents Allium slowness from blocking scoring
- **Server-side proxy**: API key never exposed to the browser

---

## Discord Alert System

**File: `server/discordNotifier.ts` (84 lines)**

Real-time Discord notifications for trust events using Discord REST API v10.

### Alert Types

| Type | Color | Trigger |
|------|-------|---------|
| `critical` | Red | Score drops below 50 |
| `score_drop` | Orange | Score drops ≥ 10 points |
| `migration_suggested` | Blue | Migration recommended (alert mode) |
| `migration_executed` | Green | Migration completed (auto mode) |
| `recovery` | Green | Previously critical mint recovers above 75 |

Each alert is sent as a rich embed with mint name, current score, previous score, and action taken.

---

## File Structure

```
webapp/
├── src/
│   ├── core/                          # Core engine logic (pure functions)
│   │   ├── trustEngine.ts             # 11-signal composite scoring + MVO allocation
│   │   ├── migrationEngine.ts         # Conservative migration decision logic
│   │   ├── alertEngine.ts             # Score change detection + alert generation
│   │   ├── mintDiscovery.ts           # NIP-87 Nostr relay mint discovery
│   │   ├── network.ts                 # Fetch wrapper (timeout, retry, Allium cache)
│   │   ├── simulationEngine.ts        # Scenario stress testing
│   │   ├── walletApi.ts               # Frontend API client for wallet operations
│   │   ├── config.ts                  # Weights, thresholds, mint registry
│   │   └── eventBus.ts                # Event bus system
│   │
│   ├── state/                         # Application state management
│   │   ├── store.tsx                  # React Context + useReducer, 60s scoring loop
│   │   ├── types.ts                   # TypeScript interfaces (MintScore, TrustAlert, etc.)
│   │   └── selectors.ts              # State selectors
│   │
│   ├── ui/
│   │   ├── screens/                   # Full-page views
│   │   │   ├── Home.tsx               # Main entry with educational content
│   │   │   ├── DashboardScreen.tsx    # KPIs, charts, portfolio overview
│   │   │   ├── WalletScreen.tsx       # Receive/send/balances
│   │   │   ├── MintsScreen.tsx        # Mint registry and scores
│   │   │   ├── AlertsScreen.tsx       # Alert management
│   │   │   ├── MigrationsScreen.tsx   # Migration history log
│   │   │   ├── SimulationScreen.tsx   # Stress test scenarios
│   │   │   └── MintSettings.tsx       # Mint configuration
│   │   │
│   │   ├── components/                # Reusable UI components
│   │   │   ├── ReceivePanel.tsx       # Lightning invoice generation + QR code
│   │   │   ├── SendPanel.tsx          # Lightning payment (smart routing)
│   │   │   ├── MintTable.tsx          # Tabular mint listing with scores
│   │   │   ├── MintCard.tsx           # Individual mint detail card
│   │   │   ├── AlertPanel.tsx         # Alert display + dismiss/approve
│   │   │   ├── AutomationControl.tsx  # Auto/alert/manual mode toggle
│   │   │   ├── DemoModeSelector.tsx   # Mutinynet/testnet/mainnet switch
│   │   │   ├── SimulationPanel.tsx    # Degradation scenario controls
│   │   │   ├── PortfolioSplitPanel.tsx# Allocation visualization
│   │   │   ├── AllocationPie.tsx      # Pie chart of portfolio split
│   │   │   ├── ScoreChart.tsx         # Score trend visualization
│   │   │   ├── KpiCard.tsx            # Single KPI metric card
│   │   │   ├── MigrationLog.tsx       # Migration history entries
│   │   │   ├── TrustSpectrum.tsx      # Color gradient score spectrum
│   │   │   ├── ThreeCurvesChart.tsx   # Multi-curve chart
│   │   │   ├── WalletConnectPanel.tsx # Wallet initialization
│   │   │   ├── WalletInput.tsx        # Address input component
│   │   │   ├── FedimintArchitecture.tsx # Educational Fedimint diagram
│   │   │   └── MathTheory.tsx         # Mathematical explanation panel
│   │   │
│   │   └── layout/                    # App shell and navigation
│   │       ├── AppShell.tsx           # Main container with sidebar
│   │       ├── Sidebar.tsx            # Navigation sidebar
│   │       └── TopBar.tsx             # Header with controls
│   │
│   ├── lib/                           # Utility libraries
│   │   ├── bip39.ts                   # BIP39 seed phrase utilities
│   │   ├── formatters.ts             # Number/date formatting
│   │   ├── stats.ts                   # Normal CDF, statistical functions
│   │   └── theme.ts                   # Design system colors
│   │
│   ├── App.tsx                        # Root component
│   └── main.tsx                       # Vite entry point
│
├── api/                               # Vercel Serverless Functions
│   ├── wallet/[action].js             # Cashu wallet operations + Blob persistence
│   ├── allium.js                      # Allium API proxy (server-side key)
│   └── cashu-proxy.js                 # CORS proxy for Cashu mint endpoints
│
├── server/                            # Express server (local dev / Railway)
│   ├── index.ts                       # Express routes + middleware
│   ├── walletEngine.ts                # Server-side wallet state machine
│   ├── discordNotifier.ts            # Discord REST API v10 integration
│   └── config.ts                      # Server environment config
│
├── public/                            # Static assets
│   ├── favicon.svg
│   └── icons.svg
│
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── eslint.config.js
└── index.html
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19, TypeScript 6, Vite 8 | UI framework and build tooling |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **Charts** | Recharts, Lightweight Charts | Score visualization and portfolio charts |
| **Icons** | Lucide React | UI iconography |
| **QR Codes** | qrcode.react | Lightning invoice QR generation |
| **Wallet** | @cashu/cashu-ts 3.6 | Cashu ecash protocol (mint/melt/migrate) |
| **On-Chain Data** | Allium Labs API | Wallet transactions, balances, history |
| **Mint Discovery** | WebSocket (ws) + Nostr NIP-87 | Decentralized mint registry |
| **Serverless** | Vercel Functions | Wallet operations + API proxies |
| **Storage** | Vercel Blob | Durable ecash proof persistence |
| **Notifications** | Discord REST API v10 | Real-time trust alerts |
| **Statistics** | Custom (lib/stats.ts) | Gaussian CDF for probabilistic grading |
| **Server** | Express 5 | Local dev and Railway deployment |

---

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd webapp
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys (see below)

# Run locally (Vite dev server)
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

### Network Modes

| Mode | Description | Use For |
|------|-------------|---------|
| **Mutinynet** | Signet testnet (free sats) | Development and testing |
| **Testnet** | Bitcoin testnet | Integration testing |
| **Mainnet** | Real Bitcoin | Production use with real funds |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ALLIUM_API_KEY` | For dev | Allium API key (client-side, dev only) |
| `ALLIUM_API_KEY` | For prod | Allium API key (server-side proxy) |
| `BLOB_READ_WRITE_TOKEN` | For prod | Vercel Blob token (auto-provisioned via Marketplace) |
| `DISCORD_BOT_TOKEN` | Optional | Discord bot token for alert notifications |
| `DISCORD_CHANNEL_ID` | Optional | Discord channel for alerts |

---

## How It All Connects

1. **On page load**: NIP-87 queries Nostr relays → discovers mints → initializes wallet connections
2. **Every 60 seconds**: Probes all mints → queries Allium for on-chain data → computes 11-signal scores → generates alerts → executes migrations if in auto mode
3. **On receive**: Generates Lightning invoice at highest-scoring mint → polls for payment → saves proofs to Blob
4. **On send**: Finds riskiest funded mint → pays Lightning invoice → saves updated proofs to Blob
5. **On migration trigger**: Melts ecash at source mint → Lightning payment → Mints new ecash at target → saves proofs to Blob
6. **On cold start**: Loads proofs from Blob → reinitializes wallet → resumes normal operation with funds intact
