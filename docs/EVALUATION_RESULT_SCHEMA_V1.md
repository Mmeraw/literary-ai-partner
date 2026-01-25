# EvaluationResult Schema v1

**Version**: `evaluation_result_v1`  
**Created**: 2026-01-25  
**Status**: ✅ Locked  
**Implementation**: [schemas/evaluation-result-v1.ts](../schemas/evaluation-result-v1.ts)

---

## Purpose

The `EvaluationResultV1` schema is the **authoritative result envelope** for manuscript evaluations. It provides a stable, versioned contract between:

1. **Evaluation engine** (AI models, rubric evaluators)
2. **Report page** (UI rendering)
3. **Package generators** (query letters, synopses, pitch decks)
4. **Downstream tools** (analytics, agent portals, revision trackers)

---

## Core Principles

### 1. Versioned Envelope
- `schema_version: "evaluation_result_v1"` enables forward compatibility
- Future schema changes introduce new versions (v2, v3) without breaking existing consumers
- Type guards (`isEvaluationResultV1`) enable safe runtime validation

### 2. 13-Criteria Rubric
Fixed criteria set ensures consistent evaluation across all manuscripts:
- concept, plot, character, dialogue, voice, pacing, structure
- theme, worldbuilding, stakes, clarity, marketability, craft

Each criterion includes:
- Score (0-10)
- Rationale
- Evidence (snippets from manuscript)
- Specific recommendations

### 3. Traceability
Every result includes full lineage:
- `evaluation_run_id` - unique identifier for this evaluation
- `job_id` - links to processing job (if applicable)
- `manuscript_id` - source manuscript
- `user_id` - owner
- `generated_at` - timestamp
- `engine` metadata - model, provider, prompt version

### 4. Actionable Recommendations
Two-tier recommendation structure:
- **Quick wins**: Low effort, visible impact (fix typos, clarify exposition)
- **Strategic revisions**: Higher effort, fundamental improvements (restructure act 2, deepen antagonist)

Each recommendation includes effort/impact ratings for prioritization.

### 5. Artifact References
Links to generated outputs:
- evaluation_report (the report itself)
- query_letter, synopsis, one_page (package outputs)
- pitch_deck, scene_list, revision_plan (derivative artifacts)

Enables "Evaluate → Package → Deliver" vertical slice.

---

## Schema Structure

### IDs (Traceability)
```typescript
ids: {
  evaluation_run_id: string;  // UUID
  job_id?: string;            // UUID (if job-driven)
  manuscript_id: number;      // Primary key
  project_id?: number;        // Project grouping
  user_id: string;            // auth.users UUID
}
```

### Overview (Executive Summary)
```typescript
overview: {
  verdict: "pass" | "revise" | "fail";
  overall_score_0_100: number;
  one_paragraph_summary: string;
  top_3_strengths: string[];
  top_3_risks: string[];
}
```

### Criteria (Detailed Rubric)
```typescript
criteria: Array<{
  key: "concept" | "plot" | "character" | ... (13 total);
  score_0_10: number;
  rationale: string;
  evidence: Array<{
    snippet: string;
    location?: { segment_id, char_start, char_end };
    note?: string;
  }>;
  recommendations: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    expected_impact: string;
  }>;
}>
```

### Recommendations (Cross-Cutting)
```typescript
recommendations: {
  quick_wins: Array<{
    action: string;
    why: string;
    effort: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
  }>;
  strategic_revisions: Array<{
    action: string;
    why: string;
    effort: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
  }>;
}
```

### Metrics (Quantitative Data)
```typescript
metrics: {
  manuscript: {
    word_count?: number;
    char_count?: number;
    genre?: string;
    target_audience?: string;
  };
  processing: {
    segment_count?: number;
    total_tokens_estimated?: number;
    runtime_ms?: number;
  };
}
```

### Artifacts (Generated Outputs)
```typescript
artifacts: Array<{
  type: "evaluation_report" | "query_letter" | "synopsis" | ...;
  artifact_id: string;
  title: string;
  status: "ready" | "pending" | "failed";
  created_at?: string;
}>
```

### Governance (Confidence & Warnings)
```typescript
governance: {
  confidence: number;         // 0.0 - 1.0
  warnings: string[];
  limitations: string[];
  policy_family: string;
}
```

---

## Usage Examples

### 1. Creating a Result (Evaluation Engine)

