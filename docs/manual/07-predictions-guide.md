# Section 7 — Prediction Models Guide

← [Troubleshooting](06-troubleshooting.md) | [Back to Manual](../../USER_MANUAL.md) | [Next: Privacy & Security →](08-privacy-security.md)

---

> ⚠️ **Important disclaimer — please read first**
>
> The prediction models in this application are **statistical summaries of historical data**. They are provided for **educational and entertainment purposes only**.
>
> Lottery draws in Singapore are governed by certified random number generators. Each draw is an **independent, memoryless event** — past results have **zero influence** on future draws. No statistical model can give you an edge in a lottery.
>
> **Do not use these predictions as gambling advice.**
>
> If you or someone you know has a gambling problem, please contact the National Problem Gambling Helpline (Singapore): **1800-6-668-668** or visit [ncpg.org.sg](https://www.ncpg.org.sg/).

---

## What the Predictions Page Shows

The Predict tab displays output from **three independent models**. Each model analyses the same historical draw database but applies a different statistical lens. Showing multiple models makes it clear that:

1. Different methods produce different outputs
2. No single method is "correct"
3. The variation between models illustrates the arbitrariness of any such approach

---

## Reading a Prediction Card

> 📸 **Screenshot:** *[Prediction card showing model name, 4D prediction "3847", TOTO System 12 prediction with primary [3,7,14,21,34,45] and supplementary [2,9,18,27,38,49], data_points: 1820]*

Each card shows:

| Field | Meaning |
|-------|---------|
| **Model name** | Which statistical approach was used |
| **Description** | One-line summary of the method |
| **4D prediction** | A single 4-digit number |
| **TOTO prediction** | 12 numbers split into 6 Primary + 6 Supplementary (System 12 format) |
| **Data points** | Number of historical draws used. `0` means data has not loaded yet |
| **Disclaimer** | Reminder that this is not gambling advice |

### What is "System 12"?

A System 12 TOTO bet covers 12 numbers instead of the standard 6. The system automatically generates all C(12,6) = **924 combinations** of 6 from those 12 numbers. This maximises coverage but at higher cost. The prediction page always shows System 12 format because it gives you the widest statistical net.

---

## The Three Models

### Model 1 — Frequency Analysis

**Core idea:** Pick the most frequently drawn digits/numbers across all recorded history.

**How it works:**
- **4D:** For each digit position (thousands, hundreds, tens, units), count how often each digit 0–9 appeared across all stored 4D prizes. The most common digit per position forms the prediction.
- **TOTO:** Count how many times each number 1–49 appeared across all stored draws. Top 12 by frequency → sorted top 6 = primary, next 6 = supplementary.

**When it differs from other models:** When the draw history is large and stable, this model's output changes slowly. It represents the "long-run average".

**Educational value:** Demonstrates that some numbers appear more in the historical record than others purely by chance over a large sample. The variation is real but not predictive.

---

### Model 2 — Hot/Cold Analysis

**Core idea:** Balance numbers that appeared recently ("hot") against numbers that have been absent the longest ("cold").

**How it works:**
- **Hot numbers (4D):** Most frequent digits in the last 10 draws only (short window).
- **Hot numbers (TOTO primary):** Top 6 numbers by frequency in the last 10 draws.
- **Cold numbers (TOTO supplementary):** 6 numbers not seen in the last 30 draws (sorted ascending).

**When it differs from other models:** When recent draws cluster around unusual numbers, this model diverges significantly from Model 1. This makes the difference between "recent trends" and "all-time trends" visible.

**Educational value:** Illustrates the "hot hand fallacy" (momentum) vs. the "gambler's fallacy" (overdue correction) — both common but statistically unfounded intuitions.

---

### Model 3 — Recency-Weighted Frequency

**Core idea:** Give more weight to recent draws than old ones, using exponential decay.

**How it works:**
- Each draw is assigned a weight: `w = 0.93^age`, where `age = 0` for the most recent draw, `age = 1` for the second, etc.
- A draw from 10 draws ago has ~48% of the weight of the latest draw.
- A draw from 50 draws ago has ~3% weight.
- **4D/TOTO:** Numbers are ranked by their accumulated weighted score. Selection process is the same as Model 1 but using weighted counts.

**When it differs from other models:** When recent draws show different patterns from long-run history, this model lands between Model 1 (all history equal) and Model 2 (only recent window).

**Educational value:** Demonstrates time-series weighting, a real technique used in statistics and forecasting — but shown here in a context (lottery) where it confers no actual predictive benefit.

---

## Why All Three Show the Same Disclaimer

Regardless of methodology, all three models share the same fundamental limitation: **lottery draws are random**. The Singapore Pools 4D and TOTO systems use certified random number generators that produce statistically independent outcomes. No amount of historical analysis changes this.

The disclaimer on each card is not legal boilerplate — it is an accurate description of the mathematical reality.

---

## Interpreting the Output as a Learning Exercise

The most valuable use of the prediction page is **comparing the three cards**:

- If all three agree on the same numbers → those numbers appeared frequently across all time scales
- If Model 2 differs significantly → recent draws are unusual compared to long-run history
- If Model 3 is between Models 1 and 2 → the decay weighting is smoothing out a recent spike

These comparisons show real statistical phenomena in action — even if none of them help you win.

---

For full technical methodology, see [`docs/PREDICTION_MODELS.md`](../PREDICTION_MODELS.md).

---

[Next: Privacy & Security →](08-privacy-security.md)
