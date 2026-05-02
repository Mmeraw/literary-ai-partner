## README
| The master roadmap is built and live in Google Sheets: | Unnamed: 1 |
| --- | --- |
| NaN | NaN |
| It contains 18 action items in sequential priority order, each with full 5Ws + How + Success Criteria columns: | NaN |
| NaN | NaN |
| # | Columns |
| A | # (sequential) |
| B | Action Item |
| C | Status (OPEN / PARTIAL) |
| D | WHO |
| E | WHAT |
| F | WHEN (priority tier) |
| G | WHERE (files/systems) |
| H | WHY (root cause from Job 385f99ed data) |
| I | HOW (specific implementation) |
| J | Success Looks Like |
| NaN | NaN |
| Priority breakdown from the thread analysis: | NaN |
| NaN | NaN |
| P0 (Immediate, items 1-3): Eliminate dead queue time (trigger worker on submit, reduce cron to \*/1, fix polling) -- these alone should cut E2E from 7:25 to under 4 min | NaN |
| NaN | NaN |
| P1 (Week 1-2, items 4-8, 14, 18): Per-pass progress, DB timestamps, fix Prose Control N/A bug, Finalizer validity gating, structured logging, canonical statuses | NaN |
| NaN | NaN |
| P2 (Week 2-4, items 9-13, 15, 17): UI badges, Vol II band-aligned prompts, calibration testing, dynamic time estimates, handoff quality checks, confidence formula | NaN |
| NaN | NaN |
| P3 (Month 2, item 16): Health metrics dashboard | NaN |
| NaN | NaN |
| Status summary: 16 items OPEN, 2 items PARTIAL (confidence score derivation and canonical status enforcement already partially in place). | NaN |
| NaN | NaN |
| Everything is evaluation-process-only -- zero story items per your instruction. The header row is frozen for easy scrolling. You can start executing top-down from item #1. | NaN |

