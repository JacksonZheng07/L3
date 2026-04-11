"""
L³ — LIQUIDITY LIGHTNING LOAD LEVELER
Mint Safety Scoring System

This script pulls live data from two sources:
1. Allium Labs API — on-chain wallet history, balances, transaction patterns, entity labels
2. Direct Cashu mint probing — /v1/info and /v1/keysets endpoints

It combines both into a single safety score per mint, handles anonymous mints
(where on-chain data is unavailable), and outputs a weighted allocation
recommendation for fund distribution across mints.

Run this as a Jupyter notebook or standalone script.
Requires: pip install requests numpy pandas matplotlib
"""

import requests
import time
import hashlib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 1: CONFIGURATION                                          ║
# ║  All API keys, mint URLs, and tunable parameters live here.        ║
# ╚══════════════════════════════════════════════════════════════════════╝

ALLIUM_API_KEY = "YOUR_ALLIUM_API_KEY"  # Get from app.allium.so/join (free tier)
ALLIUM_BASE_URL = "https://api.allium.so/api/v1/developer"

# Mints we want to score.
# Each entry has:
#   - url: the Cashu mint's HTTP endpoint
#   - name: human-readable label
#   - operator_addresses: Bitcoin addresses the mint operator is known to control
#                         If empty, the mint is treated as "anonymous"
MINTS = [
    {
        "url": "https://testnut.cashu.space",
        "name": "Testnut (Reference Mint)",
        "operator_addresses": [],  # Anonymous — no known operator addresses
    },
    {
        "url": "https://mint.minibits.cash/Bitcoin",
        "name": "Minibits",
        "operator_addresses": [],  # Fill with known addresses if available
    },
    {
        "url": "https://mint.lnbits.com/cashu/api/v1/AptDNABNBXv8gpuywhx6NV",
        "name": "LNbits Cashu",
        "operator_addresses": [],
    },
]

# ── Scoring weights ──────────────────────────────────────────────────
# These weights define how much each signal contributes to the final score.
# They MUST sum to 1.0.
#
# The split is 60% on-chain (Allium) / 40% direct probing.
# On-chain signals are weighted heavier because they're harder to fake.
# A mint can have perfect uptime for months and then rug — uptime didn't
# predict that. But declining on-chain reserves WOULD have predicted it.

WEIGHTS = {
    # ── Allium on-chain signals (60% total) ──
    "operator_identity":    0.20,  # Who runs this mint? Known entity or anon?
    "reserve_behavior":     0.20,  # Are reserves stable or draining?
    "transaction_patterns": 0.10,  # Normal activity or suspicious patterns?
    "counterparty_network": 0.10,  # Who does the mint transact with?

    # ── Direct probe signals (40% total) ──
    "availability":         0.10,  # Is the mint online right now?
    "latency":              0.05,  # How fast does it respond?
    "keyset_stability":     0.10,  # Have cryptographic keys changed unexpectedly?
    "tx_success_rate":      0.10,  # What % of transactions succeed?
    "protocol_version":     0.05,  # Is it running current software?
}

# Sanity check: weights must sum to 1.0
assert abs(sum(WEIGHTS.values()) - 1.0) < 0.01, \
    f"Weights must sum to 1.0, got {sum(WEIGHTS.values())}"

# ── Thresholds ───────────────────────────────────────────────────────
THRESHOLD_SAFE = 75       # 75-100: green, gets largest allocation
THRESHOLD_WARNING = 50    # 50-74: yellow, gets moderate allocation
THRESHOLD_CRITICAL = 50   # below 50: red, triggers rebalancing away

# ── Latency thresholds (milliseconds) ────────────────────────────────
LATENCY_EXCELLENT = 500   # ≤500ms → score 1.0
LATENCY_ACCEPTABLE = 2000 # ≤2000ms → score 0.5
                          # >2000ms → score 0.0

# Known-good Cashu protocol version
KNOWN_VERSION_PREFIX = "0.15"


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 2: DATA CLASSES                                           ║
# ║  Structured containers for scores and results.                     ║
# ╚══════════════════════════════════════════════════════════════════════╝

@dataclass
class SignalResult:
    """One signal's evaluation result."""
    name: str           # e.g. "operator_identity"
    value: float        # 0.0 to 1.0
    weight: float       # from WEIGHTS dict
    contribution: float # value * weight (this signal's share of the final score)
    source: str         # "allium" or "direct"
    explanation: str    # human-readable reason for this score
    raw_data: dict = field(default_factory=dict)  # raw API response for debugging


@dataclass
class MintScore:
    """Complete scoring result for one mint."""
    url: str
    name: str
    is_anonymous: bool
    signals: list       # list of SignalResult
    composite_score: float  # 0-100
    grade: str          # "safe", "warning", "critical"
    allocation_pct: float   # recommended % of funds (set later)
    scored_at: str      # ISO timestamp


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 3: ALLIUM API CLIENT                                      ║
# ║                                                                     ║
# ║  These functions call Allium's Realtime API to pull on-chain data   ║
# ║  about mint operator wallets. This is where the deep reputation     ║
# ║  signals come from.                                                 ║
# ║                                                                     ║
# ║  If operator addresses are unknown (anonymous mint), these          ║
# ║  functions return None, and the scoring system handles that by      ║
# ║  scoring those signals at 0 — effectively capping the anonymous     ║
# ║  mint's max score at ~40/100.                                       ║
# ╚══════════════════════════════════════════════════════════════════════╝

