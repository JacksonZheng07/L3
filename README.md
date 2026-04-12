# L3 — Bitcoin Portfolio Risk Engine

A real-time trust scoring and automated migration engine for Bitcoin ecash (Cashu) mints. L3 continuously monitors mint health, scores trustworthiness, and automatically moves funds away from risky mints to protect your portfolio.

Built for the **MIT Bitcoin Hackathon 2026**.

## What It Does

- **Trust Scoring** — Scores each Cashu mint on a 0–100 scale using uptime probing, latency measurement, keyset stability, and on-chain intelligence (via Allium Labs API). Runs automatically every 60 seconds.
- **Automated Migration** — When a mint's trust score drops below safe thresholds, funds are automatically moved to safer mints via Lightning Network. Conservative approach: only evacuate critical mints (<50 score) and cap exposure to warning mints (50–74) at 25%.
- **Real Lightning Payments** — Receive sats via Lightning invoice, send to any Lightning address, and migrate between mints using real ecash proofs (Cashu protocol).
- **Durable Wallet** — Ecash proofs (which ARE the money) are persisted to Vercel Blob storage, surviving serverless cold starts.
- **Risk Dashboard** — Live visualization of mint scores, portfolio allocation, VaR analysis, and migration history.
- **Multi-Mode** — Supports Mutinynet (testnet), Testnet, and Mainnet modes.
- **Discord Alerts** — Automated notifications for score changes and migrations.

## Architecture

```
Frontend (Vite + React + TypeScript + Tailwind)
  ├── Trust Engine     — Composite scoring with weighted signals
  ├── Migration Engine — Hysteresis-based decision logic
  ├── Alert Engine     — Score change detection + Discord webhook
  └── Wallet API Client
          │
          ▼
Vercel Serverless Functions
  ├── /api/wallet/*    — Cashu wallet operations (receive/send/migrate)
  ├── /api/allium      — On-chain data proxy (keeps API key server-side)
  └── /api/cashu-proxy — CORS proxy for mint endpoints
          │
          ▼
Vercel Blob Storage    — Durable ecash proof persistence
```

### Scoring Signals

| Signal | Weight | Source |
|--------|--------|--------|
| Uptime (is the mint responding?) | 25% | Direct probe to /v1/info |
| Latency (how fast?) | 15% | Response time measurement |
| Keyset Stability (rotating keys?) | 15% | /v1/keysets diffing |
| On-chain Transaction History | 30% | Allium Labs API |
| Community/NIP-87 Discovery | 15% | Nostr relay discovery |

### Migration Logic

1. **Evacuate** critical mints (score < 50) — move all funds out
2. **Reduce** overexposure to warning mints (score 50–74) — cap at 25% of portfolio
3. **Leave safe mints alone** — no rebalancing between safe mints (avoids unnecessary Lightning fees)

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Recharts
- **Wallet**: @cashu/cashu-ts (Cashu ecash protocol)
- **On-chain Data**: Allium Labs API (wallet transactions, balances, history)
- **Deployment**: Vercel (serverless functions + Blob storage)
- **Mint Discovery**: NIP-87 (Nostr relay-based mint discovery)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your ALLIUM_API_KEY and BLOB_READ_WRITE_TOKEN

# Run locally
npm run dev

# Build
npm run build

# Deploy to Vercel
vercel --prod
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_ALLIUM_API_KEY` | Allium Labs API key (dev mode, direct calls) |
| `ALLIUM_API_KEY` | Allium Labs API key (production, server-side proxy) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token (auto-provisioned) |

## Live Demo

**https://mit-bitcoin.vercel.app**