## ROADMAP
| # | Action Item | Status | WHO | WHAT | WHEN | WHERE | WHY | HOW | Success Looks Like | Comment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.00 | Immediate worker trigger on submit | OPEN | Dev (Mike) | Add fire-and-forget POST to worker endpoint from submit API route | P0 - Immediate | api/evaluate (submit handler) + api/workers/process-evaluations | 49% of E2E time (3:39 of 7:25) is dead queue wait; cron only fires every 5 min | In submit route, after DB insert, do fetch('/api/workers/process-evaluations', {method:'POST'}) fire-and-forget | Queue wait drops from ~3:39 to <10 sec; E2E under 4 min | Here's exactly where you stand and what's next, Mike.\n\nCurrent Status: CANDIDATE (Not Yet V2)\nYour roadmap is comprehensive and correctly sequenced. The V2 Sign-Off sheet confirms you are CANDIDATE state — pipeline is strong, governance is introduced, fail-closed is in place, but three critical gaps prevent CERTIFIED:\n\n❌ Confidence derivation incomplete (coverage-based, not penalty-based)\n\n❌ Pass-to-pass propagation missing\n\n❌ Contradiction detection (Gate 15.2) missing\n\nImmediate Action Order\nP0 — Execute First (1–2 days, big wins)\nThese three items alone cut E2E time from 7:25 → under 4 min:\n\nItem #1 — Immediate worker trigger on submit: Add fire-and-forget fetch('/api/workers/process-evaluations', {method:'POST'}) in the submit route after DB insert — drops queue wait from ~3:39 to <10 sec\n\nItem #2 — Reduce cron to \*/1: One-line change in vercel.json — worst-case wait drops from 5 min to 60 sec\n\nItem #18 — Canonical lowercase status enforcement: Add DB check constraint/enum; store validity in separate evaluationStatus field — this is already PARTIAL, just needs to be completed\n\nP1 — Week 1–2 (Governance & Observability)\nItem #6 — Add per-stage timestamp columns (queued\_at, started\_at, pass1\_completed\_at etc.) to evaluation\_jobs — required for R4 certification\n\nItem #8 + #8.5 — Finalizer validity gating + fail-closed enforcement — blocks INVALID outputs from ever appearing as complete (R1, R2, R3 requirements)\n\nItem #7 — Fix Prose Control N/A bug — 13/13 criteria must return numeric scores; this directly prevents INVALID runs\n\nItem #14 — Structured worker logging — emit JSON with {jobId, stage, ts} at every boundary\n\nP1 Critical — What Flips You to CERTIFIED\nThese are the three upgrades that move you from CANDIDATE → CERTIFIED:\n\nU1 — Upgrade Item #17: Replace coverage-based confidence with penalty-based formula (confidence = cap - penalties(...)) — the full deriveConfidence() code is already spec'd in your roadmap\n\nU2 — Pass propagation enforcement: Pass 1 weakness must affect Pass 2; unresolved divergence reduces confidence\n\nU3 — Contradiction detection Gate 15.2: Detect conflicting claims across criteria; unresolved → penalize confidence\n\nThe complete TypeScript module layout (lib/v2-acceptance/types.ts, validator.ts, confidence.ts, release.ts) and the test suite (tests/v2-acceptance.test.ts) are fully spec'd in your roadmap sheet and ready to be dropped into the repo.\n\nRecommended First Move Right Now\nStart with Items #1 + #2 (30-minute effort, no risk, massive speed improvement), then immediately move to Items #8/#8.5 + U1 as a combined PR — those three upgrades together satisfy R1–R3 and the confidence gap simultaneously. That's your fastest path to CERTIFIED.\n\nWant me to pull the current repo structure and start pushing the code for Items #1 and #2 directly?\n |
| 2.00 | Reduce cron interval to \*/1 | OPEN | Dev (Mike) | Change vercel.json cron from \*/5 to \*/1 as safety net | P0 - Immediate (1-line change) | vercel.json | If immediate trigger fails, max wait is 60s not 300s | Edit cron schedule in vercel.json, redeploy | Worst-case queue wait = 60 sec instead of 5 min | NaN |
| 3.00 | Fix auto-refresh / client-side polling | OPEN | Dev (Mike) | Implement 5-10 sec polling on eval status page via GET /api/jobs/:id/status | P0 - Week 1 | Front-end eval page + new API route | Users must F5 manually; page never auto-updates despite claiming it does | Create /api/jobs/:id/status endpoint returning {status, progress, timestamps}; React useEffect polling loop | Progress bar updates live every 5-10s without manual refresh | NaN |
| 4.00 | Per-pass progress updates (33>66>90>100) | OPEN | Dev (Mike) | Write pass-level status + progress % to DB after each pass completes | P1 - Week 1-2 | Worker code (process-evaluations) + evaluation\_jobs table | Progress bar frozen at 33% for entire 3:46 processing time; no granularity | After each pass: persist timestamps only; do NOT invent new statuses. Use canonical 'running' and derive progress separately. | Bar moves: 0% queued > 30% pass1 > 60% pass2 > 90% pass3 > 100% complete | NaN |
| 5.00 | Queued-state UX (spinner + elapsed timer) | OPEN | Dev (Mike) | Show animated spinner, elapsed timer, and honest wait estimate when status=QUEUED | P1 - Week 1-2 | Front-end eval status page | Static blue bar with 'Waiting to start' looks broken after 30+ sec | Conditional render: if status===QUEUED show pulsing bar + 'Waiting for worker (typically <60s). Elapsed: X:XX' | User sees movement and time info immediately; no 'is it broken?' moment | NaN |
| 6.00 | Add per-stage timestamp columns to DB | OPEN | Dev (Mike) | Add columns: queued\_at, started\_at, pass1\_completed\_at, pass2\_completed\_at, pass3\_completed\_at, finalized\_at | P1 - Week 1 | Supabase evaluation\_jobs table | No per-stage timing data exists; can't measure or optimize what you can't see | ALTER TABLE evaluation\_jobs ADD COLUMN pass1\_completed\_at timestamptz (etc.); update worker to write timestamps | Every job has full timing breakdown; can compute p50/p95 per stage | NaN |
| 7.00 | Fix Prose Control N/A scoring bug | OPEN | Dev (Mike) | Debug evidence-sufficiency threshold that incorrectly returns N/A despite evidence existing | P1 - Week 2 | Pass 3 synthesis code / evidence capture logic | Prose Control scored N/A with evidence + analysis present; invalidates the evaluation per Vol II rules | Check threshold logic/regex for evidence capture; lower threshold or fix pattern matching; prefer low-confidence score over N/A | 13/13 criteria always return numeric scores when evidence text exists | NaN |
| 8.00 | Finalizer validity checks (VALID/INVALID gating) | OPEN | Dev (Mike) | Add validator before Finalizer persists: 13 criteria present, each has score + evidence + reasoning | P1 - Week 2 | Finalizer function in worker | System ships apparently complete scorecards with silent gaps (like N/A Prose Control) | validateEvaluation(): enforce 13 criteria; score!=null; evidence present; reasoning present; if ANY fail -> evaluationStatus='INVALID' AND block release (no composite score) | No evaluation marked COMPLETE unless all 13 criteria have valid scores; INVALID shows banner to user | NaN |
| 8.25 | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN | NaN |
| 8.50 | Enforce fail-closed execution | OPEN | Dev (Mike) | Block invalid or low-confidence evaluations from releasing | P1 - Week 2 | Finalizer + confidence layer | System currently allows invalid outputs to appear complete | if evaluationStatus=='INVALID' -> BLOCK; if confidence < threshold AND no acceptance -> BLOCK | No invalid evaluation appears as complete; no misleading outputs | NaN |
| 9.00 | Surface VALID/INVALID/DISPUTED badge in UI | OPEN | Dev (Mike) | Show evaluation validity status badge on report page | P2 - Week 2-3 | Front-end report page | User can't tell if evaluation met quality bar or had silent failures | Read validity\_status from job record; render badge + reason text if INVALID | Every report shows green VALID or red INVALID with explanation | NaN |
| 10.00 | Tighten criterion prompts to use Vol II bands explicitly | OPEN | Dev (Mike) | Update LLM prompts to include band definitions and require band justification per criterion | P2 - Week 3-4 | Prompt templates (pass1-craft, pass2-editorial) | Engine scores are 1-2 points lower than human canon on World-Building, Tonal Authority, Character Depth | Add to each criterion prompt: 'Use these band definitions [1-3, 4-6, 7-8, 9-10]. State which band and which signals you detected.' | Engine scores converge within 1 point of human Vol II-aligned evaluation on known chapters | NaN |
| 11.00 | Require explicit band justification in outputs | OPEN | Dev (Mike) | Force model to state band range and observable signals before assigning numeric score | P2 - Week 3-4 | Prompt templates | Scores appear freehanded rather than derived from detected signals per Vol II doctrine | Add instruction: 'State the band (1-3/4-6/7-8/9-10) and list 2-3 observable signals that place the text in that band BEFORE giving a numeric score' | Every criterion output shows band + signals + score; auditable and traceable | NaN |
| 12.00 | Calibrate via convergence testing | OPEN | Dev (Mike) | Run 5+ known chapters through system; log divergences vs human scores; iterate prompts | P2 - Week 4+ | Test harness + known-good chapters | No systematic calibration exists; engine may drift from canon | Create test suite of chapters with human-scored baselines; run through pipeline; flag any criterion diverging by >=2 points | All 13 criteria within 1 point of human baseline on 5+ test chapters | NaN |
| 13.00 | Update '2-3 minutes' time estimate | OPEN | Dev (Mike) | Replace static estimate with dynamic p50/p90 from actual job data | P2 - Week 2 | Submit page + eval status page | Current claim is false (actual = 7+ min); erodes user trust | Query last 100 jobs for percentile durations; display 'Typically completes in X-Y minutes' | Time estimate reflects reality within 20% of actual; auto-updates as system improves | NaN |
| 14.00 | Add structured worker logging | OPEN | Dev (Mike) | Emit structured JSON logs at each stage boundary with jobId + stage + timestamp | P1 - Week 1 | Worker code | Can't reconstruct per-stage timing from current logs | console.log({jobId, stage:'pass1\_start', ts: new Date().toISOString()}) at each boundary | Can filter Vercel logs by jobId and reconstruct full timing table for any job | NaN |
| 15.00 | Per-pass handoff quality checks | OPEN | Dev (Mike) | After Pass 1 and Pass 2, validate each criterion has observation + quote + provisional score | P2 - Week 3 | Worker code between passes | Bad pass output silently degrades downstream synthesis | After each pass, check all 13 criteria outputs for completeness; flag WEAK/INCOMPLETE before passing to next stage | Pass 3 synthesis receives verified-complete inputs or knows which criteria are weak | NaN |
| 16.00 | Health metrics dashboard | OPEN | Dev (Mike) | Track avg/p95/max duration per stage; % VALID vs INVALID; % criteria INCOMPLETE per pass | P3 - Month 2 | New admin page or Supabase query | No observability into system performance trends | Aggregate timing + validity data from instrumented jobs; display in simple dashboard | Can spot regressions in speed or quality immediately; data-driven optimization | NaN |
| 17.00 | Confidence score drives output control | PARTIAL | Dev (Mike) | Ensure confidence % is derived from evidence completeness and band agreement, not freehand | P2 - Week 3-4 | Pass 3 synthesis + Finalizer | 85% confidence reported but unclear how derived; confidence should reflect evidence quality | Compute confidence from: (criteria with full evidence / 13) \* agreement factor between Pass 1 and Pass 2 | Confidence is auditable formula, not LLM-generated number; drops when evidence is thin | NaN |
| 18.00 | Canonical lowercase job status enforcement | PARTIAL | Dev (Mike) | Enforce canonical lowercase job statuses throughout: queued, running, complete, failed; track validity separately | P1 - Week 1 | DB schema + worker + API + front-end | Mixed case and overloaded status vocabulary cause bugs and can violate the binding job contract. | Add DB check constraint or enum for canonical lowercase job statuses only. Keep validity/release state in separate field such as evaluationStatus or validity\_status with values like valid, invalid, disputed. Derive progress/phase separately from persisted stage data; do not invent lifecycle statuses like running\_pass\_1. | Zero non-canonical job status values in production; lifecycle status, validity state, and progress are cleanly separated. | NaN |

