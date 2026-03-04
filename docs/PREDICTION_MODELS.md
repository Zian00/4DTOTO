# Prediction Models — Technical Documentation

> **Disclaimer**: All models are statistical counters operating on historical data.
> Lottery draws are governed by certified random number generators.
> Past results have **zero** predictive power over future draws.
> These models are provided for **educational and entertainment purposes only**.

---

## Overview

The `/api/predictions` endpoint returns results from **three independent models**, each applying a different statistical lens to the same historical draw database. Presenting multiple models lets users compare approaches and understand that different methods yield different outputs — reinforcing that no single method is "correct".

| # | Model | Core idea |
|---|-------|-----------|
| 1 | Frequency Analysis | Most-drawn digit/number across all history |
| 2 | Hot/Cold Analysis | Recent window (hot) vs. long absence (cold) |
| 3 | Recency-Weighted Frequency | Exponential decay — newer draws count more |

All three models produce:
- A **4D prediction** — a 4-digit string (e.g., `"5283"`)
- A **TOTO System 12 prediction** — 6 primary + 6 supplementary numbers from 1–49

---

## Model 1: Frequency Analysis

### Why this model?
Frequency analysis is the simplest, most intuitive baseline. It asks: *"Which numbers have appeared most often in recorded history?"* It serves as a reference point against which the other two models can be compared.

### Core assumptions
- All historical draws are equally informative.
- A number that has appeared many times in the past may be "overdue" or "favoured" — though statistically this is the gambler's fallacy.

### Methodology

**4D:**
1. Extract all prize numbers (1st, 2nd, 3rd, 10 starters, 10 consolations) from every stored 4D draw.
2. For each of the 4 digit positions (thousands, hundreds, tens, units), count how often each digit (0–9) appears.
3. Select the most-frequent digit per position → concatenate → 4-digit prediction.

**TOTO:**
1. Extract all winning numbers (6 per draw) and additional numbers from every stored TOTO draw.
2. Count occurrences of each number 1–49.
3. Take the top 12 by frequency → sorted top 6 = primary, next 6 = supplementary → System 12.

### Evaluation
Running on a historical backtest, this model will correctly "predict" numbers that were drawn more in the past — by construction. However, predictive accuracy on held-out future draws is indistinguishable from random (expected), because draw results are independent events.

### Confidence
**None.** This is a counting exercise. The output reflects historical patterns only.

---

## Model 2: Hot/Cold Analysis

### Why this model?
Hot/Cold analysis is a popular heuristic used by lottery enthusiasts. It splits numbers into two groups: those drawn recently ("hot") and those not drawn recently ("cold"). Some players favour hot numbers on the assumption of momentum; others favour cold numbers on the assumption of "overdue" correction. Neither strategy is statistically valid, but presenting both groups makes the model's logic transparent and educational.

### Core assumptions
- "Hot" numbers (drawn recently) may carry informal momentum.
- "Cold" numbers (absent recently) may be "due" to appear.
- **Both assumptions are the gambler's fallacy** and are explicitly labelled as such in the UI.

### Methodology

**4D:**
1. Take only the **last 10 draws** (sorted by draw date, descending).
2. Count digit frequency per position within this window — same process as Model 1 but windowed.
3. Select the most-frequent digit per position → 4-digit prediction.
4. Falls back to full-history frequency if fewer than 10 draws are available.

**TOTO:**
1. **Hot window**: last 10 draws. Count how many times each number 1–49 appeared.
2. **Cold window**: last 30 draws. Collect the set of all numbers that appeared at least once.
3. **Primary 6 (hot)**: top 6 numbers by hot-window frequency. Backfilled from full-history frequency if fewer than 6 hot candidates are found.
4. **Supplementary 6 (cold)**: 6 numbers absent from the last 30 draws (sorted ascending). Backfilled by least-frequent numbers in full history if fewer than 6 cold candidates are found.
5. Returns as System 12.

### Evaluation
The model produces distinct output from Model 1 when the recent-window distribution diverges from the long-run average (which happens routinely with small windows). The separation of hot/cold into primary/supplementary makes the contrast between the two camps visually clear.

### Confidence
**None.** Recency of past draws does not influence future draw probability.

---

## Model 3: Recency-Weighted Frequency

### Why this model?
This model is a principled improvement over flat frequency analysis. Instead of treating all historical draws as equally important, it applies **exponential decay**: the most recent draw receives weight 1.0, the second-most-recent receives 0.93, the third 0.93², and so on. This reflects an intuition that recent structural patterns (if any existed) would be more relevant than very old ones. In practice, lottery draws are memoryless, so this model serves as an illustration of time-series weighting techniques.

### Core assumptions
- Recent draws may be marginally more representative of current draw conditions.
- Older draws should be down-weighted, not ignored entirely.
- **Lottery draws are memoryless** — this weighting has no actual predictive benefit.

### Methodology

**4D:**
1. Sort all draws by date, newest first (age = 0 for most recent, age = 1 for second, etc.).
2. For each draw at age `a`, assign weight `w = 0.93^a`.
3. For each prize number in the draw, add `w` to the weighted counter for each digit at each position.
4. Select the digit with the highest accumulated weight per position → 4-digit prediction.

**TOTO:**
1. Same age-based decay weighting.
2. For each number 1–49, accumulate weighted scores across all draws.
3. Top 12 by weighted score → sorted top 6 = primary, next 6 = supplementary → System 12.

### Decay factor
The decay constant is `0.93`, chosen so that a draw from ~10 draws ago carries roughly 48% of the weight of the most recent draw (`0.93^10 ≈ 0.48`), and a draw from ~50 draws ago carries only ~3% weight.

### Evaluation
When recent draws happen to cluster around certain numbers, this model's output diverges meaningfully from Model 1. The difference can be used to illustrate how weighting strategies affect results — a useful educational comparison.

### Confidence
**None.** Time-series weighting does not confer predictive power on memoryless random processes.

---

## Shared Infrastructure

### Data source
All three models read from the `draw_results` table, populated by the Singapore Pools HTML scraper (`services/scraper.py`). Results are cached on first fetch and updated by the APScheduler polling job every 30 minutes.

### Fallback behaviour
When the database contains no draws (e.g., on a fresh install before any scraping has run), all models fall back to:
- 4D: positional index digits (`"0123"`)
- TOTO: first 12 numbers (`1–12`)

These fallbacks are clearly nonsensical and signal that historical data has not yet been loaded.

### System 12 format
All TOTO predictions are returned as System 12 (6 primary + 6 supplementary), producing a pool of 12 numbers from which all C(12, 6) = 924 combinations can be generated. This is the same format used for System bets when tickets are uploaded.

---

## Ethics and Responsible Gambling

All three models are accompanied by a prominent disclaimer in the UI:

> *"These predictions are for educational and entertainment purposes only. They are not gambling advice. Lottery draws are random — past results do not predict future outcomes."*

The application does not recommend placing bets. Users are encouraged to treat the prediction page as a statistics demonstration, not a betting tool. If you or someone you know has a gambling problem, please seek help at [National Problem Gambling Helpline (Singapore): 1800-6-668-668](https://www.ncpg.org.sg/).