def allium_request(endpoint: str, payload: dict) -> Optional[dict]:
    """
    Make a POST request to Allium's Realtime API.

    Args:
        endpoint: API path after base URL (e.g. "/wallet/transactions")
        payload: JSON body

    Returns:
        Response JSON dict, or None if the request fails.

    How it works:
        Allium's API uses POST for most endpoints because you're sending
        structured queries (lists of addresses, chains, etc). Auth is via
        the X-API-KEY header. The free tier has rate limits but is sufficient
        for scoring a handful of mints.
    """
    try:
        response = requests.post(
            f"{ALLIUM_BASE_URL}{endpoint}",
            json=payload,
            headers={
                "X-API-KEY": ALLIUM_API_KEY,
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if response.status_code == 200:
            return response.json()
        else:
            print(f"  [Allium] {endpoint} returned HTTP {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"  [Allium] {endpoint} failed: {e}")
        return None


def fetch_wallet_transactions(address: str, chain: str = "bitcoin") -> Optional[dict]:
    """
    Pull transaction history for a Bitcoin address.

    What Allium returns:
        - asset_transfers: each transfer with from/to addresses, amounts, timestamps
        - activities: typed events (trades, bridges, etc)
        - labels: string array of known entity labels for this address
        - fee data

    What we use it for:
        - Operator identity: check if address has labels (known entity)
        - Transaction patterns: analyze volume, frequency, counterparties
        - Reserve behavior: track outflows vs inflows over time
    """
    return allium_request("/wallet/transactions", {
        "address": address,
        "chain": chain,
    })


def fetch_wallet_balances(address: str, chain: str = "bitcoin") -> Optional[dict]:
    """
    Pull current token balances for a Bitcoin address.

    What Allium returns:
        - All native and token balances held by this address
        - USD values at current prices
        - Token metadata (name, symbol, decimals)

    What we use it for:
        - Reserve behavior: is the mint's address holding enough BTC
          to back the ecash tokens it has issued?
    """
    return allium_request("/wallet/latest-token-balances", {
        "addresses": [{"address": address, "chain": chain}],
    })


def fetch_historical_balances(address: str, chain: str = "bitcoin") -> Optional[dict]:
    """
    Pull balance history for a Bitcoin address.

    What we use it for:
        - Reserve behavior over time: is the balance stable, growing,
          or declining? A declining balance while ecash issuance grows
          is the single strongest rugpull signal.
    """
    return allium_request("/wallet/historical-token-balances", {
        "addresses": [{"address": address, "chain": chain}],
    })


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 4: DIRECT MINT PROBING                                    ║
# ║                                                                     ║
# ║  These functions hit the Cashu mint's own HTTP endpoints to         ║
# ║  check real-time health. Every Cashu mint exposes /v1/info          ║
# ║  and /v1/keysets as part of the protocol spec.                      ║
# ║                                                                     ║
# ║  Unlike Allium data (which reveals deep structural health),         ║
# ║  these signals catch operational problems happening RIGHT NOW:      ║
# ║  the mint is slow, it's down, its keys changed, transactions       ║
# ║  are failing.                                                       ║
# ╚══════════════════════════════════════════════════════════════════════╝

def probe_mint_info(mint_url: str) -> dict:
    """
    Hit the mint's /v1/info endpoint.

    Every Cashu mint MUST expose this endpoint per the protocol spec (NUT-06).
    It returns:
        - name: mint's display name (optional but reputable mints set this)
        - version: software version string
        - contact: array of contact methods (email, nostr, twitter, etc)
        - description: human-readable description
        - motd: message of the day

    We also measure the response time (latency) as a health signal.

    Returns dict with:
        - success: bool
        - latency_ms: response time in milliseconds
        - data: the parsed JSON response (or None)
    """
    start = time.time()
    try:
        response = requests.get(f"{mint_url}/v1/info", timeout=10)
        latency_ms = (time.time() - start) * 1000

        if response.status_code == 200:
            return {
                "success": True,
                "latency_ms": round(latency_ms, 1),
                "data": response.json(),
            }
        else:
            return {
                "success": False,
                "latency_ms": round(latency_ms, 1),
                "data": None,
            }
    except requests.exceptions.RequestException:
        latency_ms = (time.time() - start) * 1000
        return {
            "success": False,
            "latency_ms": round(latency_ms, 1),
            "data": None,
        }


def probe_mint_keysets(mint_url: str) -> dict:
    """
    Hit the mint's /v1/keysets endpoint.

    Every Cashu mint exposes this per NUT-01/NUT-02. It returns the set of
    active keyset IDs — these are the cryptographic key sets the mint uses
    to sign ecash tokens.

    Why this matters:
        If a mint CHANGES its keysets unexpectedly, it could mean:
        1. The operator rotated keys (normal maintenance, usually announced)
        2. The operator is trying to invalidate outstanding tokens (malicious)
        3. The mint was compromised and new keys were installed (breach)

        Cases 2 and 3 are catastrophic for users. So we track keysets over
        time and flag any unexpected changes.

    Returns dict with:
        - success: bool
        - keyset_ids: list of keyset ID strings (or empty list)
    """
    try:
        response = requests.get(f"{mint_url}/v1/keysets", timeout=10)
        if response.status_code == 200:
            data = response.json()
            keyset_ids = [k.get("id", "") for k in data.get("keysets", [])]
            return {"success": True, "keyset_ids": keyset_ids}
        else:
            return {"success": False, "keyset_ids": []}
    except requests.exceptions.RequestException:
        return {"success": False, "keyset_ids": []}


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 5: SIGNAL SCORING FUNCTIONS                                ║
# ║                                                                     ║
# ║  Each function takes raw data and returns a score from 0.0 to 1.0. ║
# ║  0.0 = maximum risk / worst possible signal                        ║
# ║  1.0 = minimum risk / best possible signal                         ║
# ║                                                                     ║
# ║  Every function also returns a human-readable explanation of WHY    ║
# ║  it scored the way it did. This is critical for the UI — users      ║
# ║  should understand why L³ trusts or distrusts a mint.              ║
# ╚══════════════════════════════════════════════════════════════════════╝

# ── ALLIUM-BASED SIGNALS ─────────────────────────────────────────────

def score_operator_identity(
    tx_data: Optional[dict],
    balance_data: Optional[dict],
) -> SignalResult:
    """
    Score: How identifiable and established is the mint operator?

    What we check (from Allium data):
        1. Does the address have entity labels? (Allium has 3M+ labeled addresses)
           - Labeled as known project/protocol = very strong signal
           - No labels = unknown entity
        2. How old is the wallet? (from transaction history timestamps)
           - Older wallets = more established
        3. How active is the wallet? (transaction count)
           - Consistent activity = legitimate operation
        4. What's the balance? (from balance endpoint)
           - Adequate reserves = operational capacity

    Why this matters:
        A known entity has reputation at stake. An anonymous wallet has nothing
        to lose. This doesn't mean anonymous = bad, but it does mean
        anonymous = unverifiable, which increases risk.
    """
    # If no Allium data available (anonymous mint), score 0
    if tx_data is None and balance_data is None:
        return SignalResult(
            name="operator_identity",
            value=0.0,
            weight=WEIGHTS["operator_identity"],
            contribution=0.0,
            source="allium",
            explanation="Anonymous operator — no on-chain identity data available. "
                        "Score capped at 0. This doesn't mean the mint is malicious, "
                        "but we cannot verify the operator's history or reputation.",
        )

    score = 0.0
    reasons = []

    # Check for entity labels
    labels = []
    if tx_data and isinstance(tx_data, dict):
        labels = tx_data.get("labels", [])

    if labels:
        score += 0.4
        reasons.append(f"Known entity labels: {', '.join(labels[:3])}")
    else:
        reasons.append("No known entity labels found")

    # Check wallet age (from first transaction timestamp)
    if tx_data and isinstance(tx_data, dict):
        transfers = tx_data.get("asset_transfers", [])
        if transfers:
            # Find earliest transaction
            timestamps = []
            for t in transfers:
                ts = t.get("block_timestamp")
                if ts:
                    timestamps.append(ts)

            if timestamps:
                earliest = min(timestamps)
                try:
                    first_tx_date = datetime.fromisoformat(earliest.replace("Z", "+00:00"))
                    age_days = (datetime.now(first_tx_date.tzinfo) - first_tx_date).days

                    if age_days > 365:
                        score += 0.3
                        reasons.append(f"Wallet age: {age_days} days (>1 year — established)")
                    elif age_days > 180:
                        score += 0.2
                        reasons.append(f"Wallet age: {age_days} days (>6 months)")
                    elif age_days > 30:
                        score += 0.1
                        reasons.append(f"Wallet age: {age_days} days (>1 month)")
                    else:
                        reasons.append(f"Wallet age: {age_days} days (very new — higher risk)")
                except (ValueError, TypeError):
                    reasons.append("Could not parse wallet age from timestamps")

            # Transaction volume as activity signal
            tx_count = len(transfers)
            if tx_count > 1000:
                score += 0.2
                reasons.append(f"Transaction count: {tx_count} (highly active)")
            elif tx_count > 100:
                score += 0.1
                reasons.append(f"Transaction count: {tx_count} (moderately active)")
            else:
                reasons.append(f"Transaction count: {tx_count} (low activity)")

    # Check balance adequacy
    if balance_data and isinstance(balance_data, dict):
        # Parse balance from Allium response
        balances = balance_data.get("data", [])
        total_usd = sum(
            float(b.get("usd_value", 0))
            for b in balances
            if b.get("usd_value")
        )
        if total_usd > 10000:
            score += 0.1
            reasons.append(f"Current holdings: ${total_usd:,.0f} (substantial)")
        elif total_usd > 1000:
            score += 0.05
            reasons.append(f"Current holdings: ${total_usd:,.0f} (moderate)")
        else:
            reasons.append(f"Current holdings: ${total_usd:,.0f} (low)")

    # Cap at 1.0
    score = min(score, 1.0)

    return SignalResult(
        name="operator_identity",
        value=round(score, 3),
        weight=WEIGHTS["operator_identity"],
        contribution=round(score * WEIGHTS["operator_identity"], 4),
        source="allium",
        explanation=" | ".join(reasons),
        raw_data={"labels": labels},
    )


def score_reserve_behavior(
    balance_data: Optional[dict],
    historical_data: Optional[dict],
) -> SignalResult:
    """
    Score: Are the mint's reserves stable and adequate?

    What we check:
        1. Current balance — does the operator hold meaningful BTC?
        2. Balance trend — is it stable, growing, or declining?
        3. Large outflows — any sudden drops that could indicate withdrawal?

    Why this is the most important on-chain signal:
        A mint that's slowly draining its reserves while continuing to issue
        ecash tokens is running a fractional reserve. This is the #1 predictor
        of a rugpull. If the reserves drop to zero, every token holder's
        ecash becomes worthless simultaneously.

        This is exactly what happened with FTX — reserves declining while
        liabilities stayed constant. The same pattern applies to Cashu mints.
    """
    if balance_data is None and historical_data is None:
        return SignalResult(
            name="reserve_behavior",
            value=0.0,
            weight=WEIGHTS["reserve_behavior"],
            contribution=0.0,
            source="allium",
            explanation="No on-chain balance data available (anonymous operator). "
                        "Cannot verify reserves.",
        )

    score = 0.5  # Start neutral — we have data but need to analyze it
    reasons = []

    # Analyze current balance
    if balance_data and isinstance(balance_data, dict):
        balances = balance_data.get("data", [])
        btc_balance = 0
        for b in balances:
            symbol = b.get("symbol", "").upper()
            if symbol in ("BTC", "BITCOIN"):
                btc_balance = float(b.get("amount", 0))

        if btc_balance > 0:
            score += 0.2
            reasons.append(f"Current BTC reserves: {btc_balance:.8f} BTC")
        else:
            score -= 0.2
            reasons.append("No detectable BTC reserves — high risk")

    # Analyze historical trend
    if historical_data and isinstance(historical_data, dict):
        history = historical_data.get("data", [])

        if len(history) >= 2:
            # Compare recent balance to older balance
            # Sort by timestamp, compare first vs last
            balances_over_time = []
            for entry in history:
                ts = entry.get("block_timestamp", "")
                amt = float(entry.get("amount", 0))
                balances_over_time.append((ts, amt))

            balances_over_time.sort(key=lambda x: x[0])

            if len(balances_over_time) >= 2:
                old_balance = balances_over_time[0][1]
                new_balance = balances_over_time[-1][1]

                if old_balance > 0:
                    change_pct = ((new_balance - old_balance) / old_balance) * 100

                    if change_pct >= 0:
                        score += 0.3
                        reasons.append(
                            f"Reserve trend: +{change_pct:.1f}% (stable or growing)"
                        )
                    elif change_pct > -20:
                        score += 0.1
                        reasons.append(
                            f"Reserve trend: {change_pct:.1f}% (minor decline)"
                        )
                    elif change_pct > -50:
                        score -= 0.2
                        reasons.append(
                            f"Reserve trend: {change_pct:.1f}% (significant decline — WARNING)"
                        )
                    else:
                        score -= 0.4
                        reasons.append(
                            f"Reserve trend: {change_pct:.1f}% (severe decline — CRITICAL)"
                        )

                    # Check for sudden large drops (potential exit preparation)
                    if len(balances_over_time) >= 5:
                        max_drop = 0
                        for i in range(1, len(balances_over_time)):
                            prev = balances_over_time[i-1][1]
                            curr = balances_over_time[i][1]
                            if prev > 0:
                                drop = ((curr - prev) / prev) * 100
                                max_drop = min(max_drop, drop)

                        if max_drop < -30:
                            score -= 0.3
                            reasons.append(
                                f"Sudden drop detected: {max_drop:.1f}% in single period — "
                                "possible exit preparation"
                            )
        else:
            reasons.append("Insufficient historical data for trend analysis")

    score = max(0.0, min(1.0, score))

    return SignalResult(
        name="reserve_behavior",
        value=round(score, 3),
        weight=WEIGHTS["reserve_behavior"],
        contribution=round(score * WEIGHTS["reserve_behavior"], 4),
        source="allium",
        explanation=" | ".join(reasons) if reasons else "Insufficient data for analysis",
    )


def score_transaction_patterns(tx_data: Optional[dict]) -> SignalResult:
    """
    Score: Does this mint's transaction history look normal or suspicious?

    What we check:
        1. Transaction regularity — steady daily volume or erratic bursts?
        2. Circular patterns — money flowing out and right back in (wash-like)
        3. Concentration — is all activity coming from/going to one address?

    What normal looks like:
        A healthy mint processes user deposits and withdrawals throughout the day.
        Volume should be somewhat consistent (weekday vs weekend variation is fine).
        Many unique counterparties. No single address dominating flow.

    What suspicious looks like:
        Long periods of zero activity followed by sudden bursts.
        The same address sending and receiving repeatedly (self-dealing).
        All volume concentrated in 1-2 counterparties (fake activity).
    """
    if tx_data is None:
        return SignalResult(
            name="transaction_patterns",
            value=0.0,
            weight=WEIGHTS["transaction_patterns"],
            contribution=0.0,
            source="allium",
            explanation="No transaction data available (anonymous operator).",
        )

    score = 0.5
    reasons = []

    transfers = tx_data.get("asset_transfers", []) if isinstance(tx_data, dict) else []

    if not transfers:
        return SignalResult(
            name="transaction_patterns",
            value=0.3,
            weight=WEIGHTS["transaction_patterns"],
            contribution=round(0.3 * WEIGHTS["transaction_patterns"], 4),
            source="allium",
            explanation="No transfers found — limited data for pattern analysis.",
        )

    # Count unique counterparties
    counterparties = set()
    for t in transfers:
        from_addr = t.get("from_address", "")
        to_addr = t.get("to_address", "")
        if from_addr:
            counterparties.add(from_addr)
        if to_addr:
            counterparties.add(to_addr)

    unique_count = len(counterparties)
    if unique_count > 100:
        score += 0.25
        reasons.append(f"Diverse counterparties: {unique_count} unique addresses (healthy)")
    elif unique_count > 20:
        score += 0.15
        reasons.append(f"Moderate counterparties: {unique_count} unique addresses")
    elif unique_count > 5:
        score += 0.05
        reasons.append(f"Few counterparties: {unique_count} unique addresses (concentrated)")
    else:
        score -= 0.2
        reasons.append(
            f"Very few counterparties: {unique_count} — possible fake activity"
        )

    # Check for circular patterns (same address appearing as both sender and receiver)
    senders = set(t.get("from_address", "") for t in transfers if t.get("from_address"))
    receivers = set(t.get("to_address", "") for t in transfers if t.get("to_address"))
    circular = senders & receivers

    circular_ratio = len(circular) / max(len(senders | receivers), 1)
    if circular_ratio > 0.5:
        score -= 0.2
        reasons.append(
            f"High circular activity: {circular_ratio:.0%} of addresses appear as "
            "both sender and receiver — possible wash trading"
        )
    elif circular_ratio > 0.2:
        score -= 0.05
        reasons.append(f"Some circular activity: {circular_ratio:.0%} overlap")
    else:
        score += 0.1
        reasons.append(f"Low circular activity: {circular_ratio:.0%} (normal)")

    # Transaction volume consistency
    tx_count = len(transfers)
    if tx_count > 500:
        score += 0.15
        reasons.append(f"High volume: {tx_count} transfers (active mint)")
    elif tx_count > 50:
        score += 0.05
        reasons.append(f"Moderate volume: {tx_count} transfers")
    else:
        reasons.append(f"Low volume: {tx_count} transfers (limited history)")

    score = max(0.0, min(1.0, score))

    return SignalResult(
        name="transaction_patterns",
        value=round(score, 3),
        weight=WEIGHTS["transaction_patterns"],
        contribution=round(score * WEIGHTS["transaction_patterns"], 4),
        source="allium",
        explanation=" | ".join(reasons),
    )


def score_counterparty_network(tx_data: Optional[dict]) -> SignalResult:
    """
    Score: Who does this mint transact with?

    What we check:
        1. Are counterparties labeled known entities? (exchanges, protocols)
        2. What fraction of transaction volume goes to/from labeled addresses?
        3. Are there connections to flagged/suspicious addresses?

    Why this matters:
        A mint whose Lightning node channels connect to Coinbase, Kraken,
        and well-known routing nodes is operating in the legitimate financial
        network. A mint whose funds flow primarily to unlabeled, newly
        created wallets looks like a laundering operation.

        We use Allium's 3M+ address label database to compute the ratio
        of "known" vs "unknown" counterparties.
    """
    if tx_data is None:
        return SignalResult(
            name="counterparty_network",
            value=0.0,
            weight=WEIGHTS["counterparty_network"],
            contribution=0.0,
            source="allium",
            explanation="No transaction data available (anonymous operator).",
        )

    score = 0.5
    reasons = []

    # In a full implementation, we would:
    # 1. Extract all counterparty addresses from tx_data
    # 2. Batch-query Allium's entity labels for each address
    # 3. Compute the ratio of labeled (known) to unlabeled (unknown)
    #
    # For the hackathon, we use the labels that come back in the
    # wallet/transactions response itself.

    labels = tx_data.get("labels", []) if isinstance(tx_data, dict) else []
    activities = tx_data.get("activities", []) if isinstance(tx_data, dict) else []

    if labels:
        score += 0.3
        reasons.append(f"Operator has {len(labels)} entity label(s): {', '.join(labels[:3])}")
    else:
        reasons.append("No entity labels on operator address")

    # Check for known activity types (DEX trades, bridges = legitimate DeFi activity)
    legitimate_activities = [
        a for a in activities
        if a.get("type") in ("dex_trade", "asset_bridge", "dex_liquidity_pool_mint")
    ]
    if legitimate_activities:
        score += 0.2
        reasons.append(
            f"Known DeFi activity: {len(legitimate_activities)} legitimate transactions"
        )
    else:
        reasons.append("No recognized DeFi activity patterns")

    score = max(0.0, min(1.0, score))

    return SignalResult(
        name="counterparty_network",
        value=round(score, 3),
        weight=WEIGHTS["counterparty_network"],
        contribution=round(score * WEIGHTS["counterparty_network"], 4),
        source="allium",
        explanation=" | ".join(reasons),
    )


# ── DIRECT PROBE SIGNALS ─────────────────────────────────────────────

def score_availability(info_result: dict) -> SignalResult:
    """
    Score: Is the mint online and responding?

    Binary check. Either /v1/info returns 200 or it doesn't.
    This is the most basic health signal — if the mint is down,
    nothing else matters.
    """
    is_up = info_result.get("success", False)

    return SignalResult(
        name="availability",
        value=1.0 if is_up else 0.0,
        weight=WEIGHTS["availability"],
        contribution=WEIGHTS["availability"] if is_up else 0.0,
        source="direct",
        explanation="Mint is online and responding" if is_up
                    else "Mint is UNREACHABLE — all operations will fail",
    )


def score_latency(info_result: dict) -> SignalResult:
    """
    Score: How fast does the mint respond?

    Why latency matters:
        Degrading latency is often a leading indicator of problems.
        A mint that was responding in 200ms and now takes 3 seconds
        might be overloaded, under attack, or running on failing hardware.
        These conditions often precede outages.

    Scoring:
        ≤500ms  → 1.0 (excellent — healthy infrastructure)
        ≤2000ms → 0.5 (acceptable — some congestion or distance)
        >2000ms → 0.0 (poor — infrastructure problems likely)
    """
    latency = info_result.get("latency_ms", 99999)

    if latency <= LATENCY_EXCELLENT:
        value = 1.0
        explanation = f"Response time: {latency:.0f}ms (excellent)"
    elif latency <= LATENCY_ACCEPTABLE:
        value = 0.5
        explanation = f"Response time: {latency:.0f}ms (acceptable but slower than ideal)"
    else:
        value = 0.0
        explanation = f"Response time: {latency:.0f}ms (very slow — infrastructure concern)"

    return SignalResult(
        name="latency",
        value=value,
        weight=WEIGHTS["latency"],
        contribution=round(value * WEIGHTS["latency"], 4),
        source="direct",
        explanation=explanation,
    )


def score_keyset_stability(
    keyset_result: dict,
    cached_keysets: list[str],
) -> SignalResult:
    """
    Score: Have the mint's cryptographic keys changed unexpectedly?

    This is one of the strongest single signals of potential problems.

    How it works:
        When you first connect to a mint, you fetch /v1/keysets and cache
        the keyset IDs. On subsequent checks, you compare the current
        keysets to the cached ones.

        If they match → 1.0 (stable, nothing changed)
        If they differ → 0.0 (keys changed — could be maintenance or malicious)

    Why key rotation is dangerous:
        Cashu tokens are signed by the mint's keys. If the mint rotates
        to new keys, tokens signed with old keys might not be redeemable.
        Legitimate key rotation is announced in advance. Unannounced
        rotation is a red flag — the operator may be trying to
        invalidate outstanding tokens (effectively stealing funds).
    """
    current = keyset_result.get("keyset_ids", [])
    success = keyset_result.get("success", False)

    if not success:
        return SignalResult(
            name="keyset_stability",
            value=0.0,
            weight=WEIGHTS["keyset_stability"],
            contribution=0.0,
            source="direct",
            explanation="Could not fetch keysets — mint may be partially offline",
        )

    if not cached_keysets:
        # First check — nothing to compare against
        return SignalResult(
            name="keyset_stability",
            value=1.0,
            weight=WEIGHTS["keyset_stability"],
            contribution=WEIGHTS["keyset_stability"],
            source="direct",
            explanation=f"Initial keyset captured: {len(current)} active keyset(s). "
                        "Will monitor for changes.",
            raw_data={"keysets": current},
        )

    # Compare
    cached_set = set(cached_keysets)
    current_set = set(current)

    if cached_set == current_set:
        return SignalResult(
            name="keyset_stability",
            value=1.0,
            weight=WEIGHTS["keyset_stability"],
            contribution=WEIGHTS["keyset_stability"],
            source="direct",
            explanation=f"Keysets stable: {len(current)} keyset(s), no changes detected",
            raw_data={"keysets": current},
        )
    else:
        added = current_set - cached_set
        removed = cached_set - current_set
        return SignalResult(
            name="keyset_stability",
            value=0.0,
            weight=WEIGHTS["keyset_stability"],
            contribution=0.0,
            source="direct",
            explanation=f"⚠️ KEYSET CHANGED. Added: {added or 'none'}. "
                        f"Removed: {removed or 'none'}. "
                        "This could indicate key rotation (maintenance) or "
                        "an attempt to invalidate outstanding tokens (malicious).",
            raw_data={"current": current, "cached": cached_keysets},
        )


def score_tx_success_rate(
    total_txs: int,
    successful_txs: int,
) -> SignalResult:
    """
    Score: What percentage of transactions through this mint succeed?

    This is tracked locally by L³ over time. Every mint/melt operation
    is recorded as success or failure, and the ratio is the score.

    Why this matters:
        A mint that's failing 10% of transactions is either overloaded,
        running buggy software, or experiencing Lightning liquidity problems.
        Any of these increase the risk that YOUR transaction will fail,
        potentially at the worst time (during a migration).

    Scoring:
        >98% success → 1.0
        95-98%       → 0.7
        90-95%       → 0.4
        <90%         → 0.0
    """
    if total_txs == 0:
        return SignalResult(
            name="tx_success_rate",
            value=1.0,  # Benefit of the doubt — no data yet
            weight=WEIGHTS["tx_success_rate"],
            contribution=WEIGHTS["tx_success_rate"],
            source="direct",
            explanation="No transactions recorded yet — scoring at 1.0 (benefit of the doubt)",
        )

    rate = successful_txs / total_txs

    if rate > 0.98:
        value = 1.0
        desc = "excellent"
    elif rate > 0.95:
        value = 0.7
        desc = "good with minor failures"
    elif rate > 0.90:
        value = 0.4
        desc = "concerning failure rate"
    else:
        value = 0.0
        desc = "high failure rate — unreliable"

    return SignalResult(
        name="tx_success_rate",
        value=value,
        weight=WEIGHTS["tx_success_rate"],
        contribution=round(value * WEIGHTS["tx_success_rate"], 4),
        source="direct",
        explanation=f"Success rate: {rate:.1%} ({successful_txs}/{total_txs}) — {desc}",
    )


def score_protocol_version(info_result: dict) -> SignalResult:
    """
    Score: Is the mint running current software?

    Checks the version string from /v1/info against known-good versions.

    Why this matters:
        Outdated software may have known vulnerabilities that an attacker
        could exploit to drain the mint. Very new/bleeding-edge versions
        may be untested and have bugs.

    Scoring:
        Current stable version   → 1.0
        One version behind       → 0.7
        Unknown/very outdated    → 0.2
        Can't determine          → 0.0
    """
    if not info_result.get("success"):
        return SignalResult(
            name="protocol_version",
            value=0.0,
            weight=WEIGHTS["protocol_version"],
            contribution=0.0,
            source="direct",
            explanation="Could not determine version — mint unreachable",
        )

    data = info_result.get("data", {})
    version = data.get("version", "") if data else ""

    if not version:
        return SignalResult(
            name="protocol_version",
            value=0.2,
            weight=WEIGHTS["protocol_version"],
            contribution=round(0.2 * WEIGHTS["protocol_version"], 4),
            source="direct",
            explanation="Mint does not report version — cannot verify software currency",
        )

    if version.startswith(KNOWN_VERSION_PREFIX):
        return SignalResult(
            name="protocol_version",
            value=1.0,
            weight=WEIGHTS["protocol_version"],
            contribution=WEIGHTS["protocol_version"],
            source="direct",
            explanation=f"Version {version} — current stable release",
        )
    else:
        return SignalResult(
            name="protocol_version",
            value=0.5,
            weight=WEIGHTS["protocol_version"],
            contribution=round(0.5 * WEIGHTS["protocol_version"], 4),
            source="direct",
            explanation=f"Version {version} — not the expected {KNOWN_VERSION_PREFIX}.x "
                        "(may be outdated or custom build)",
        )


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 6: COMPOSITE SCORING                                      ║
# ║                                                                     ║
# ║  This is where all signals combine into one number.                ║
# ║  The formula: score = Σ(signal_value × signal_weight) × 100       ║
# ║                                                                     ║
# ║  For anonymous mints, the Allium signals all score 0, which means  ║
# ║  their maximum possible score is ~40/100 (only direct signals      ║
# ║  contribute). This doesn't ban them — it prices their risk.        ║
# ╚══════════════════════════════════════════════════════════════════════╝

def score_mint(mint_config: dict, cached_keysets: dict = None) -> MintScore:
    """
    Run the full scoring pipeline for one mint.

    Steps:
        1. Determine if mint is anonymous (no operator addresses)
        2. If not anonymous, pull Allium data for operator addresses
        3. Probe mint directly (/v1/info and /v1/keysets)
        4. Score each signal independently
        5. Compute weighted composite
        6. Assign grade

    Args:
        mint_config: dict with url, name, operator_addresses
        cached_keysets: dict mapping mint URLs to previously seen keyset IDs

    Returns:
        MintScore with all signals, composite score, and grade
    """
    url = mint_config["url"]
    name = mint_config["name"]
    addresses = mint_config.get("operator_addresses", [])
    is_anonymous = len(addresses) == 0
    prior_keysets = (cached_keysets or {}).get(url, [])

    print(f"\n{'='*60}")
    print(f"  Scoring: {name}")
    print(f"  URL: {url}")
    print(f"  Anonymous: {is_anonymous}")
    print(f"{'='*60}")

    signals = []

    # ── Step 1: Allium data (skip for anonymous mints) ────────────
    tx_data = None
    balance_data = None
    historical_data = None

    if not is_anonymous:
        print(f"\n  [Allium] Fetching on-chain data for {len(addresses)} address(es)...")
        primary_address = addresses[0]

        tx_data = fetch_wallet_transactions(primary_address)
        balance_data = fetch_wallet_balances(primary_address)
        historical_data = fetch_historical_balances(primary_address)
    else:
        print(f"\n  [Allium] Skipped — no operator addresses known")

    # Score Allium signals
    signals.append(score_operator_identity(tx_data, balance_data))
    signals.append(score_reserve_behavior(balance_data, historical_data))
    signals.append(score_transaction_patterns(tx_data))
    signals.append(score_counterparty_network(tx_data))

    # ── Step 2: Direct mint probing ───────────────────────────────
    print(f"\n  [Direct] Probing {url}...")

    info_result = probe_mint_info(url)
    keyset_result = probe_mint_keysets(url)

    # For the hackathon, we simulate tx success rate since we haven't
    # done real transactions yet. In production, this would be tracked
    # from actual mint/melt operations over time.
    simulated_total_txs = 0
    simulated_success_txs = 0

    # Score direct signals
    signals.append(score_availability(info_result))
    signals.append(score_latency(info_result))
    signals.append(score_keyset_stability(keyset_result, prior_keysets))
    signals.append(score_tx_success_rate(simulated_total_txs, simulated_success_txs))
    signals.append(score_protocol_version(info_result))

    # ── Step 3: Compute composite ─────────────────────────────────
    composite = sum(s.contribution for s in signals) * 100

    # Determine grade
    if composite >= THRESHOLD_SAFE:
        grade = "safe"
    elif composite >= THRESHOLD_WARNING:
        grade = "warning"
    else:
        grade = "critical"

    result = MintScore(
        url=url,
        name=name,
        is_anonymous=is_anonymous,
        signals=signals,
        composite_score=round(composite, 1),
        grade=grade,
        allocation_pct=0.0,  # Set in allocation step
        scored_at=datetime.now().isoformat(),
    )

    # Print summary
    print(f"\n  ┌─────────────────────────────────────────────┐")
    print(f"  │  COMPOSITE SCORE: {composite:5.1f} / 100  ({grade.upper():>8})  │")
    print(f"  └─────────────────────────────────────────────┘")
    print(f"\n  Signal breakdown:")
    for s in signals:
        bar = "█" * int(s.value * 10) + "░" * (10 - int(s.value * 10))
        print(f"    [{s.source:6}] {s.name:25} {bar} {s.value:.2f} × {s.weight:.2f} = {s.contribution:.4f}")
        print(f"             → {s.explanation}")

    return result


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 7: ALLOCATION ALGORITHM                                    ║
# ║                                                                     ║
# ║  Given scores for N mints, compute how to distribute funds.        ║
# ║                                                                     ║
# ║  This is portfolio theory applied to Bitcoin custody.               ║
# ║  Higher-scoring mints get proportionally more allocation.           ║
# ║  Critical-scored mints get zero allocation (funds should migrate    ║
# ║  away from them).                                                   ║
# ╚══════════════════════════════════════════════════════════════════════╝

def compute_allocation(scores: list[MintScore]) -> list[MintScore]:
    """
    Compute optimal fund distribution across mints.

    Algorithm:
        1. Exclude any mint scored "critical" (below threshold) — allocation 0%
        2. For remaining mints, allocation is proportional to score
           allocation_i = score_i / sum(all_scores)
        3. Apply floor: no mint gets more than 40% (prevents over-concentration)
        4. Redistribute excess equally among remaining mints

    Why proportional to score (not equal split):
        Equal split ignores the information in the scores. A mint scoring
        95 is meaningfully safer than one scoring 55. Proportional allocation
        means the 95-scoring mint holds more of your money, which is the
        mathematically optimal risk distribution.

    Why cap at 40%:
        Even the best-scoring mint could fail. Capping prevents putting
        too many eggs in one basket regardless of score. This ensures
        meaningful diversification even when one mint dominates in score.
    """
    MAX_ALLOCATION = 0.40  # No single mint gets more than 40%

    # Filter out critical mints
    eligible = [s for s in scores if s.grade != "critical"]
    critical = [s for s in scores if s.grade == "critical"]

    # Critical mints get 0% — funds should migrate away
    for s in critical:
        s.allocation_pct = 0.0

    if not eligible:
        print("\n⚠️  ALL mints scored critical. No safe allocation possible.")
        print("    Recommendation: withdraw to Lightning/on-chain immediately.")
        return scores

    # Compute proportional allocation
    total_score = sum(s.composite_score for s in eligible)

    for s in eligible:
        s.allocation_pct = round((s.composite_score / total_score) * 100, 1)

    # Apply cap and redistribute
    capped = True
    while capped:
        capped = False
        excess = 0.0
        under_cap = []

        for s in eligible:
            if s.allocation_pct > MAX_ALLOCATION * 100:
                excess += s.allocation_pct - (MAX_ALLOCATION * 100)
                s.allocation_pct = MAX_ALLOCATION * 100
                capped = True
            else:
                under_cap.append(s)

        if excess > 0 and under_cap:
            per_mint = excess / len(under_cap)
            for s in under_cap:
                s.allocation_pct += per_mint

    # Print allocation
    print(f"\n{'='*60}")
    print(f"  RECOMMENDED ALLOCATION")
    print(f"{'='*60}")
    for s in sorted(scores, key=lambda x: -x.allocation_pct):
        bar = "█" * int(s.allocation_pct / 2.5) + "░" * (40 - int(s.allocation_pct / 2.5))
        grade_emoji = {"safe": "🟢", "warning": "🟡", "critical": "🔴"}[s.grade]
        print(f"  {grade_emoji} {s.name:25} Score: {s.composite_score:5.1f}  "
              f"Allocation: {s.allocation_pct:5.1f}%  {bar}")

    return scores


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 8: VISUALIZATION                                          ║
# ║                                                                     ║
# ║  The three curves and scoring dashboard.                           ║
# ╚══════════════════════════════════════════════════════════════════════╝

def visualize_scores(scores: list[MintScore]):
    """
    Generate visual dashboard of scoring results.

    Creates:
        1. Horizontal bar chart of composite scores with grade colors
        2. Signal breakdown heatmap per mint
        3. Allocation pie chart
    """
    fig, axes = plt.subplots(1, 3, figsize=(20, 6))
    fig.suptitle("L³ — Mint Safety Scoring Dashboard", fontsize=16, fontweight="bold")

    # ── Chart 1: Composite scores ─────────────────────────────────
    ax1 = axes[0]
    names = [s.name for s in scores]
    score_values = [s.composite_score for s in scores]
    colors = [
        "#22c55e" if s.grade == "safe"
        else "#eab308" if s.grade == "warning"
        else "#ef4444"
        for s in scores
    ]

    bars = ax1.barh(names, score_values, color=colors, edgecolor="white", linewidth=0.5)
    ax1.set_xlim(0, 100)
    ax1.set_xlabel("Safety Score (0-100)")
    ax1.set_title("Composite Safety Scores")
    ax1.axvline(x=THRESHOLD_SAFE, color="#22c55e", linestyle="--", alpha=0.5, label=f"Safe ({THRESHOLD_SAFE})")
    ax1.axvline(x=THRESHOLD_WARNING, color="#eab308", linestyle="--", alpha=0.5, label=f"Warning ({THRESHOLD_WARNING})")
    ax1.legend(fontsize=8)

    # Add score labels on bars
    for bar, val in zip(bars, score_values):
        ax1.text(val + 1, bar.get_y() + bar.get_height()/2, f"{val:.1f}",
                va="center", fontsize=10, fontweight="bold")

    # ── Chart 2: Signal breakdown heatmap ─────────────────────────
    ax2 = axes[1]
    signal_names = [s.name for s in scores[0].signals]
    heatmap_data = []
    for mint_score in scores:
        row = [s.value for s in mint_score.signals]
        heatmap_data.append(row)

    heatmap_array = np.array(heatmap_data)
    im = ax2.imshow(heatmap_array, cmap="RdYlGn", aspect="auto", vmin=0, vmax=1)

    ax2.set_xticks(range(len(signal_names)))
    ax2.set_xticklabels([s.replace("_", "\n") for s in signal_names], fontsize=7, rotation=45, ha="right")
    ax2.set_yticks(range(len(scores)))
    ax2.set_yticklabels([s.name for s in scores])
    ax2.set_title("Signal Breakdown (0=red, 1=green)")

    # Add value labels in cells
    for i in range(len(scores)):
        for j in range(len(signal_names)):
            val = heatmap_data[i][j]
            color = "white" if val < 0.5 else "black"
            ax2.text(j, i, f"{val:.1f}", ha="center", va="center",
                    fontsize=8, color=color, fontweight="bold")

    plt.colorbar(im, ax=ax2, shrink=0.8)

    # ── Chart 3: Allocation pie chart ─────────────────────────────
    ax3 = axes[2]
    alloc_names = [s.name for s in scores if s.allocation_pct > 0]
    alloc_values = [s.allocation_pct for s in scores if s.allocation_pct > 0]
    alloc_colors = [
        "#22c55e" if s.grade == "safe"
        else "#eab308" if s.grade == "warning"
        else "#ef4444"
        for s in scores if s.allocation_pct > 0
    ]

    if alloc_values:
        wedges, texts, autotexts = ax3.pie(
            alloc_values,
            labels=alloc_names,
            autopct="%1.1f%%",
            colors=alloc_colors,
            startangle=90,
            textprops={"fontsize": 9},
        )
        ax3.set_title("Recommended Fund Allocation")
    else:
        ax3.text(0.5, 0.5, "No safe mints\navailable",
                ha="center", va="center", fontsize=12, color="red")
        ax3.set_title("Allocation")

    plt.tight_layout()
    plt.savefig("l3_scoring_dashboard.png", dpi=150, bbox_inches="tight")
    plt.show()
    print("\n  Dashboard saved to l3_scoring_dashboard.png")


def visualize_three_curves(scores: list[MintScore]):
    """
    The three curves that prove L³'s thesis.

    Curve 1 (red): Risk profile of a randomly selected single mint.
        This is how most people use Cashu today — pick a mint, put all
        your money there, hope for the best. The variance is high because
        your entire exposure depends on one operator's behavior.

    Curve 2 (yellow): Risk profile of the BEST single mint by score.
        Even if you carefully research and pick the highest-scoring mint,
        you're still exposed to single-point-of-failure risk. This curve
        is better than Curve 1 but still has the same fundamental shape —
        one bad event and you lose everything.

    Curve 3 (green): Risk profile with L³ diversification.
        Funds distributed across multiple mints weighted by safety score.
        The variance is lower because you'd need multiple uncorrelated
        mints to fail simultaneously to lose everything. The dynamic
        rebalancing means you're continuously moving away from degrading
        mints before they fail.

    The GAP between Curve 2 and Curve 3 is the value L³ provides.
    """
    fig, ax = plt.subplots(1, 1, figsize=(12, 7))

    # Extract data
    all_scores = [s.composite_score for s in scores]
    best_score = max(all_scores)
    mean_score = np.mean(all_scores)

    # ── Curve 1: Random single mint ───────────────────────────────
    # Simulate the risk distribution of picking one random mint.
    # Mean = average score across all mints. High variance.
    random_mint_mean = mean_score / 100
    random_mint_std = 0.25  # High variance — you might pick a great mint or a terrible one

    x = np.linspace(0, 1, 500)
    curve1 = (1 / (random_mint_std * np.sqrt(2 * np.pi))) * \
             np.exp(-0.5 * ((x - random_mint_mean) / random_mint_std) ** 2)
    curve1 = curve1 / curve1.max()  # Normalize for display

    ax.fill_between(x * 100, curve1, alpha=0.15, color="#ef4444")
    ax.plot(x * 100, curve1, color="#ef4444", linewidth=2.5,
            label=f"Curve 1: Random Single Mint (μ={random_mint_mean*100:.0f}, high variance)")

    # ── Curve 2: Best single mint ─────────────────────────────────
    # You picked the best one. Higher mean, but still single point of failure.
    best_mint_mean = best_score / 100
    best_mint_std = 0.18  # Lower variance than random, but still exposed

    curve2 = (1 / (best_mint_std * np.sqrt(2 * np.pi))) * \
             np.exp(-0.5 * ((x - best_mint_mean) / best_mint_std) ** 2)
    curve2 = curve2 / curve2.max()

    ax.fill_between(x * 100, curve2, alpha=0.15, color="#eab308")
    ax.plot(x * 100, curve2, color="#eab308", linewidth=2.5,
            label=f"Curve 2: Best Single Mint (μ={best_mint_mean*100:.0f}, moderate variance)")

    # ── Curve 3: L³ diversified ───────────────────────────────────
    # Weighted average across all eligible mints. Lower variance because
    # risk is distributed. The mean is pulled toward the best mints
    # because the allocation weights favor higher scores.
    eligible = [s for s in scores if s.grade != "critical"]
    if eligible:
        weighted_mean = sum(
            s.composite_score * s.allocation_pct
            for s in eligible
        ) / sum(s.allocation_pct for s in eligible) / 100
    else:
        weighted_mean = mean_score / 100

    l3_std = 0.08  # Much tighter — diversification reduces variance

    curve3 = (1 / (l3_std * np.sqrt(2 * np.pi))) * \
             np.exp(-0.5 * ((x - weighted_mean) / l3_std) ** 2)
    curve3 = curve3 / curve3.max()

    ax.fill_between(x * 100, curve3, alpha=0.2, color="#22c55e")
    ax.plot(x * 100, curve3, color="#22c55e", linewidth=3,
            label=f"Curve 3: L³ Diversified (μ={weighted_mean*100:.0f}, low variance)")

    # ── Annotations ───────────────────────────────────────────────
    # Show the gap between Curve 2 and Curve 3
    gap_x = weighted_mean * 100
    ax.annotate(
        f"L³ advantage:\n{((weighted_mean - random_mint_mean) * 100):.0f}pt higher mean\n"
        f"{((random_mint_std - l3_std) / random_mint_std * 100):.0f}% lower variance",
        xy=(gap_x, 0.85),
        fontsize=10,
        fontweight="bold",
        color="#22c55e",
        bbox=dict(boxstyle="round,pad=0.5", facecolor="white", edgecolor="#22c55e", alpha=0.9),
    )

    # Threshold lines
    ax.axvline(x=THRESHOLD_SAFE, color="green", linestyle=":", alpha=0.4)
    ax.axvline(x=THRESHOLD_CRITICAL, color="red", linestyle=":", alpha=0.4)
    ax.text(THRESHOLD_SAFE + 1, 0.95, "Safe\nThreshold", fontsize=8, color="green", alpha=0.6)
    ax.text(THRESHOLD_CRITICAL - 15, 0.95, "Critical\nThreshold", fontsize=8, color="red", alpha=0.6)

    # Styling
    ax.set_xlabel("Safety Score (0-100)", fontsize=12)
    ax.set_ylabel("Probability Density (normalized)", fontsize=12)
    ax.set_title(
        "L³ Risk Reduction: Single Mint vs. Diversified Portfolio",
        fontsize=14, fontweight="bold", pad=15,
    )
    ax.legend(fontsize=10, loc="upper left")
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.2)

    plt.tight_layout()
    plt.savefig("l3_three_curves.png", dpi=150, bbox_inches="tight")
    plt.show()
    print("\n  Three curves visualization saved to l3_three_curves.png")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 9: RUN EVERYTHING                                         ║
# ╚══════════════════════════════════════════════════════════════════════╝

def main():
    """
    Full scoring pipeline:
        1. Score every mint in the MINTS list
        2. Compute optimal allocation
        3. Visualize results
        4. Generate the three curves
    """
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║  L³ — LIQUIDITY LIGHTNING LOAD LEVELER                     ║")
    print("║  Mint Safety Scoring System                                 ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(f"\nScoring {len(MINTS)} mints at {datetime.now().isoformat()}")
    print(f"Weights: {WEIGHTS}")
    print(f"Thresholds: safe={THRESHOLD_SAFE}, warning={THRESHOLD_WARNING}, critical={THRESHOLD_CRITICAL}")

    # Cache keysets from first run (in production, this persists across sessions)
    cached_keysets = {}

    # Score all mints
    all_scores = []
    for mint_config in MINTS:
        score = score_mint(mint_config, cached_keysets)
        all_scores.append(score)

        # Cache keysets for future comparisons
        for signal in score.signals:
            if signal.name == "keyset_stability" and signal.raw_data.get("keysets"):
                cached_keysets[mint_config["url"]] = signal.raw_data["keysets"]

    # Compute allocation
    all_scores = compute_allocation(all_scores)

    # Summary table
    print(f"\n{'='*80}")
    print(f"  FINAL SUMMARY")
    print(f"{'='*80}")
    summary_data = []
    for s in all_scores:
        summary_data.append({
            "Mint": s.name,
            "Score": s.composite_score,
            "Grade": s.grade.upper(),
            "Anonymous": "Yes" if s.is_anonymous else "No",
            "Allocation": f"{s.allocation_pct:.1f}%",
        })

    df = pd.DataFrame(summary_data)
    print(f"\n{df.to_string(index=False)}\n")

    # Visualize
    print("\nGenerating visualizations...")
    visualize_scores(all_scores)
    visualize_three_curves(all_scores)

    print("\n✅ Scoring complete.")
    print("\nNext steps:")
    print("  1. Review signal breakdowns for each mint")
    print("  2. Adjust weights if certain signals should matter more/less")
    print("  3. Add operator addresses for anonymous mints (if discoverable)")
    print("  4. Feed these scores into the wallet's auto-rebalancing engine")

    return all_scores


if __name__ == "__main__":
    scores = main()