## V2 CAUTIONS
| # | Failure Point | Current State | Why It Breaks V2 | Required Fix | Roadmap Ref |
| --- | --- | --- | --- | --- | --- |
| C1 | Item 17 confidence formula too weak | Coverage-based: (criteria with evidence / 13) \* agreement factor | Ignores contradictions, missing scores, gate failures, pass divergence, independence violations -> mathematically clean but systemically wrong | Replace with penalty-based: confidence = cap - penalties(incompleteCriteria, missingScore, contradictions, passDivergence, gateFailures) | #17 (UPGRADE) |
| C2 | Pass-to-pass propagation missing | System logs WEAK/INCOMPLETE but does not enforce downstream penalties | Upstream weakness detected but ignored downstream -> false certainty | if pass1Incomplete.length > 0: confidence -= penalty; if pass2 disagrees and pass3 doesn't resolve: confidence -= penalty | NEW ITEM NEEDED |
| C3 | Contradiction detection not explicit | No item detects unresolved contradictions across criteria | System can contradict itself and still sound confident (e.g. 'strong pacing' vs 'mid-section drags') | Explicit rule: detect conflicting claims, require arbitration OR penalize; contradictionCount++ -> confidence -= penalty (Gate 15.2) | NEW ITEM NEEDED |
| C4 | VALID/INVALID not fully system-driving | Validator + UI badge added, but composite score may still display on INVALID runs | If UI shows 'Score: 71/100' on INVALID runs, system is still lying | If INVALID: no composite score, no complete framing, no export as canonical; visible reason + rerun option required | #8, #8.5, #9 |
| C5 | Confidence audit trace missing | Timestamps + logs + pass artifacts exist, but no trace of WHY confidence dropped | Confidence becomes opaque again without traceability | Log: which pass caused drop, which rule triggered, why confidence decreased | #14, #17 |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| REQUIRED UPGRADES FOR TRUE V2 | NaN | NaN | NaN | NaN | NaN |
| # | Upgrade | Action | WHO | WHEN | Success Looks Like |
| U1 | Upgrade Item 17 (Confidence) | Replace coverage-based formula with penalty-based + canonical constraints | Dev (Mike) | P1 - Week 2-3 | confidence = cap - penalties(); not just coverage; auditable trace |
| U2 | Pass propagation enforcement (NEW) | Pass 1 weakness affects Pass 2; Pass 2 divergence affects Pass 3; unresolved reduces confidence | Dev (Mike) | P1 - Week 3 | No upstream weakness silently ignored downstream |
| U3 | Contradiction detection - Gate 15.2 (NEW) | Detect conflicting claims across criteria; require arbitration OR penalize confidence | Dev (Mike) | P2 - Week 3 | contradictionCount tracked; unresolved contradictions reduce confidence |
| NaN | NaN | NaN | NaN | NaN | NaN |
| STATUS ASSESSMENT | NaN | NaN | NaN | NaN | NaN |
| Layer | Status | NaN | NaN | NaN | NaN |
| Pipeline execution | READY | NaN | NaN | NaN | NaN |
| Observability | STRONG | NaN | NaN | NaN | NaN |
| Governance enforcement | STRONG | NaN | NaN | NaN | NaN |
| Fail-closed system | INTRODUCED | NaN | NaN | NaN | NaN |
| Confidence derivation | INCOMPLETE | NaN | NaN | NaN | NaN |
| Propagation logic | MISSING | NaN | NaN | NaN | NaN |
| Contradiction detection | MISSING | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| This is directionally strong, and the proposed first moves are mostly right. The diagnosis is coherent: queue delay is real, the finalizer has been too permissive, and the system is still in candidate, not certified, because confidence, propagation, and contradiction handling are not fully enforcement-grade yet. That framing matches the roadmap you’ve built. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Where I agree most strongly: doing #1 and #2 first is sensible. They are low-risk, high-yield operational fixes. If the submit route truly just writes phase\_status: "queued" and returns, while cron remains at \*/5, then yes, that is your easiest speed win by far. The “user submits → row sits in DB → cron eventually wakes up” pattern is exactly the kind of dead latency you should kill first. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Where I would be more cautious: I would not accept the claim that doing #8/#8.5 + U1 “together satisfy R1–R3 and the confidence gap simultaneously” without qualification. That overstates it. Those changes would satisfy a large piece of the integrity problem, but they do not finish V2 by themselves, because your own roadmap still identifies two separate missing enforcement layers: pass-to-pass propagation and contradiction detection / Gate 15.2. Until those are in, confidence can still be cleaner-looking than the underlying system truth deserves. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| That leads to my biggest objection: Item 17 is still too weak as written. The proposed confidence formula is still coverage-driven and agreement-driven, which is better than freehand, but not yet robust enough for a certified system. It does not fully express penalties for contradictions, unresolved divergence, gate failures, or incomplete upstream conditions. So I agree with the roadmap’s own caution: U1 really does need to be an upgrade, not a box-check. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| I also think the repo-level recommendation is good but slightly too eager in tone. The claim “two files, ~10 lines changed, zero risk” is too absolute. The cron change is trivial. The fire-and-forget trigger is probably straightforward. But “zero risk” is engineering bravado. Anything that introduces a second trigger path into job dispatch has at least some risk around duplicate claims, auth assumptions, environment URL correctness, or dev/prod behavior, even if the risk is manageable. The right framing is “small, controlled risk,” not “zero risk.” | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Another thing I like: the repeated insistence on canonical lowercase statuses is exactly right. That’s not pedantry. It’s a contract boundary. If you let lifecycle state, validity state, and progress state blur together, you’ll create the next class of bugs before you finish fixing the current one. Item 18 is one of the most important cleanup moves in the whole plan. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| The strongest part of the whole package, though, is this: you are no longer treating V2 as “better prompts and nicer UI.” You are treating V2 as a system that must be able to refuse bad output, surface invalidity, and explain confidence honestly. That is the right standard. And it means the roadmap is no longer just optimization work; it is now trust architecture. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| So my blunt summary is: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Yes, the immediate worker trigger and cron reduction are good first moves. | NaN | NaN | NaN | NaN | NaN |
| Yes, the roadmap is mature enough to execute. | NaN | NaN | NaN | NaN | NaN |
| No, you are not yet one PR away from certified V2. | NaN | NaN | NaN | NaN | NaN |
| No, Item 17 in its current form is not strong enough to close the confidence problem. | NaN | NaN | NaN | NaN | NaN |
| Yes, if you complete the operational fixes and then implement U1–U3 properly, you’ll have something that deserves to be called a robust V2 evaluation process. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| My overall read: very good plan, slightly overstated certainty, still missing the last epistemic layer. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Where I’d be more cautious | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| 1) The immediate trigger is a good idea, but “zero risk” is too optimistic | NaN | NaN | NaN | NaN | NaN |
| It’s low risk, not zero risk. | NaN | NaN | NaN | NaN | NaN |
| Why: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| If cron and the immediate trigger both hit near the same time, you can get concurrent worker invocations | NaN | NaN | NaN | NaN | NaN |
| That is only harmless if your worker is already truly idempotent / claim-safe / lock-safe | NaN | NaN | NaN | NaN | NaN |
| If job pickup is even slightly sloppy, this can create: | NaN | NaN | NaN | NaN | NaN |
| duplicate processing | NaN | NaN | NaN | NaN | NaN |
| race conditions | NaN | NaN | NaN | NaN | NaN |
| double writes | NaN | NaN | NaN | NaN | NaN |
| misleading logs / state flips | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| So the idea is good, but it depends on worker claim logic being solid. | NaN | NaN | NaN | NaN | NaN |
| If the worker already atomically claims queued jobs, great. If not, this is where gremlins sneak in wearing fake mustaches. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| 2) “Fire-and-forget fetch” from a route handler is not always guaranteed | NaN | NaN | NaN | NaN | NaN |
| This is the biggest technical caveat. | NaN | NaN | NaN | NaN | NaN |
| In many serverless contexts, if you do: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| start a fetch(...) | NaN | NaN | NaN | NaN | NaN |
| don’t await it | NaN | NaN | NaN | NaN | NaN |
| return the response immediately | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| …the platform may not guarantee completion of that background network request after the handler is done. | NaN | NaN | NaN | NaN | NaN |
| That means the pattern can still work in practice, but it’s not as deterministic as the phrase “fire-and-forget” suggests. | NaN | NaN | NaN | NaN | NaN |
| So I’d frame it like this: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Good best-effort acceleration | NaN | NaN | NaN | NaN | NaN |
| Not a guarantee | NaN | NaN | NaN | NaN | NaN |
| Cron remains the real safety net | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| That makes Item #2 even more important. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| 3) The proposed URL choice is a bit suspect | NaN | NaN | NaN | NaN | NaN |
| Using: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NEXT\_PUBLIC\_SITE\_URL | NaN | NaN | NaN | NaN | NaN |
| fallback to production URL | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| is serviceable, but not ideal. | NaN | NaN | NaN | NaN | NaN |
| Why I’m skeptical: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| NEXT\_PUBLIC\_\* is usually meant for client exposure, not internal server orchestration | NaN | NaN | NaN | NaN | NaN |
| hard-falling back to production can become awkward in preview / local / staging scenarios | NaN | NaN | NaN | NaN | NaN |
| internal route-to-route calls are cleaner when they use a server-owned base URL strategy | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| So conceptually: yes, use an authenticated internal call if needed. | NaN | NaN | NaN | NaN | NaN |
| But I would not call that exact URL pattern “the” robust design. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| 4) Their roadmap text says POST, but the confirmed worker is GET | NaN | NaN | NaN | NaN | NaN |
| That mismatch matters a little. | NaN | NaN | NaN | NaN | NaN |
| Perplexity noticed the worker currently accepts GET, which is good. | NaN | NaN | NaN | NaN | NaN |
| So for a minimal-change quick fix, calling the current GET endpoint makes sense. | NaN | NaN | NaN | NaN | NaN |
| But if the roadmap’s canonical intent is: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| submit route triggers worker via POST | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| then I’d want consistency eventually. | NaN | NaN | NaN | NaN | NaN |
| Not because GET can’t work, but because “trigger processing” is semantically more like POST. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| For the quick win, though, I would not block on this. I’d optimize for smallest safe change. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| My judgment on the two proposed changes | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Item #1 — immediate worker trigger | NaN | NaN | NaN | NaN | NaN |
| Verdict: yes, probably do it, with realistic expectations. | NaN | NaN | NaN | NaN | NaN |
| I’d describe it as: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| a pragmatic latency fix | NaN | NaN | NaN | NaN | NaN |
| safe if worker claiming is atomic | NaN | NaN | NaN | NaN | NaN |
| helpful even if not perfectly guaranteed | NaN | NaN | NaN | NaN | NaN |
| not a substitute for stronger queue/event architecture later | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| So I agree with the change in principle. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Item #2 — cron every minute | NaN | NaN | NaN | NaN | NaN |
| Verdict: absolutely yes. | NaN | NaN | NaN | NaN | NaN |
| This is the cleanest part of the proposal: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| tiny change | NaN | NaN | NaN | NaN | NaN |
| obvious benefit | NaN | NaN | NaN | NaN | NaN |
| protects you if immediate trigger is missed | NaN | NaN | NaN | NaN | NaN |
| improves perceived reliability even before deeper refactors | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| This is one of those rare roadmap items that is both boring and excellent. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| What I think is missing from Perplexity’s answer | NaN | NaN | NaN | NaN | NaN |
| If I’m being picky in a useful way, I think it underplays these points: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Duplicate-run safety | NaN | NaN | NaN | NaN | NaN |
| Before celebrating the latency win, confirm the worker: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| atomically claims jobs | NaN | NaN | NaN | NaN | NaN |
| won’t process the same queued job twice | NaN | NaN | NaN | NaN | NaN |
| won’t regress state on overlapping runs | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Contract adherence | NaN | NaN | NaN | NaN | NaN |
| Your repo governance is very explicit. Any speed work must still preserve: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| canonical statuses only: | NaN | NaN | NaN | NaN | NaN |
| queued | NaN | NaN | NaN | NaN | NaN |
| running | NaN | NaN | NaN | NaN | NaN |
| complete | NaN | NaN | NaN | NaN | NaN |
| failed | NaN | NaN | NaN | NaN | NaN |
| no invented status phases | NaN | NaN | NaN | NaN | NaN |
| no masking illegal transitions | NaN | NaN | NaN | NaN | NaN |
| validity tracked separately from lifecycle | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Perplexity’s broad roadmap acknowledges that, but the quick-fix suggestion doesn’t talk much about transition integrity. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| The real “robust V2” bar is not speed | NaN | NaN | NaN | NaN | NaN |
| This is the most important strategic point: | NaN | NaN | NaN | NaN | NaN |
| If your question is “does this get us to a robust V2 evaluation process?”, then my answer is: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| It improves responsiveness immediately | NaN | NaN | NaN | NaN | NaN |
| It does not, by itself, make V2 robust | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Robust V2 really depends on the correctness side: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| validity gating | NaN | NaN | NaN | NaN | NaN |
| fail-closed release rules | NaN | NaN | NaN | NaN | NaN |
| auditable confidence | NaN | NaN | NaN | NaN | NaN |
| contradiction detection | NaN | NaN | NaN | NaN | NaN |
| pass-to-pass propagation | NaN | NaN | NaN | NaN | NaN |
| stage timing / observability | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| So I’d say Perplexity is right about what to do first, but not wrong to imply those first two items are only the opening move. | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| Bottom line | NaN | NaN | NaN | NaN | NaN |
| My honest take: | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| The diagnosis is good | NaN | NaN | NaN | NaN | NaN |
| The priorities are mostly good | NaN | NaN | NaN | NaN | NaN |
| The two proposed immediate changes are worth doing | NaN | NaN | NaN | NaN | NaN |
| But the implementation narrative is a bit too tidy | NaN | NaN | NaN | NaN | NaN |
| NaN | NaN | NaN | NaN | NaN | NaN |
| If I had to summarize in one line: | NaN | NaN | NaN | NaN | NaN |
| Good P0 acceleration plan, but not yet a full robustness plan — and the “fire-and-forget” part should be treated as best-effort, not guaranteed. | NaN | NaN | NaN | NaN | NaN |
| If you want, I can next give you thoughts-only on the fastest path from CANDIDATE → CERTIFIED, ranked by impact vs engineering risk, without touching the code. | NaN | NaN | NaN | NaN | NaN |

