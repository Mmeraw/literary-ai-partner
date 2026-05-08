**E2E Evaluation Flow Architecture**

| **Stage** | **What it tells you** |
| --- | --- |

| **Stage** | **What it tells you** |
| --- | --- |
| job creation → kickoff | queue/scheduling overhead |
| kickoff → claim | worker availability lag |
| claim → pipeline\_run start | fetch manuscript cost |
| pass1 + pass2 (parallel) | OpenAI parallel call cost |
| pass3 | synthesis cost |
| quality\_gate | gate overhead |
| pass4\_cross\_check | Perplexity call + retry cost |
| persist\_artifacts + finalize | DB write overhead |

Here is your TRUE system now (post-adjustment):

SUBMIT
 ↓
JOB CREATED (idempotent)
 ↓
QUEUE + LEASE
 ↓
PASS 1 → artifact
PASS 2 → artifact
PASS 3 → artifact
 ↓
GOVERNED CONVERGENCE
 ↓
FINALIZER (fail-closed)
 ↓
CANONICAL ARTIFACT
 ↓
SUMMARY PROJECTION
 ↓
REPORT (A6 + governance visible)
 ↓
WAVE ELIGIBILITY
 ↓
REVISION ENTRY

\*\*\*