```typescript
import { EvaluationResultV1 } from '@/schemas/evaluation-result-v1';

const result: EvaluationResultV1 = {
  schema_version: "evaluation_result_v1",
  ids: {
    evaluation_run_id: crypto.randomUUID(),
    job_id: jobId,
    manuscript_id: 42,
    user_id: userId,
  },
  generated_at: new Date().toISOString(),
  engine: {
    model: "gpt-4o",
    provider: "openai",
    prompt_version: "rubric-v1.2.0",
  },
  overview: {
    verdict: "revise",
    overall_score_0_100: 72,
    one_paragraph_summary: "Strong concept with compelling characters, but pacing issues in Act 2...",
    top_3_strengths: [
      "Unique premise with clear hook",
      "Well-developed protagonist arc",
      "Vivid worldbuilding"
    ],
    top_3_risks: [
      "Act 2 pacing drags in middle",
      "Antagonist motivation unclear",
      "Ending feels rushed"
    ],
  },
  criteria: [
    {
      key: "concept",
      score_0_10: 8,
      rationale: "Original premise with strong market potential",
      evidence: [
        {
          snippet: "A therapist who can enter patients' dreams...",
          note: "Immediately engaging hook"
        }
      ],
      recommendations: [
        {
          priority: "medium",
          action: "Clarify the rules/limitations of the dream-entering ability",
          expected_impact: "Increases tension and stakes"
        }
      ]
    },
    // ... 12 more criteria
  ],
  recommendations: {
    quick_wins: [
      {
        action: "Cut 2,000 words from Act 2 middle",
        why: "Tightens pacing without losing key beats",
        effort: "low",
        impact: "high"
      }
    ],
    strategic_revisions: [
      {
        action: "Add backstory scene showing antagonist's trauma",
        why: "Makes villain sympathetic, raises emotional stakes",
        effort: "high",
        impact: "high"
      }
    ]
  },
  metrics: {
    manuscript: {
      word_count: 92000,
      genre: "psychological thriller",
      target_audience: "adult"
    },
    processing: {
      segment_count: 18,
      runtime_ms: 245000
    }
  },
  artifacts: [
    {
      type: "evaluation_report",
      artifact_id: crypto.randomUUID(),
      title: "Full Evaluation Report",
      status: "ready",
      created_at: new Date().toISOString()
    }
  ],
  governance: {
    confidence: 0.87,
    warnings: ["Limited genre-specific training data for psychological thrillers"],
    limitations: ["Cannot assess prose quality at sentence level"],
    policy_family: "standard"
  }
};
```

### 2. Validating a Result

```typescript
import { validateEvaluationResult } from '@/schemas/evaluation-result-v1';

const { valid, errors } = validateEvaluationResult(result);

if (!valid) {
  console.error("Validation failed:", errors);
  // Handle errors
}
```

### 3. Rendering in Report Page

```typescript
import { EvaluationResultV1 } from '@/schemas/evaluation-result-v1';

export function ReportPage({ result }: { result: EvaluationResultV1 }) {
  return (
    <div>
      <h1>Evaluation Report</h1>
      
      {/* Overview Section */}
      <section>
        <h2>Overall: {result.overview.overall_score_0_100}/100</h2>
        <p>{result.overview.one_paragraph_summary}</p>
        
        <div>
          <h3>Strengths</h3>
          <ul>
            {result.overview.top_3_strengths.map(s => <li>{s}</li>)}
          </ul>
        </div>
        
        <div>
          <h3>Risks</h3>
          <ul>
            {result.overview.top_3_risks.map(r => <li>{r}</li>)}
          </ul>
        </div>
      </section>
      
      {/* Criteria Section */}
      <section>
        <h2>Detailed Scores</h2>
        {result.criteria.map(criterion => (
          <div key={criterion.key}>
            <h3>{criterion.key}: {criterion.score_0_10}/10</h3>
            <p>{criterion.rationale}</p>
            {/* Render evidence, recommendations */}
          </div>
        ))}
      </section>
      
      {/* Recommendations Section */}
      <section>
        <h2>Action Items</h2>
        <h3>Quick Wins</h3>
        {result.recommendations.quick_wins.map(qw => (
          <div>
            <strong>{qw.action}</strong> ({qw.effort} effort, {qw.impact} impact)
            <p>{qw.why}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

### 4. Generating Package Artifacts

```typescript
// Query letter generator consumes the evaluation result
export async function generateQueryLetter(
  result: EvaluationResultV1
): Promise<string> {
  const { overview, criteria } = result;
  
  // Use top strengths as hooks
  const hooks = overview.top_3_strengths;
  
  // Reference marketability criterion
  const marketability = criteria.find(c => c.key === "marketability");
  
  // Generate letter
  return `
    Dear Agent,
    
    ${hooks[0]} // Lead with strongest hook
    
    [Incorporate marketability insights from ${marketability.rationale}]
    
    ...
  `;
}
```

---

## Storage in Database

The `EvaluationResultV1` is stored as JSONB in PostgreSQL:

```sql
-- In evaluation_jobs or evaluation_results table
CREATE TABLE evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  result JSONB NOT NULL,  -- EvaluationResultV1
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by schema version
CREATE INDEX idx_evaluation_results_schema_version 
ON evaluation_results ((result->>'schema_version'));