## V2 SIGN-OFF
| # | Tier | Requirement | Category | Status | Roadmap Ref | Done When |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | REQUIRED | All production evaluations emit evaluation\_result\_v2 | Contract + fail-closed | OPEN | #8, #8.5 | No legacy/non-canonical result shape written on live path |
| R2 | REQUIRED | runQualityGateV2() runs on real processor path | Contract + fail-closed | OPEN | #8 | Every live evaluation passes V2 gate before persistence |
| R3 | REQUIRED | Invalid V2 outputs fail closed | Contract + fail-closed | OPEN | #8.5 | Bad criterion state causes job failure, not partial success |
| R4 | REQUIRED | No illegal criterion states persisted | Contract + fail-closed | OPEN | #7, #8 | non-scorable=null score; scorable=SUFFICIENT/STRONG signal |
| R5 | REQUIRED | NOT\_APPLICABLE is governance-derived only | Contract + fail-closed | OPEN | #7 | NA from criteria\_plan only, never model invention |
| R6 | REQUIRED | All 13 canonical criteria present exactly once | Contract + fail-closed | OPEN | #8 | No duplicates, omissions, or invented keys |
| R7 | REQUIRED | Scorable criteria meet evidence anchor thresholds | Evidence + observability | OPEN | #10, #11 | All scored criteria satisfy minimum anchor requirements |
| R8 | REQUIRED | Applicability and observability separated | Evidence + observability | OPEN | #7, #10 | Model cannot declare away missing evidence |
| R9 | REQUIRED | Context contamination guard active | Evidence + observability | OPEN | NEW | Contamination triggers failure before persistence |
| R11 | REQUIRED | Live success-path evidence archived | Live proof | OPEN | NEW | One real run proves submit->queued->claimed->running->gated->artifact->complete |
| R12 | REQUIRED | Live failure-path evidence archived | Live proof | OPEN | NEW | One bad-result replay proves gate fail->failed, no complete state written |
| R13 | REQUIRED | Completion only after artifact persistence | Live proof | OPEN | #8, #8.5 | DB cannot end in complete without canonical artifact stored |
| S1 | RECOMMENDED | Immediate worker trigger on submit | Worker + queue | OPEN | #1 | Median pickup near-immediate; cron is fallback only |
| S2 | RECOMMENDED | Reduced cron interval / faster rescue polling | Worker + queue | OPEN | #2 | Worst-case wait bounded tightly |
| S3 | RECOMMENDED | Pass/phase progress writes persisted cleanly | Worker + queue | OPEN | #4 | Phase state changes canonical, not heuristic |
| S4 | RECOMMENDED | Structured worker logs exist | Worker + queue | OPEN | #14 | Claim, phase boundary, failure, artifact write all traceable |
| S5 | RECOMMENDED | Pass handoff quality checks exist | Worker + queue | OPEN | #15 | Downstream passes reject degraded upstream payloads |
| S6 | RECOMMENDED | Confidence score governs output control | Calibration + trust | PARTIAL | #17 | Low-confidence outputs visibly constrained or flagged |
| S7 | RECOMMENDED | Explicit hard-justification mode exists | Calibration + trust | OPEN | #11 | Outputs require stronger evidence for high-certainty conclusions |
| S8 | RECOMMENDED | Convergence/calibration testing in place | Calibration + trust | OPEN | #12 | Repeated cases show stable behavior without precision drift |
| S9 | RECOMMENDED | Voice/Prose Control/disputed-criterion handling tightened | Calibration + trust | OPEN | #7, #10 | Ambiguous criteria fail safely or downgrade appropriately |
| N1 | NICE-TO-HAVE | Auto-refresh / client polling | User experience | OPEN | #3 | Status page updates without manual refresh |
| N2 | NICE-TO-HAVE | Queued-state spinner + elapsed timer | User experience | OPEN | #5 | User sees movement immediately |
| N3 | NICE-TO-HAVE | Per-stage timestamps in UI | User experience | OPEN | #6 | Timing breakdown visible to user |
| N4 | NICE-TO-HAVE | Clearer phase copy / walking-to-start text | User experience | OPEN | #5 | Honest language during wait states |
| N5 | NICE-TO-HAVE | Stale time estimate refinement | User experience | OPEN | #13 | Dynamic p50/p90 replaces static claim |
| N6 | NICE-TO-HAVE | Health metrics dashboard | Admin / operator | OPEN | #16 | Queue depth, p95, max duration visible |
| N7 | NICE-TO-HAVE | Manual-review surfacing for disputed/invalid | Admin / operator | OPEN | #9 | Operator can spot and act on failures |

