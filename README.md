# L3 — Liquidity Load Layer

A real-time trust scoring and automated migration engine for Bitcoin ecash (Cashu) mints. L3 continuously monitors mint health across 11 weighted signals, models each score as a Gaussian distribution, computes MVO-optimal portfolio allocations, and automatically moves funds away from risky mints via the Lightning Network to protect your portfolio.

Built for the **MIT Bitcoin Hackathon 2026**.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Why This Exists](#why-this-exists)
- [Architecture](#architecture)
- [Complete Tech Stack](#complete-tech-stack)
- [The Trust Scoring System](#the-trust-scoring-system)
  - [Signal Definitions](#signal-definitions)
  - [Why These Weights](#why-these-weights)
  - [Composite Score as a Gaussian Distribution](#composite-score-as-a-gaussian-distribution)
  - [Probabilistic Grading via Gaussian CDF](#probabilistic-grading-via-gaussian-cdf)
  - [Score Momentum (Velocity)](#score-momentum-velocity)
- [Portfolio Allocation](#portfolio-allocation)
  - [MVO-Optimal (Tangency Portfolio)](#mvo-optimal-tangency-portfolio)
  - [Kelly Criterion (Second Opinion)](#kelly-criterion-second-opinion)
  - [Cap and Redistribute](#cap-and-redistribute)
- [Risk Analytics](#risk-analytics)
  - [Value-at-Risk (VaR)](#value-at-risk-var)
  - [Conditional VaR / Expected Shortfall](#conditional-var--expected-shortfall)
  - [Diversification Proof (Three Curves)](#diversification-proof-three-curves)
- [Migration Decision Engine](#migration-decision-engine)
  - [Hysteresis-Based Logic](#hysteresis-based-logic)
  - [Migration Execution via Lightning](#migration-execution-via-lightning)
- [Cashu Wallet Engine](#cashu-wallet-engine)
- [Mint Discovery via NIP-87 (Nostr)](#mint-discovery-via-nip-87-nostr)
- [On-Chain Intelligence (Allium Labs)](#on-chain-intelligence-allium-labs)
- [Bayesian Treatment of Anonymous Mints](#bayesian-treatment-of-anonymous-mints)
- [Simulation Engine](#simulation-engine)
- [Alert System and Discord Integration](#alert-system-and-discord-integration)
- [Deployment](#deployment)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)

---

## High-Level Overview

L3 solves a fundamental problem in the Cashu ecash ecosystem: **there is no standardized way to assess whether a mint is safe to hold funds in**. A mint operator can go offline, drain reserves, rotate cryptographic keys to invalidate tokens, or simply disappear. Users currently rely on word-of-mouth reputation with no quantitative backing.

L3 provides:

1. **Continuous trust scoring** — 11 signals from two independent data sources (direct probing + Allium on-chain intelligence) are combined into a composite Gaussian distribution per mint
2. **Mathematically optimal allocation** — Mean-Variance Optimization (MVO) determines what percentage of your portfolio each mint should hold, penalizing uncertainty quadratically
3. **Automated risk mitigation** — When a mint's trust score drops below safe thresholds, funds are automatically moved to safer mints via Lightning Network invoices
4. **Probabilistic reasoning** — Instead of hard cutoffs, every grade is a probability (pSafe, pWarning, pCritical) computed from the score's Gaussian CDF

The entire pipeline runs on a 60-second scoring cycle.

---

## Why This Exists

Cashu is a Chaumian ecash protocol for Bitcoin. Ecash tokens are bearer instruments — whoever holds the cryptographic proofs owns the sats. The mint operator holds the real Bitcoin and issues blinded signatures as ecash tokens. This creates a custodial trust problem:

- **Rug pull risk** — The operator controls the reserves. They can drain the Bitcoin and the ecash becomes worthless.
- **Key rotation attacks** — Changing keysets can silently invalidate all outstanding tokens.
- **Silent degradation** — A mint can appear online while its reserves are declining.

L3 addresses all three by combining real-time operational probing with deep on-chain intelligence. The on-chain signals (reserve behavior, transaction patterns) are specifically designed to catch scenarios that uptime monitoring alone would miss — a mint can have 100% uptime right up until the moment it rugs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Vite + React 19 + TypeScript + Tailwind CSS 4)       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Trust Engine  │  │ Migration Engine  │  │ Simulation       │   │
│  │ 11 signals    │  │ Hysteresis logic  │  │ Engine           │   │
│  │ Gaussian CDF  │  │ Phase 1: evacuate │  │ 5 preset         │   │
│  │ MVO alloc     │  │ Phase 2: reduce   │  │ scenarios        │   │
│  │ Kelly sizing  │  │ Phase 3: no-op    │  │ + progressive    │   │
│  └──────┬───────┘  └──────┬───────────┘  │ degradation      │   │
│         │                  │              └──────────────────┘   │
│  ┌──────┴───────┐  ┌──────┴───────────┐  ┌──────────────────┐   │
│  │ Alert Engine  │  │ Wallet API Client│  │ Event Bus        │   │
│  │ Score drops   │  │ (REST → server)  │  │ Typed pub/sub    │   │
│  │ Recoveries    │  │                  │  │                  │   │
│  │ Migrations    │  │                  │  │                  │   │
│  └──────────────┘  └──────┬───────────┘  └──────────────────┘   │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │  HTTP/JSON
┌────────────────────────────┼─────────────────────────────────────┐
│  Express 5 Server (tsx)    │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────┐                        │
│  │ /api/wallet/*  — Cashu wallet ops     │                       │
│  │   receive, send, migrate, balances    │                       │
│  │   Smart routing by trust score        │                       │
│  ├───────────────────────────────────────┤                       │
│  │ /api/allium    — On-chain data proxy  │  (keeps API key       │
│  │   Allowlisted endpoints only          │   server-side)        │
│  ├───────────────────────────────────────┤                       │
│  │ /api/cashu-proxy — CORS proxy         │  (mints don't set     │
│  │   Any mint → server fetches → client  │   CORS headers)       │
│  ├───────────────────────────────────────┤                       │
│  │ /api/discord/*  — Discord notifier    │                       │
│  │   Rich embeds via REST API v10        │                       │
│  └──────────────────────────────────────┘                        │
│                                                                  │
│  ┌──────────────────────────┐  ┌────────────────────────────┐    │
│  │ Wallet Engine             │  │ File-based proof storage    │   │
│  │ @cashu/cashu-ts ^3.6     │  │ data/proofs_{mode}.json    │    │
│  │ Mint + Wallet instances  │  │ Survives server restarts   │    │
│  │ per connected mint       │  │                            │    │
│  └──────────────────────────┘  └────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   ┌───────────┐                 ┌──────────────┐
   │ Cashu Mints│                │ Allium Labs   │
   │ /v1/info   │                │ Wallet API    │
   │ /v1/keysets │                │ Transactions  │
   │ mint/melt  │                │ Balances      │
   │ proofs     │                │ History       │
   └───────────┘                 └──────────────┘
```

### Why This Architecture

- **Express server with Vite middleware** — In development, Vite runs as Express middleware inside a single process. This avoids CORS issues between separate dev servers and gives the wallet engine a persistent process (ecash proofs must stay in memory or be saved to disk). In production, Express serves the pre-built Vite output as static files.

- **Server-side wallet** — Ecash proofs ARE the money. They cannot be stored in the browser (tab close = funds lost). The wallet engine lives on the server, proofs are persisted to disk, and the frontend communicates via REST API. The client never sees raw proofs.

- **CORS proxy** — Cashu mints are independent HTTP servers that don't set CORS headers. The browser cannot call them directly. All mint probing and wallet operations go through the Express server.

- **Allium proxy** — The Allium API key must stay server-side. The frontend calls `/api/allium?endpoint=...` and the server forwards the request with the API key injected.

---

## Complete Tech Stack

### Frontend

| Technology | Version | Why |
|---|---|---|
| **React** | 19.2 | Component model for complex dashboard UI. React 19's improved concurrent rendering handles the 60-second scoring cycle updates without jank. |
| **TypeScript** | 6.0 | Full type safety across all 11 scoring signals, state types, and API contracts. The `MintScore` type alone has 18 typed fields — this would be unmaintainable in plain JS. |
| **Vite** | 8.0 | Sub-second HMR during development. Used as Express middleware (not standalone) so the frontend and wallet server share a single process. |
| **Tailwind CSS** | 4.2 | Utility-first styling with the Vite plugin for zero-config integration. The dashboard has ~30 components — Tailwind keeps styles colocated without CSS file sprawl. |
| **Recharts** | 3.8 | Declarative charting for score timelines, allocation pie charts, and the Three Curves diversification visualization. Built on D3 but with React components. |
| **Lightweight Charts** | 5.1 | TradingView's financial chart library for real-time score tracking with candlestick-style rendering. |
| **Lucide React** | 1.8 | Consistent icon set (AlertTriangle, Shield, TrendingDown, etc.) used throughout the dashboard for visual signal indicators. |
| **QRCode.react** | 4.2 | Renders Lightning invoices as scannable QR codes for the wallet receive flow. |

### Backend

| Technology | Version | Why |
|---|---|---|
| **Express** | 5.2 | Mature HTTP framework. Express 5 has native async error handling. Serves as both API server and static file host in production. |
| **tsx** | 4.21 | Runs TypeScript directly in Node.js without a compile step. In development, `tsx watch` provides auto-restart on file changes. |
| **@cashu/cashu-ts** | 3.6 | Official TypeScript implementation of the Cashu ecash protocol. Provides `Mint`, `Wallet`, `Proof` types and handles all cryptographic operations (blinded signatures, DLEQ proofs, token minting/melting). |
| **Node.js** | >=22.12 | Required for native `fetch` (used by Discord notifier and Allium proxy without any HTTP client dependency) and `crypto.randomUUID()`. |

### Data Sources

| Source | What It Provides | Why |
|---|---|---|
| **Allium Labs API** | On-chain wallet transactions, balances, historical balance trends, entity labels, DeFi activity classification | On-chain data is the hardest signal to fake. A mint can have perfect uptime while draining reserves — only on-chain intelligence catches this. Allium's entity labeling (3M+ labeled addresses) lets us verify operator identity without relying on self-reported claims. |
| **Cashu Mint /v1/info** | Mint name, version, NUT capabilities, contact info, MOTD | Direct probe of operational health. Response time doubles as latency measurement. NUT capability list reveals how feature-complete the implementation is. |
| **Cashu Mint /v1/keysets** | Active cryptographic keyset IDs | Keysets are the mint's signing keys. Unexpected changes can indicate key rotation attacks or compromises. We diff against cached keysets each cycle. |
| **Nostr Relays (NIP-87)** | Live mint registrations (kind 38172 events) | Decentralized mint discovery. NIP-87 is the Cashu ecosystem's standard for announcing mints via Nostr. We query 3 relays (primal.net, damus.io, nos.lol) in parallel and verify each discovered mint is alive before including it. |

### Infrastructure

| Technology | Why |
|---|---|
| **Docker** (multi-stage build) | Two-stage Dockerfile: build stage compiles TypeScript and bundles Vite, runtime stage copies only artifacts. Final image is `node:22-slim`. |
| **Railway** | Container hosting with Dockerfile builder. The `railway.json` config points to the Dockerfile and sets `npx tsx server/index.ts` as the start command. |

### Research / Prototyping

| Technology | Why |
|---|---|
| **Python** (weightinglogic.py) | Initial scoring algorithm prototyped in Python with NumPy, Pandas, and Matplotlib before being ported to TypeScript. The Python version served as the proof-of-concept and still works as a standalone scoring script. |
| **Jupyter Notebook** (L3_Analysis.ipynb) | Data analysis and visualization of scoring distributions, used to validate the math before implementing it in the webapp. |

---

## The Trust Scoring System

### Signal Definitions

L3 evaluates each mint across 11 signals, organized into two categories based on data source:

#### Allium On-Chain Signals (30% total weight)

These signals come from querying the Allium Labs API with the mint operator's known Bitcoin addresses. They capture **structural health** — things that are expensive or impossible to fake.

| Signal | Weight | What It Measures | Scoring Logic |
|---|---|---|---|
| **Operator Identity** | 10% | Is the operator a known entity? How old/active is their wallet? | Entity labels (+0.4), wallet age tiers (>1yr: +0.3, >6mo: +0.2, >1mo: +0.1), transaction count tiers (>1000: +0.2, >100: +0.1), balance tiers (>$10k: +0.1, >$1k: +0.05) |
| **Reserve Behavior** | 10% | Are on-chain reserves stable, growing, or declining? | Current BTC balance check (+0.2 if present, -0.2 if absent), historical trend analysis (growing: +0.3, minor decline: +0.1, significant decline -20%+: -0.2, severe decline -50%+: -0.4), sudden single-period drops >30%: -0.3 |
| **Transaction Patterns** | 5% | Are transaction patterns normal or suspicious? | Counterparty diversity (>100: +0.25, >20: +0.15, >5: +0.05, <5: -0.20), circular flow ratio (>50%: -0.20 possible wash trading, <20%: +0.10 normal), volume tiers |
| **Counterparty Network** | 5% | Does the operator transact with known legitimate entities? | Entity labels on counterparties (+0.3), recognized DeFi activity (dex_trade, asset_bridge, etc.: +0.2) |

#### Direct Probe Signals (70% total weight)

These signals come from directly probing the mint's HTTP endpoints. They capture **operational health** — what's happening right now.

| Signal | Weight | What It Measures | Scoring Logic |
|---|---|---|---|
| **Availability** | 15% | Is the mint responding to /v1/info? | Binary: 1.0 if online, 0.0 if unreachable. sigma=0.05 (near-certain). |
| **Latency** | 10% | How fast does the mint respond? | Continuous linear decay: `1 - (ms / 3000)`. 0ms=1.0, 3000ms=0.0. Produces real spread between mints. |
| **Keyset Stability** | 10% | Have cryptographic signing keys changed unexpectedly? | 1.0 if keysets match cached state, 0.0 if any keysets added or removed. Keyset changes can indicate maintenance (benign) or token invalidation (malicious). |
| **TX Success Rate** | 10% | What percentage of wallet operations succeed? | >98%: 1.0, >95%: 0.7, >90%: 0.4, <90%: 0.0. Sigma decreases with sample size (CLT): >500 ops: 0.05, >50: 0.12, default: 0.20. |
| **Protocol Version** | 5% | Is the mint running current Cashu software? | 1.0 if version starts with `0.15` (current stable), 0.5 if different version reported, 0.2 if no version reported. |
| **NUT Capabilities** | 10% | Which Cashu NUTs does the mint support? | Base 0.25 for responding. NUT-04 mint: +0.10, NUT-05 melt: +0.15, NUT-07 state-check: +0.15, NUT-09 restore: +0.10, NUT-10 conditions: +0.05, NUT-11 P2PK: +0.05, NUT-12 DLEQ: +0.10, NUT-14 HTLC: +0.05. |
| **Metadata Quality** | 10% | Does the operator provide accountability information? | Name >2 chars: +0.20, description >20 chars: +0.20, contact methods: +0.20, verifiable contact (email/twitter/nostr/url): +0.10, MOTD: +0.10. |

### Why These Weights

The 30/70 split between on-chain and direct signals reflects a deliberate design decision:

**On-chain signals are weighted lower (30%) because they are optional.** Many Cashu mint operators are anonymous — they don't publish their Bitcoin addresses. If we weighted on-chain data at 60%, anonymous mints would be capped at ~40/100 regardless of operational excellence. The 30% weight means anonymous mints can still reach ~70/100 through perfect operational health, which is more fair while still rewarding transparency.

**Direct signals are weighted higher (70%) because they are always computable.** Every mint exposes `/v1/info` and `/v1/keysets` per the Cashu protocol spec. The NUT capabilities and metadata signals were specifically added because they produce real differentiation between mints — unlike binary signals (up/down), these vary continuously across the ecosystem.

**Within on-chain signals**, operator identity and reserve behavior are weighted equally at 10% each because they catch different failure modes: identity catches unknown operators, reserves catch active draining.

**Within direct signals**, availability gets the highest weight (15%) because it's the most consequential binary fact — if the mint is down, nothing else matters.

### Composite Score as a Gaussian Distribution

Each signal carries both a **point estimate** (value, 0-1) and an **uncertainty** (sigma, 0-0.5). The composite score is not just a number — it's modeled as a normal distribution:

```
Composite μ = Σ(value_i × weight_i) × 100
Composite σ = √(Σ(weight_i × sigma_i)²) × 100
```

The sigma propagation follows standard error propagation for a weighted sum of independent random variables:

```
Var(Σ w_i X_i) = Σ w_i² Var(X_i)
               = Σ (w_i × σ_i)²
```

This gives us `Score ~ N(μ, σ²)`, where:
- **μ** is the composite score (0-100)
- **σ** (scoreSigma) quantifies how certain we are about that score

A verified mint with extensive Allium data might have σ ≈ 5. An anonymous mint with no on-chain data has σ ≈ 14.6. This uncertainty difference drives the allocation algorithm — it's not just about the score, it's about how much we trust the score.

### Probabilistic Grading via Gaussian CDF

Instead of hard cutoffs (score >= 75 = safe), grades are probabilities computed from the Gaussian CDF:

```
pSafe     = 1 - Φ((75 - μ) / σ)     // P(true score ≥ 75)
pCritical =     Φ((50 - μ) / σ)     // P(true score < 50)
pWarning  = 1 - pSafe - pCritical   // remainder
grade     = argmax(pSafe, pWarning, pCritical)
```

The CDF (Φ) is implemented using the Abramowitz & Stegun rational approximation to the error function (max error 1.5×10⁻⁷):

```typescript
function erf(x: number): number {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p   =  0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5*t + a4)*t + a3)*t + a2)*t + a1)*t) * Math.exp(-x*x);
  return (x >= 0 ? 1 : -1) * y;
}

Φ(x, μ, σ) = 0.5 × (1 + erf((x - μ) / (σ√2)))
```

**Why probabilistic grades matter**: A mint scoring 73/100 with σ=3 has pSafe ≈ 25%, so it's graded "warning". The same score with σ=15 has pSafe ≈ 45% — more uncertainty means a more moderate grade. This prevents overconfident grading when data is sparse.

### Score Momentum (Velocity)

Each scoring cycle computes a velocity and momentum-adjusted score:

```
velocity       = current_score - previous_score
adjustedScore  = clamp(compositeScore + λ × velocity, 0, 100)
```

Where λ = 0.3 (momentum weight). This means:
- A mint improving by 5 points gets a +1.5 point boost in the allocation formula
- A mint declining by 10 points gets a -3 point penalty
- The effect is small enough to not override the fundamental score, but large enough to bias allocation toward improving mints

---

## Portfolio Allocation

### MVO-Optimal (Tangency Portfolio)

The primary allocation algorithm is the tangency portfolio solution from Mean-Variance Optimization (Markowitz, 1952). For uncorrelated assets with Gaussian returns, the optimal weight vector is:

```
w_i* ∝ (μ_i - r_f) / σ_i²
```

In L3's context:
- **μ_i** = momentum-adjusted score (adjustedScore)
- **r_f** = warning threshold (50) — the "risk-free" boundary below which we don't allocate
- **σ_i** = score uncertainty (scoreSigma), floored at 2 to prevent division blow-up

The key insight is dividing by **σ²** (variance), not σ. This penalizes uncertainty **quadratically**:

```
Verified mint:   σ = 5   → σ² = 25
Anonymous mint:  σ = 14.6 → σ² = 213.16

Same score, same excess return:
  verified weight   ∝ (μ - 50) / 25   = 8.5× more allocation
  anonymous weight  ∝ (μ - 50) / 213.16
```

An anonymous mint at the same score gets 8.5× less allocation than a verified mint. With linear Sharpe (÷σ), the ratio would only be 2.9×. The quadratic penalty correctly reflects that we should be much more cautious when we're uncertain about a score.

### Kelly Criterion (Second Opinion)

As a cross-check, L3 also computes Kelly-criterion sizing:

```
kelly_i = max(0, 2 × pSafe_i - 1)
```

Then normalized across all eligible mints and capped at 40%. This is derived from the Kelly formula for binary bets: if pSafe is the probability of a "win" (mint stays safe) and pCritical is the probability of a "loss" (mint fails), the optimal fraction to bet is `2p - 1` for even payoffs.

The Kelly allocation is displayed alongside MVO allocation for comparison. When they diverge significantly, it flags that one method's assumptions may not hold well for a particular mint.

### Cap and Redistribute

Both allocation methods are subject to a **40% maximum per mint** (MAX_ALLOCATION = 0.40). This enforces minimum diversification — no single mint can hold more than 40% of the portfolio regardless of its score.

The cap is applied iteratively:

```
repeat up to 20 times:
  for each mint with allocation > 40%:
    excess = allocation - 40%
    set allocation = 40%
    redistribute excess proportionally among mints still under cap
  stop when no mint exceeds 40%
```

The iterative approach handles cascading caps correctly (if redistributing excess pushes another mint over 40%, the next iteration catches it).

---

## Risk Analytics

### Value-at-Risk (VaR)

L3 computes Gaussian VaR at the portfolio level:

```
VaR_α = μ_loss + z_α × σ_loss
```

Where:
- **μ_loss** = Σ(exposure_i × (1 - score_i / 100)) — expected loss across all mints
- **σ_loss** = √(Σ((exposure_i / 100)² × scoreSigma_i²)) — portfolio loss standard deviation (assuming signal independence across mints)
- **z_α** = quantile of the standard normal (1.645 for 95%, 1.960 for 97.5%, 2.326 for 99%)

VaR_95 answers: "What is the loss level that is exceeded with only 5% probability?"

### Conditional VaR / Expected Shortfall

CVaR (also called Expected Shortfall) answers a harder question: "Given that we ARE in the worst 5%, what's the expected loss?"

```
CVaR_α = μ_loss + σ_loss × φ(z_α) / α
```

Where φ is the standard normal PDF. CVaR is always ≥ VaR and is a coherent risk measure (unlike VaR, which can violate subadditivity).

### Diversification Proof (Three Curves)

The dashboard includes a "Three Curves" visualization that proves diversification mathematically:

1. **Random Single Mint** — Gaussian centered at the average score, σ=25 (high uncertainty)
2. **Best Single Mint** — Gaussian centered at the best score, σ=18 (moderate uncertainty)
3. **L3 Diversified** — Gaussian centered at the allocation-weighted average score, σ = 18/√N (uncertainty reduced by √N diversification)

The L3 curve is always taller and narrower than either single-mint curve, visually demonstrating that diversification reduces variance by 1/√N (the central limit theorem applied to portfolio construction).

---

## Migration Decision Engine

### Hysteresis-Based Logic

Migration decisions use a conservative, two-phase approach with hysteresis to prevent oscillation:

**Phase 1 — Evacuate Critical Mints (score < 50)**

Any mint with a composite score below 50 is considered genuinely dangerous. All funds are moved out to the highest-scored safe target.

**Phase 2 — Reduce Overexposure to Warning Mints (score 50-74)**

Warning mints aren't immediately dangerous, but allocation is capped at 25% of the portfolio. Only the excess above 25% is moved.

**Phase 3 — Leave Safe Mints Alone**

There is no Phase 3. Safe mints (score ≥ 75) are never rebalanced between each other. Every migration costs Lightning routing fees, so we don't churn for marginal gains.

**Hysteresis**: A mint scoring 49 triggers evacuation, but to be an eligible *target* for receiving migrated funds, a mint must score ≥ 60 (threshold + hysteresis of 10). This prevents ping-pong between borderline mints:

```
Evacuate when:  score < 50
Eligible target: score >= 50 + 10 = 60 AND grade === 'safe' AND isOnline
```

### Migration Execution via Lightning

The actual migration is a 5-step atomic process:

1. **Get Lightning invoice** from the destination mint (`createMintQuoteBolt11`)
2. **Get melt quote** from the source mint to pay that invoice (`createMeltQuoteBolt11`)
3. **Select proofs and melt** — choose ecash proofs from the source wallet, burn them to pay the Lightning invoice
4. **Save change proofs** — the source mint returns unused fee reserve as change proofs
5. **Mint new proofs** at the destination — the destination mint saw the payment arrive, issues fresh ecash

If the source balance can't cover amount + worst-case fee, the migration automatically retries with a reduced amount (amount - fee_reserve).

---

## Cashu Wallet Engine

The server-side wallet engine (`walletEngine.ts`) manages:

- **Mint/Wallet instances** — One `Mint` and `Wallet` object per connected mint, from `@cashu/cashu-ts`
- **Proof storage** — Ecash proofs (the actual money) are stored in `data/proofs_{mode}.json` on disk, surviving server restarts
- **Multi-mode operation** — Supports Mutinynet (testnet), Testnet, and Mainnet modes. Mode switching saves current proofs and loads the new mode's proofs.

### Smart Receive

When receiving sats, L3 routes the Lightning invoice to the highest-scored online mint:

```
eligible = scores.filter(online AND not critical)
           .sort(by compositeScore descending)
```

Falls back to any connected mint if no scores are available yet.

### Smart Send

When sending sats, L3 prioritizes draining the **least-trusted** mint first (draining risky mints is a feature, not a bug):

```
riskiest_first = funded_mints.sort(by compositeScore ascending)
for each mint in riskiest_first:
  if mint.balance >= estimated_cost: pay from this mint
```

If no single mint has enough balance, it consolidates funds into the safest mint via migration, then pays.

### BIP-39 Seed Derivation

Wallet seed generation uses the BIP-39 standard with Web Crypto API:

```
PBKDF2-HMAC-SHA512(mnemonic, "mnemonic" + passphrase, 2048 iterations) → 64-byte seed
```

This is intentionally lightweight (no wordlist validation) for the hackathon context but follows the correct cryptographic derivation.

---

## Mint Discovery via NIP-87 (Nostr)

L3 discovers live Cashu mints through the decentralized Nostr network:

1. **Query 3 relays in parallel** (relay.primal.net, relay.damus.io, nos.lol) for NIP-87 kind 38172 events
2. **Deduplicate by URL** across relay results
3. **Verify each mint is alive** by probing `/v1/info` through the CORS proxy
4. **Enrich with known operator addresses** from a lookup table of 8 known operators
5. **Sort known operators first** — mints with Allium-queryable addresses are prioritized

Falls back to a hardcoded seed list of 6 known-good mints if relay queries return nothing.

**Why NIP-87**: It's the Cashu ecosystem's standard for mint discovery. Using Nostr relays means L3 doesn't depend on any centralized mint registry — mints announce themselves, and L3 discovers them.

---

## On-Chain Intelligence (Allium Labs)

Allium provides three API endpoints that L3 uses for each mint operator's Bitcoin address:

| Endpoint | What It Returns | What L3 Does With It |
|---|---|---|
| `/wallet/transactions` | Transaction history, entity labels, asset transfers, activity types | Operator identity scoring (labels, age, activity), transaction pattern analysis (counterparty diversity, circular flow detection), counterparty network quality |
| `/wallet/balances` | Current token balances with USD values | Reserve adequacy check — does the operator hold enough BTC to back issued ecash? |
| `/wallet/balances/history` | Historical balance snapshots over 1 year | Reserve trend analysis — is the balance stable, growing, or declining? Sudden drops >30% in a single period trigger critical alerts. |

**Rate limiting**: Allium responses are cached for 5 minutes (on-chain data changes slowly). The 60-second scoring cycle means at most 1 API call per mint per 5 minutes. With 6 mints × 3 endpoints = 18 calls per cycle, this stays well within Allium's free tier limits.

**429 backoff**: If Allium returns 429 (rate limited), L3 retries with exponential backoff (3s, 6s, 9s) before giving up.

---

## Bayesian Treatment of Anonymous Mints

Anonymous mints (no known operator Bitcoin addresses) cannot be queried on Allium. Rather than dropping the on-chain signals entirely (which would renormalize weights to 70% → 100% and inflate scores), L3 injects **uninformative Bayesian priors**:

```
score = 0.5    (maximum-entropy prior — no information either way)
sigma = 0.45   (near-maximum uncertainty — we genuinely don't know)
```

The effect on the composite score distribution:

| Mint Type | Typical μ | Typical σ | Max Achievable Score | MVO Weight Factor |
|---|---|---|---|---|
| Verified (Allium data) | 75-95 | ~5 | 100 | (μ - 50) / 25 |
| Anonymous (priors) | 55-70 | ~14.6 | ~70 | (μ - 50) / 213 |

Anonymous mints are **capped at ~70/100** because the uninformative priors (0.5) contribute less than real high-scoring data would. Their high σ means the MVO allocation formula gives them **8.5× less weight** than a verified mint at the same score.

This is the correct Bayesian behavior: "I have no evidence this mint is bad, but I also have no evidence it's good, so I should be appropriately cautious."

---

## Simulation Engine

L3 includes 5 preset simulation scenarios and a progressive degradation mode for stress-testing the scoring and allocation system:

| Scenario | What It Simulates | Key Behavior Tested |
|---|---|---|
| **All Mints Healthy** | Boosts all mints to near-perfect signals | Balanced allocation across reliable operators |
| **Single Mint Failure** | First mint goes completely offline (all signals → 0) | Detection, critical grading, fund evacuation to remaining safe mints |
| **Reserve Drain (Rug Pull)** | Top-scored mint shows -60% reserve decline + wash trading patterns, but stays online | On-chain intelligence catching what uptime monitoring misses |
| **Cascade Failure** | Half the mints degrade simultaneously | Allocation concentration onto remaining safe mints (capped at 40%) |
| **Best vs Worst** | Top 3 mints boosted to near-perfect, bottom 3 degraded to critical | Maximum allocation spread |

**Progressive Degradation** is a 4-step sequence applied to the highest-scored mint:

1. Latency spike (300ms → 2100ms)
2. Health check failures (availability drops to 50%)
3. Reserve drain detected (Allium signals collapse)
4. Keyset changed (all signals fail)

Each step generates alerts and (in auto mode) triggers migrations, demonstrating the full pipeline.

---

## Alert System and Discord Integration

### Alert Types

| Type | Trigger | Severity |
|---|---|---|
| `critical` | Mint grade drops to critical AND score declined | Immediate action required |
| `score_drop` | Score drops ≥10 points from previous cycle | Attention needed |
| `recovery` | Mint recovers from critical (<50) to safe (≥75) | Informational |
| `migration_suggested` | Migration plan computed in alert mode | Human review required |
| `migration_executed` | Migration completed in auto mode | Informational |

### Three Automation Modes

- **Auto** — Migrations execute automatically when triggered. Discord alerts sent after execution.
- **Alert** — Migrations are suggested but require human approval. Discord alerts prompt for action.
- **Manual** — Scoring runs but no migration suggestions or executions. Monitoring only.

### Discord Notifications

L3 sends rich embed messages to a configured Discord channel via the Discord REST API v10 (no discord.js dependency — just native `fetch`):

- Color-coded by severity (red for critical, yellow for score drops, green for recoveries/migrations)
- Fields for mint name, current score, previous score, and action taken
- Max 10 embeds per message (Discord API limit)
- Fails silently — Discord being down should never block scoring or migration

---

## Deployment

### Docker

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY webapp/package.json webapp/package-lock.json ./
RUN npm install
COPY webapp/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/state/types.ts ./src/state/types.ts
COPY --from=build /app/package.json ./
EXPOSE 3456
ENV NODE_ENV=production
CMD ["npx", "tsx", "server/index.ts"]
```

### Railway

Configured via `railway.json` to use the Dockerfile builder. Start command: `npx tsx server/index.ts`.

---

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd L3/webapp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your ALLIUM_API_KEY (get from app.allium.so)
# Add DISCORD_BOT_TOKEN and DISCORD_CHANNEL_ID (optional)

# Run in development mode (Express + Vite HMR on port 3456)
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

The Python scoring prototype can be run independently:

```bash
cd L3
pip install requests numpy pandas matplotlib
# Edit ALLIUM_API_KEY in weightinglogic.py
python weightinglogic.py
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ALLIUM_API_KEY` | Yes | Allium Labs API key (server-side, used by the proxy). Get from app.allium.so |
| `VITE_ALLIUM_API_KEY` | No | Allium API key for direct calls in dev mode (bypasses proxy) |
| `DISCORD_BOT_TOKEN` | No | Discord bot token for alert notifications |
| `DISCORD_CHANNEL_ID` | No | Discord channel ID to send alerts to |
| `PORT` | No | Server port (default: 3456) |
| `NODE_ENV` | No | Set to `production` for static file serving |
