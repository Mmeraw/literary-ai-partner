# Gate A7 — SLO/SLA + Metrics

Status: PLANNED  
Owner: Founder / Architect

---

## 1. Non-Negotiable Safety Objectives

### 1.1 Safety SLOs (hard)

- Data leakage: 0 incidents
- Shared routes write to evaluation tables: 0 occurrences
- Recompute path (chunks → report): 0 occurrences

These are enforced by tests + code scanning + CI proof gates.

---

## 2. Availability & Latency Targets (soft targets)

### Share view (/share/{token})
- Availability: 99.9% monthly
- Latency: p95 < 800ms, p99 < 2s

### Share creation (/api/report-shares)
- Availability: 99.9% monthly
- Latency: p95 < 500ms

---

## 3. Correctness Targets

- 99.99% of successful share renders must include:
  - overall score
  - rubric breakdown
  - confidence metadata
  - provenance

If any are missing, treat as defect.

---

## 4. Metrics to Emit

### Product
- `shares_created_total`
- `share_views_total`
- `share_revoked_total`
- `share_expired_total`
- `share_time_to_first_view_seconds`

### Reliability
- `share_view_success_rate`
- `share_view_fail_closed_rate`
- `share_view_latency_ms_p95/p99`
- `artifact_load_fail_rate`

### Security
- `invalid_token_rate`
- `view_rate_per_token`
- `view_rate_per_ip`

---

## 5. Alerts (recommended)

- `invalid_token_rate` spike (abuse)
- `share_view_fail_closed_rate` spike (regression or upstream outage)
- `artifact_load_fail_rate` spike (DB connectivity or schema drift)