## ACCEPTANCE STATES
| Below is your V2 Acceptance Doctrine: clear, binary, enforceable. No ambiguity, no “close enough.” |
| --- |
| NaN |
| NaN |
| NaN |
| 🔒 V2 ACCEPTANCE DOCTRINE |
| NaN |
| RevisionGrade — Evaluation Pipeline |
| NaN |
| NaN |
| NaN |
| 1. ACCEPTANCE STATES (BINDING) |
| NaN |
| Only three system states exist at release boundary: |
| NaN |
| type V2AcceptanceState = |
| | 'CERTIFIED'        // V2 achieved |
| | 'CANDIDATE'        // operational but not yet trusted |
| | 'REJECTED';        // fails core doctrine |
| NaN |
| NaN |
| NaN |
| 2. CERTIFIED (TRUE V2) |
| NaN |
| The system is allowed to speak with authority |
| NaN |
| ✅ REQUIRED CONDITIONS (ALL MUST PASS) |
| NaN |
| R1 — Structural Validity Enforcement |
| NaN |
| 13/13 criteria present |
| each has: |
| numeric score |
| evidence |
| reasoning |
| ❗ ANY violation → system blocks output |
| NaN |
| NaN |
| NaN |
| R2 — Fail-Closed Execution |
| NaN |
| if (evaluationStatus === 'INVALID') → BLOCK |
| if (confidence < threshold && !acceptance) → BLOCK |
| NaN |
| No invalid evaluation is ever released as “complete” |
| No composite score shown on invalid runs |
| NaN |
| NaN |
| NaN |
| R3 — Canonical Status Compliance |
| NaN |
| ONLY: |
| "queued" | "running" | "complete" | "failed" |
| No invented states |
| Validity stored separately (valid | invalid | disputed) |
| NaN |
| NaN |
| NaN |
| R4 — Stage Observability (PROVEN) |
| NaN |
| Each job has persisted: |
| NaN |
| queued\_at |
| started\_at |
| pass1\_completed\_at |
| pass2\_completed\_at |
| pass3\_completed\_at |
| finalized\_at |
| NaN |
| 👉 Must be reconstructable end-to-end |
| NaN |
| NaN |
| NaN |
| R5 — Truthful UI Binding |
| NaN |
| UI must derive from persisted state ONLY: |
| NaN |
| progress = stage-based |
| timestamps visible or computable |
| queued state shows elapsed time |
| INVALID visibly marked |
| NaN |
| NaN |
| NaN |
| R6 — Finalizer as Gatekeeper |
| NaN |
| Finalizer MUST: |
| NaN |
| validate structure |
| reject invalid |
| prevent canonical output |
| NaN |
| ❗ It is NOT allowed to “format and pass through” |
| NaN |
| NaN |
| NaN |
| R7 — Evidence Integrity |
| NaN |
| No score without evidence |
| No reasoning without evidence |
| No evidence without traceable text |
| NaN |
| NaN |
| NaN |
| R8 — No Silent Contradictions (Gate 15.2) |
| NaN |
| System must: |
| NaN |
| detect conflicting claims |
| either: |
| resolve them |
| OR penalize confidence |
| NaN |
| ❗ contradictions cannot pass silently |
| NaN |
| NaN |
| NaN |
| R9 — Confidence is Derived (NOT assigned) |
| NaN |
| confidence = deriveConfidence(context) |
| NaN |
| Must include: |
| NaN |
| completeness |
| contradictions |
| pass divergence |
| missing score penalties |
| gate failures |
| NaN |
| NaN |
| NaN |
| R10 — Confidence Governs Output |
| NaN |
| if (confidence < threshold && no acceptance) → BLOCK |
| NaN |
| Confidence is not decorative. |
| NaN |
| It controls release. |
| NaN |
| NaN |
| NaN |
| R11 — Pass-to-Pass Propagation |
| NaN |
| Upstream weakness MUST affect downstream: |
| NaN |
| pass1 weak → affects pass2 |
| pass2 divergence → affects pass3 |
| unresolved → lowers confidence |
| NaN |
| NaN |
| NaN |
| R12 — Confidence Auditability |
| NaN |
| Every run must include: |
| NaN |
| confidence score |
| factors (penalties) |
| sources (pass1, pass2, etc.) |
| formula version |
| NaN |
| 👉 must be explainable post hoc |
| NaN |
| NaN |
| NaN |
| R13 — Success + Failure Path Proven |
| NaN |
| You must demonstrate: |
| NaN |
| ✅ Valid run: |
| NaN |
| passes all checks |
| releases normally |
| NaN |
| ❌ Invalid run: |
| NaN |
| fails criteria |
| blocks output |
| surfaces reason |
| NaN |
| NaN |
| NaN |
| 🎯 CERTIFICATION RULE |
| NaN |
| if (R1–R13 all true) { |
| state = 'CERTIFIED' |
| } |
| NaN |
| NaN |
| NaN |
| 3. CANDIDATE (NOT YET V2) |
| NaN |
| System works, but cannot be trusted fully |
| NaN |
| Conditions: |
| NaN |
| Core pipeline works |
| Observability exists |
| Fail-closed exists |
| NaN |
| BUT one or more of: |
| NaN |
| ❌ confidence incomplete |
| ❌ propagation missing |
| ❌ contradiction detection missing |
| ❌ audit trace incomplete |
| NaN |
| NaN |
| NaN |
| Behavior: |
| NaN |
| System runs |
| Results usable |
| ❗ NOT certified as authoritative |
| NaN |
| NaN |
| NaN |
| 4. REJECTED |
| NaN |
| System is not safe to trust |
| NaN |
| Any of these trigger REJECTED: |
| NaN |
| invalid outputs appear as complete |
| confidence does not control release |
| canonical status violated |
| finalizer allows incomplete outputs |
| contradictions pass silently |
| scores exist without evidence |
| NaN |
| NaN |
| NaN |
| 5. FINAL ACCEPTANCE CHECK (ONE SCREEN) |
| NaN |
| ✅ V2 CHECKLIST |
| NaN |
| 13 criteria enforced |
| fail-closed active |
| canonical statuses enforced |
| timestamps persisted |
| UI reflects truth |
| finalizer blocks invalid |
| evidence required |
| contradictions handled |
| confidence derived |
| confidence gates output |
| propagation enforced |
| audit trace present |
| success + failure paths proven |
| NaN |
| NaN |
| NaN |
| 6. THE ONE LINE THAT DEFINES V2 |
| NaN |
| The system must refuse to produce a confident answer when it does not have the right to. |
| NaN |
| NaN |
| NaN |
| 7. YOUR CURRENT STATE (BASED ON YOUR SHEET) |
| NaN |
| You are here: |
| NaN |
| state = 'CANDIDATE' |
| NaN |
| Because: |
| NaN |
| ✅ pipeline = strong |
| ✅ governance = strong |
| ✅ fail-closed = introduced |
| NaN |
| But: |
| NaN |
| ⚠️ confidence derivation incomplete |
| ❌ propagation missing |
| ❌ contradiction detection missing |
| NaN |
| NaN |
| NaN |
| 8. WHAT FLIPS YOU TO CERTIFIED |
| NaN |
| Implement: |
| NaN |
| U1 — Penalty-based confidence (full CEL) |
| NaN |
| U2 — Pass propagation enforcement |
| NaN |
| U3 — Contradiction detection (Gate 15.2) |
| NaN |
| NaN |
| NaN |
| 🔥 FINAL TRUTH |
| NaN |
| You don’t reach V2 when: |
| NaN |
| it runs fast |
| it looks clean |
| it scores well |
| NaN |
| You reach V2 when: |
| NaN |
| it cannot produce a result that violates its own rules |