-- Index for querying by verdict
CREATE INDEX idx_evaluation_results_verdict
ON evaluation_results ((result->'overview'->>'verdict'));
```

**Query examples**:
```sql
-- Get all evaluations for a manuscript
SELECT result FROM evaluation_results
WHERE manuscript_id = 42
  AND result->>'schema_version' = 'evaluation_result_v1'
ORDER BY created_at DESC;

-- Get all "pass" verdicts
SELECT result FROM evaluation_results
WHERE result->'overview'->>'verdict' = 'pass';

-- Get evaluations with high concept scores
SELECT result FROM evaluation_results
WHERE (
  result->'criteria'->0->>'key' = 'concept' 
  AND (result->'criteria'->0->>'score_0_10')::int >= 8
);
```

---

## Migration Path

### From Unstructured Results (Current)

If you currently have unstructured evaluation results, migrate to v1:

```typescript
function migrateToV1(legacyResult: any): EvaluationResultV1 {
  return {
    schema_version: "evaluation_result_v1",
    ids: {
      evaluation_run_id: legacyResult.id || crypto.randomUUID(),
      manuscript_id: legacyResult.manuscript_id,
      user_id: legacyResult.user_id,
    },
    generated_at: legacyResult.created_at || new Date().toISOString(),
    engine: {
      model: legacyResult.model || "unknown",
      provider: "openai",
      prompt_version: "legacy",
    },
    overview: {
      verdict: legacyResult.verdict || "revise",
      overall_score_0_100: legacyResult.overall_score || 50,
      one_paragraph_summary: legacyResult.summary || "",
      top_3_strengths: legacyResult.strengths || [],
      top_3_risks: legacyResult.risks || [],
    },
    // ... map remaining fields with defaults
  };
}
```

### To Future Versions (v2, v3)

When schema evolves, add version-specific fields while maintaining v1 compatibility:

```typescript
export type EvaluationResultV2 = EvaluationResultV1 & {
  schema_version: "evaluation_result_v2";
  // New fields
  comparative_analysis?: {
    comparable_titles: string[];
    market_positioning: string;
  };
};

// Consumers check version and handle accordingly
function renderReport(result: EvaluationResultV1 | EvaluationResultV2) {
  if (result.schema_version === "evaluation_result_v2") {
    // Render v2-specific features
  } else {
    // Render v1 baseline
  }
}
```

---

## Next Steps

### 1. Wire Report Page
- Read `evaluation_result` JSONB from database
- Parse as `EvaluationResultV1`
- Render sections: overview, criteria, recommendations, artifacts
- Handle missing/incomplete data gracefully

### 2. Implement Package Generator
- Consume `EvaluationResultV1` as input
- Generate query letter using top strengths + marketability insights
- Store generated artifact with reference back to evaluation

### 3. Update Evaluation Engine
- Ensure AI output conforms to `EvaluationResultV1` schema
- Use `validateEvaluationResult()` before persisting
- Log validation errors for debugging

### 4. Add Report Preview
- Create `/api/jobs/[jobId]/evaluation-result` endpoint
- Return `EvaluationResultPreview` (lightweight subset)
- Enable job list UI to show verdicts without full load

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-25 | Lock 13-criteria rubric | Consistent evaluation across all manuscripts, matches domain expert rubric |
| 2026-01-25 | Two-tier recommendations | Enables prioritization (quick wins vs. strategic revisions) |
| 2026-01-25 | Include engine metadata | Reproducibility and debugging (prompt version tracking) |
| 2026-01-25 | Artifact references | Enables "Evaluate → Package" vertical slice |
| 2026-01-25 | Governance section | Confidence + warnings = AI transparency |

---

## Status

✅ Schema locked at v1  
✅ TypeScript types defined  
✅ Validation function implemented  
✅ Examples documented  

**Ready for implementation**: Report page, package generator, evaluation engine can all consume this schema immediately.