## GITHUB PR ACCEPTANCE GATE
| 1. GitHub PR acceptance gate |
| --- |
| NaN |
| This is the policy layer. It tells you when a PR is allowed to merge. |
| NaN |
| PR title |
| NaN |
| V2 Acceptance Gate — Evaluation Pipeline |
| NaN |
| Merge rule |
| NaN |
| A PR touching evaluation runtime, finalizer, confidence, status, or release behavior may merge only if it satisfies the gate below. |
| NaN |
| Required checks |
| NaN |
| name: v2-acceptance-gate |
| NaN |
| on: |
| pull\_request: |
| branches: [main] |
| NaN |
| jobs: |
| v2-acceptance: |
| runs-on: ubuntu-latest |
| steps: |
| - name: Checkout |
| uses: actions/checkout@v4 |
| NaN |
| - name: Setup Node |
| uses: actions/setup-node@v4 |
| with: |
| node-version: 20 |
| NaN |
| - name: Install deps |
| run: npm ci |
| NaN |
| - name: Typecheck |
| run: npm run typecheck |
| NaN |
| - name: Unit tests |
| run: npm test -- --runInBand |
| NaN |
| - name: V2 acceptance tests |
| run: npm run test:v2-acceptance |
| NaN |
| - name: Fail if acceptance manifest missing |
| run: test -f docs/governance/V2\_ACCEPTANCE\_CHECKLIST.md |
| NaN |
| Branch protection |
| NaN |
| Set v2-acceptance as a required status check for main. |
| NaN |
| PR template |
| NaN |
| Use this in .github/pull\_request\_template.md: |
| NaN |
| ## V2 Acceptance Scope |
| NaN |
| Which of these does this PR affect? |
| NaN |
| - [ ] structural validity |
| - [ ] fail-closed execution |
| - [ ] canonical job statuses |
| - [ ] stage timestamps |
| - [ ] truthful UI/status |
| - [ ] finalizer behavior |
| - [ ] evidence integrity |
| - [ ] contradiction detection |
| - [ ] confidence derivation |
| - [ ] confidence-gated release |
| - [ ] pass propagation |
| - [ ] confidence audit trace |
| NaN |
| ## Required declarations |
| NaN |
| - [ ] I did not introduce non-canonical job statuses. |
| - [ ] I did not allow invalid evaluations to render as canonical complete results. |
| - [ ] If this PR touches confidence, confidence is derived rather than hand-assigned. |
| - [ ] If this PR touches finalization, invalid runs are blocked from canonical release. |
| - [ ] If this PR touches pass handoff, upstream weakness is either propagated or explicitly compensated. |
| - [ ] I added or updated tests for success and failure paths. |
| NaN |
| ## Evidence |
| NaN |
| - Acceptance tests added/updated: |
| - Runtime paths affected: |
| - DB fields affected: |
| - UI behavior affected: |
| - Known risks: |
| NaN |
| Review checklist |
| NaN |
| Use this as the reviewer gate: |
| NaN |
| # V2 PR Review Gate |
| NaN |
| A PR is mergeable only if all applicable items below are true. |
| NaN |
| ## Core |
| - [ ] 13 criteria remain enforced |
| - [ ] invalid runs cannot publish canonical output |
| - [ ] composite score is blocked on invalid runs |
| - [ ] canonical job statuses remain: queued, running, complete, failed |
| - [ ] validity state is separate from lifecycle status |
| - [ ] progress derives from persisted stage data, not invented statuses |
| NaN |
| ## Confidence |
| - [ ] confidence is derived, not hard-coded |
| - [ ] confidence reflects incompleteness, contradictions, divergence, or gate failures |
| - [ ] low-confidence release requires explicit acceptance or is blocked |
| - [ ] confidence trace is auditable |
| NaN |
| ## Pass integrity |
| - [ ] upstream weak/incomplete pass output affects downstream confidence or gating |
| - [ ] unresolved contradictions are detected or penalized |
| - [ ] pass handoff checks remain machine-checkable |
| NaN |
| ## Evidence |
| - [ ] every scored criterion has evidence and reasoning |
| - [ ] no score exists without evidence |
| - [ ] no evidence-only criterion silently passes with missing score |
| NaN |
| ## Proof |
| - [ ] success-path test passes |
| - [ ] failure-path test passes |
| NaN |
| NaN |
| NaN |
| 2. Runtime validator module |
| NaN |
| This is the code layer. It enforces the doctrine automatically. |
| NaN |
| File layout |
| NaN |
| lib/v2-acceptance/types.ts |
| lib/v2-acceptance/validator.ts |
| lib/v2-acceptance/confidence.ts |
| lib/v2-acceptance/release.ts |
| tests/v2-acceptance.test.ts |
| NaN |
| NaN |
| NaN |
| lib/v2-acceptance/types.ts |
| NaN |
| export type JobStatus = 'queued' | 'running' | 'complete' | 'failed'; |
| export type EvaluationStatus = 'valid' | 'invalid' | 'disputed'; |
| export type ConfidenceBand = 'low' | 'medium' | 'high'; |
| export type ReleaseDecision = 'allow' | 'allow\_with\_acceptance' | 'block'; |
| NaN |
| export type InputScale = |
| | 'PARAGRAPH' |
| | 'SCENE' |
| | 'CHAPTER' |
| | 'MULTI\_CHAPTER' |
| | 'FULL\_MANUSCRIPT'; |
| NaN |
| export interface CriterionResult { |
| criterion: string; |
| score: number | null; |
| evidence: string[]; |
| reasoning: string; |
| contradictionDetected?: boolean; |
| pass1Incomplete?: boolean; |
| pass2Incomplete?: boolean; |
| passDivergence?: boolean; |
| } |
| NaN |
| export interface EvaluationRun { |
| jobStatus: JobStatus; |
| evaluationStatus?: EvaluationStatus | null; |
| inputScale: InputScale; |
| criteria: CriterionResult[]; |
| gateFailures: string[]; |
| acceptanceRecorded: boolean; |
| readinessCritical: boolean; |
| } |
| NaN |
| export interface ValidationIssue { |
| code: |
| | 'BAD\_JOB\_STATUS' |
| | 'WRONG\_CRITERION\_COUNT' |
| | 'MISSING\_SCORE' |
| | 'MISSING\_EVIDENCE' |
| | 'MISSING\_REASONING' |
| | 'CONTRADICTION' |
| | 'PASS\_PROPAGATION\_REQUIRED'; |
| message: string; |
| criterion?: string; |
| } |
| NaN |
| export interface ValidationResult { |
| evaluationStatus: EvaluationStatus; |
| issues: ValidationIssue[]; |
| } |
| NaN |
| export interface ConfidenceFactor { |
| code: |
| | 'PARTIAL\_COVERAGE' |
| | 'LOW\_EVALUABILITY' |
| | 'INCOMPLETE\_CRITERION' |
| | 'CONTRADICTION' |
| | 'PASS\_DIVERGENCE' |
| | 'MISSING\_SCORE' |
| | 'GATE\_FAILURE' |
| | 'PASS\_PROPAGATION'; |
| penalty: number; |
| reason: string; |
| } |
| NaN |
| export interface ConfidenceResult { |
| score: number; |
| band: ConfidenceBand; |
| cap: number; |
| factors: ConfidenceFactor[]; |
| formulaVersion: string; |
| } |
| NaN |
| export interface AcceptanceDecisionResult { |
| validation: ValidationResult; |
| confidence: ConfidenceResult; |
| releaseDecision: ReleaseDecision; |
| } |
| NaN |
| NaN |
| NaN |
| lib/v2-acceptance/confidence.ts |
| NaN |
| import { |
| ConfidenceBand, |
| ConfidenceFactor, |
| ConfidenceResult, |
| EvaluationRun, |
| InputScale, |
| } from './types'; |
| NaN |
| const MAX\_CONFIDENCE\_BY\_SCALE: Record<InputScale, number> = { |
| PARAGRAPH: 40, |
| SCENE: 65, |
| CHAPTER: 75, |
| MULTI\_CHAPTER: 85, |
| FULL\_MANUSCRIPT: 95, |
| }; |
| NaN |
| const PENALTIES = { |
| LOW\_EVALUABILITY: 12, |
| INCOMPLETE\_CRITERION: 8, |
| CONTRADICTION: 10, |
| PASS\_DIVERGENCE: 6, |
| MISSING\_SCORE: 15, |
| GATE\_FAILURE: 20, |
| PASS\_PROPAGATION: 8, |
| } as const; |
| NaN |
| function bandFor(score: number): ConfidenceBand { |
| if (score >= 80) return 'high'; |
| if (score >= 50) return 'medium'; |
| return 'low'; |
| } |
| NaN |
| export function deriveConfidence(run: EvaluationRun): ConfidenceResult { |
| const cap = MAX\_CONFIDENCE\_BY\_SCALE[run.inputScale]; |
| const factors: ConfidenceFactor[] = []; |
| NaN |
| if (run.criteria.length < 13) { |
| factors.push({ |
| code: 'LOW\_EVALUABILITY', |
| penalty: PENALTIES.LOW\_EVALUABILITY, |
| reason: 'Too few scorable criteria to support high-confidence output.', |
| }); |
| } |
| NaN |
| for (const c of run.criteria) { |
| if (c.score == null) { |
| factors.push({ |
| code: 'MISSING\_SCORE', |
| penalty: PENALTIES.MISSING\_SCORE, |
| reason: `Criterion missing score: ${c.criterion}`, |
| }); |
| } |
| NaN |
| if (c.pass1Incomplete || c.pass2Incomplete) { |
| factors.push({ |
| code: 'INCOMPLETE\_CRITERION', |
| penalty: PENALTIES.INCOMPLETE\_CRITERION, |
| reason: `Criterion incomplete upstream: ${c.criterion}`, |
| }); |
| } |
| NaN |
| if (c.passDivergence) { |
| factors.push({ |
| code: 'PASS\_DIVERGENCE', |
| penalty: PENALTIES.PASS\_DIVERGENCE, |
| reason: `Unresolved pass divergence: ${c.criterion}`, |
| }); |
| } |
| NaN |
| if (c.contradictionDetected) { |
| factors.push({ |
| code: 'CONTRADICTION', |
| penalty: PENALTIES.CONTRADICTION, |
| reason: `Contradiction detected: ${c.criterion}`, |
| }); |
| } |
| NaN |
| if ((c.pass1Incomplete || c.pass2Incomplete) && c.score != null) { |
| factors.push({ |
| code: 'PASS\_PROPAGATION', |
| penalty: PENALTIES.PASS\_PROPAGATION, |
| reason: `Upstream weakness must reduce confidence: ${c.criterion}`, |
| }); |
| } |
| } |
| NaN |
| for (const gate of run.gateFailures) { |
| factors.push({ |
| code: 'GATE\_FAILURE', |
| penalty: PENALTIES.GATE\_FAILURE, |
| reason: `Governance gate failure: ${gate}`, |
| }); |
| } |
| NaN |
| const totalPenalty = factors.reduce((sum, f) => sum + f.penalty, 0); |
| const score = Math.max(0, Math.min(cap, cap - totalPenalty)); |
| NaN |
| return { |
| score, |
| band: bandFor(score), |
| cap, |
| factors, |
| formulaVersion: 'v2-cel-1', |
| }; |
| } |
| NaN |
| NaN |
| NaN |
| lib/v2-acceptance/validator.ts |
| NaN |
| import { EvaluationRun, ValidationIssue, ValidationResult } from './types'; |
| NaN |
| const CANONICAL\_JOB\_STATUSES = new Set(['queued', 'running', 'complete', 'failed']); |
| NaN |
| export function validateEvaluationRun(run: EvaluationRun): ValidationResult { |
| const issues: ValidationIssue[] = []; |
| NaN |
| if (!CANONICAL\_JOB\_STATUSES.has(run.jobStatus)) { |
| issues.push({ |
| code: 'BAD\_JOB\_STATUS', |
| message: `Non-canonical job status: ${run.jobStatus}`, |
| }); |
| } |
| NaN |
| if (run.criteria.length !== 13) { |
| issues.push({ |
| code: 'WRONG\_CRITERION\_COUNT', |
| message: `Expected 13 criteria, got ${run.criteria.length}`, |
| }); |
| } |
| NaN |
| for (const c of run.criteria) { |
| if (c.score == null) { |
| issues.push({ |
| code: 'MISSING\_SCORE', |
| criterion: c.criterion, |
| message: `Missing score for ${c.criterion}`, |
| }); |
| } |
| NaN |
| if (!Array.isArray(c.evidence) || c.evidence.length === 0) { |
| issues.push({ |
| code: 'MISSING\_EVIDENCE', |
| criterion: c.criterion, |
| message: `Missing evidence for ${c.criterion}`, |
| }); |
| } |
| NaN |
| if (!c.reasoning || !c.reasoning.trim()) { |
| issues.push({ |
| code: 'MISSING\_REASONING', |
| criterion: c.criterion, |
| message: `Missing reasoning for ${c.criterion}`, |
| }); |
| } |
| NaN |
| if (c.contradictionDetected) { |
| issues.push({ |
| code: 'CONTRADICTION', |
| criterion: c.criterion, |
| message: `Contradiction detected for ${c.criterion}`, |
| }); |
| } |
| NaN |
| if ((c.pass1Incomplete || c.pass2Incomplete) && c.score != null) { |
| issues.push({ |
| code: 'PASS\_PROPAGATION\_REQUIRED', |
| criterion: c.criterion, |
| message: `Upstream weakness exists for ${c.criterion}; downstream confidence penalty required.`, |
| }); |
| } |
| } |
| NaN |
| return { |
| evaluationStatus: issues.length > 0 ? 'invalid' : 'valid', |
| issues, |
| }; |
| } |
| NaN |
| NaN |
| NaN |
| lib/v2-acceptance/release.ts |
| NaN |
| import { ConfidenceResult, EvaluationStatus, ReleaseDecision } from './types'; |
| NaN |
| export function deriveReleaseDecision(args: { |
| evaluationStatus: EvaluationStatus; |
| confidence: ConfidenceResult; |
| acceptanceRecorded: boolean; |
| readinessCritical: boolean; |
| }): ReleaseDecision { |
| const { evaluationStatus, confidence, acceptanceRecorded, readinessCritical } = args; |
| NaN |
| if (evaluationStatus === 'invalid') return 'block'; |
| NaN |
| if (readinessCritical && confidence.score < 95) { |
| return acceptanceRecorded ? 'allow\_with\_acceptance' : 'block'; |
| } |
| NaN |
| if (confidence.band === 'low') { |
| return acceptanceRecorded ? 'allow\_with\_acceptance' : 'block'; |
| } |
| NaN |
| return 'allow'; |
| } |
| NaN |
| NaN |
| NaN |
| Composed entrypoint |
| NaN |
| You can also wrap it: |
| NaN |
| import { deriveConfidence } from './confidence'; |
| import { deriveReleaseDecision } from './release'; |
| import { EvaluationRun, AcceptanceDecisionResult } from './types'; |
| import { validateEvaluationRun } from './validator'; |
| NaN |
| export function evaluateV2Acceptance(run: EvaluationRun): AcceptanceDecisionResult { |
| const validation = validateEvaluationRun(run); |
| const confidence = deriveConfidence(run); |
| const releaseDecision = deriveReleaseDecision({ |
| evaluationStatus: validation.evaluationStatus, |
| confidence, |
| acceptanceRecorded: run.acceptanceRecorded, |
| readinessCritical: run.readinessCritical, |
| }); |
| NaN |
| return { |
| validation, |
| confidence, |
| releaseDecision, |
| }; |
| } |
| NaN |
| NaN |
| NaN |
| Tests |
| NaN |
| tests/v2-acceptance.test.ts |
| NaN |
| import { evaluateV2Acceptance } from '../lib/v2-acceptance'; |
| import { EvaluationRun } from '../lib/v2-acceptance/types'; |
| NaN |
| function buildValidRun(): EvaluationRun { |
| return { |
| jobStatus: 'complete', |
| inputScale: 'CHAPTER', |
| criteria: Array.from({ length: 13 }, (\_, i) => ({ |
| criterion: `criterion-${i + 1}`, |
| score: 7, |
| evidence: ['Quoted evidence'], |
| reasoning: 'Sound reasoning.', |
| contradictionDetected: false, |
| pass1Incomplete: false, |
| pass2Incomplete: false, |
| passDivergence: false, |
| })), |
| gateFailures: [], |
| acceptanceRecorded: false, |
| readinessCritical: false, |
| }; |
| } |
| NaN |
| describe('V2 acceptance', () => { |
| test('valid run is allowed', () => { |
| const run = buildValidRun(); |
| const result = evaluateV2Acceptance(run); |
| NaN |
| expect(result.validation.evaluationStatus).toBe('valid'); |
| expect(result.releaseDecision).toBe('allow'); |
| }); |
| NaN |
| test('missing score blocks release', () => { |
| const run = buildValidRun(); |
| run.criteria[0].score = null; |
| NaN |
| const result = evaluateV2Acceptance(run); |
| NaN |
| expect(result.validation.evaluationStatus).toBe('invalid'); |
| expect(result.releaseDecision).toBe('block'); |
| }); |
| NaN |
| test('non-canonical job status invalidates run', () => { |
| const run = buildValidRun(); |
| run.jobStatus = 'RUNNING' as any; |
| NaN |
| const result = evaluateV2Acceptance(run); |
| NaN |
| expect(result.validation.evaluationStatus).toBe('invalid'); |
| expect(result.releaseDecision).toBe('block'); |
| }); |
| NaN |
| test('low-confidence readiness-critical run requires acceptance', () => { |
| const run = buildValidRun(); |
| run.readinessCritical = true; |
| run.criteria[0].pass1Incomplete = true; |
| run.criteria[1].pass2Incomplete = true; |
| run.criteria[2].passDivergence = true; |
| NaN |
| const result = evaluateV2Acceptance(run); |
| NaN |
| expect(result.confidence.score).toBeLessThan(95); |
| expect(result.releaseDecision).toBe('block'); |
| NaN |
| run.acceptanceRecorded = true; |
| const withAcceptance = evaluateV2Acceptance(run); |
| expect(withAcceptance.releaseDecision).toBe('allow\_with\_acceptance'); |
| }); |
| NaN |
| test('contradictions reduce confidence and can block', () => { |
| const run = buildValidRun(); |
| run.criteria[0].contradictionDetected = true; |
| NaN |
| const result = evaluateV2Acceptance(run); |
| NaN |
| expect(result.confidence.factors.some(f => f.code === 'CONTRADICTION')).toBe(true); |
| }); |
| }); |
| NaN |
| NaN |
| NaN |
| How these two pieces work together |
| NaN |
| The GitHub gate prevents merging changes that violate V2 doctrine. |
| NaN |
| The runtime validator prevents the live system from producing outputs that violate V2 doctrine. |
| NaN |
| That gives you both: |
| NaN |
| pre-merge enforcement |
| runtime enforcement |
| NaN |
| If you want, next I’ll turn this into a single repo-ready patch with exact file contents and a Jest/Vitest package script block. |
