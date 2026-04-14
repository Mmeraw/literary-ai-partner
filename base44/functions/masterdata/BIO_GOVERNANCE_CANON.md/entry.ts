# BIO GOVERNANCE CANON v1.0
**RevisionGrade Biography Generation Standard**  
**Effective Date:** 2026-01-07  
**Purpose:** Establish audit-friendly, truth-bounded guardrails for author biography generation

---

## 1. BIO CONTENT CONTRACT

### 1.1 Definition
An author biography is **credential-bearing text** that establishes professional authority to write a specific manuscript. It is NOT marketing copy, promotional material, or aspirational self-description.

### 1.2 Purpose Hierarchy
1. **Primary:** Establish credibility with literary agents based on verifiable credentials
2. **Secondary:** Contextualize the author's unique qualifications for THIS manuscript
3. **Tertiary:** Present professional identity in third-person, agent-ready format

### 1.3 Scope Boundaries
- **Query Bio:** 50-100 words, ultra-selective, agent-focused
- **Long Bio:** 200-250 words, expanded context, media/website suitable
- **Universal Rule:** Every claim must be evidence-anchored or omitted

---

## 2. HARD BLOCKS

### 2.1 Disallowed Language Without Evidence
The following terms are **PROHIBITED** unless backed by named, verifiable evidence:

#### Tier 1 - Absolute Blocks (No Exceptions)
- `unique` / `uniquely` → Replace with specific descriptor
- `leading` → Requires named ranking body or publication
- `world-class` → Requires international recognition proof
- `renowned` → Requires media citations or award names
- `expert` → Requires institutional validation (PhD, board certification, etc.)
- `acclaimed` → Requires named awards or critic quotes
- `groundbreaking` → Requires innovation documentation
- `trailblazing` → Requires first-mover evidence

#### Tier 2 - Evidence-Required Claims
- `award-winning` → MUST name the award
- `published author` → MUST name publication or publisher
- `recognized` → MUST name recognizing body
- `certified` → MUST name certifying organization
- `licensed` → MUST name licensing authority

### 2.2 Definition of Evidence
**Evidence** refers to user-provided, declarative information that names a verifiable entity, institution, publication, credential, or measurable outcome. RevisionGrade does not independently verify claims but requires claims to be structurally verifiable.

**What Counts as Evidence:**
- Named institutions (MIT, Stanford, Johns Hopkins)
- Named publications (The New Yorker, Nature, Random House)
- Named awards (Pushcart Prize, NEA Fellowship, Pulitzer)
- Named organizations (Society for Technical Communication, MLA)
- Specific metrics (10 years, PhD, 5 publications)

**What Does NOT Count as Evidence:**
- Self-assessment ("I am an expert")
- Aspirational claims ("I will be a bestseller")
- Generic statements ("passionate about writing")
- Implied credentials without names

### 2.3 Enforcement Logic
```
IF claim contains HARD_BLOCK_TERM:
    IF no evidence in input:
        REPLACE with neutral descriptor
        LOG: "Hard block replaced: [term]"
    ELSE:
        ANCHOR with evidence: "[credential] recognized by [named body]"
```

---

## 3. SOFT CLAIM CONTROL

### 3.1 Quantifier Rules
Quantifiers create implied expertise. Use precision over vagueness.

#### Temporal Quantifiers
- `over X years` → ALLOWED if input specifies duration
- `decades of` → REQUIRES input mentions 20+ years explicitly
- `extensive experience` → BLOCK unless >10 years documented
- `seasoned` → BLOCK unless >15 years documented
- `veteran` → BLOCK unless >20 years documented

#### Scale Quantifiers
- `numerous` → Replace with exact count if <10, "multiple" if evidence exists
- `several` → ALLOWED if 3-7 items documented
- `many` → BLOCK unless >10 items documented
- `widely` → BLOCK unless multi-regional evidence

### 3.2 Replacement Strategy
```
VAGUE → PRECISE
"extensive experience" → "12 years of professional experience"
"numerous publications" → "published in 5 journals"
"widely recognized" → "recognized by [named body]"
```

---

## 4. EVIDENCE-AWARE PRESTIGE

### 4.1 Prestige Anchoring Protocol
Prestige claims MUST include the prestige-granting entity.

#### Format Requirements
- **Publications:** Name the journal/outlet: "published in *Nature*"
- **Awards:** Name the award: "recipient of the Pushcart Prize"
- **Degrees:** Name the institution: "PhD in Biology from MIT"
- **Certifications:** Name the body: "board-certified by [organization]"
- **Affiliations:** Name the org: "senior member of Society for Technical Communication"

### 4.2 Prestige Hierarchy
When multiple credentials exist, prioritize by agent-relevance:

1. **Tier 1:** Named literary awards, major publication credits
2. **Tier 2:** Advanced degrees from recognized institutions
3. **Tier 3:** Professional certifications, association memberships
4. **Tier 4:** Relevant work experience, subject matter expertise
5. **Tier 5:** Life experience relevant to manuscript theme

### 4.3 Anti-Pattern Detection
```
BLOCK: "acclaimed author" (no named acclaim)
ALLOW: "recipient of the Iowa Review Award"

BLOCK: "expert in neuroscience" (no institutional proof)
ALLOW: "PhD in Neuroscience from Johns Hopkins"
```

---

## 5. STRUCTURAL RULES

### 5.1 Required Bio Elements (Query Bio)
**Order of precedence:**
1. **Lead Credential** (highest prestige, named)
2. **Manuscript Relevance** (why qualified for THIS story)
3. **Supporting Credentials** (secondary qualifications, named)
4. **Current Status** (optional, if agent-relevant)

### 5.2 Required Bio Elements (Long Bio)
**Order of precedence:**
1. **Lead Credential** (highest prestige, named)
2. **Professional Background** (expanded context)
3. **Manuscript Relevance** (why qualified for THIS story)
4. **Publications/Awards** (named, with details)
5. **Current Work/Life** (humanizing context)
6. **Aspirations** (optional, future-oriented)

### 5.3 Third-Person Mandate
- ALWAYS use third person: "[Name] is a..."
- NEVER use first person: "I am a..."
- NEVER use second person: "You will find..."

---

## 6. ROLE ALIGNMENT

### 6.1 Bio Must Reference Role-Appropriate Deliverables
The bio's depth must match the author's documented output.

#### No Publications Case
- **Lead with:** Relevant expertise, education, or life experience
- **Frame as:** "brings [X years] of [field] experience to fiction"
- **Avoid:** Implying published status

#### With Publications Case
- **Lead with:** Named publications (journal, publisher, title)
- **Include:** Awards, recognition, sales metrics if documented
- **Frame as:** Established author expanding into [new genre]

#### First-Time Novelist Case
- **Lead with:** Subject matter expertise or unique background
- **Acknowledge:** "debut novel" or "first fiction work"
- **Emphasize:** Why THIS story, not generic writing passion

### 6.2 Deliverable Evidence Chain
```
INPUT: "Published 3 short stories in literary magazines"
OUTPUT: "has published short fiction in [name journals]"

INPUT: "No publications"
OUTPUT: "brings 15 years of emergency medicine experience to medical thriller"
```

---

## 7. CONFIDENCE SCORING

### 7.1 Confidence Bands
Every bio generation outputs a confidence score based on evidence density.

#### High Confidence (80-100%)
- Named publications, awards, or degrees
- Specific years, institutions, recognitions
- Quantifiable achievements with evidence
- Clear manuscript-relevance connection

#### Medium Confidence (50-79%)
- General professional experience documented
- Documented professional experience without named institutional anchors
- Vague temporal markers ("years of experience")
- Indirect manuscript relevance

#### Low Confidence (0-49%)
- No verifiable credentials in input
- Self-assessed expertise only
- Generic "passion for writing" statements
- No manuscript-relevance connection

### 7.2 Confidence Triggers
```
HIGH CONFIDENCE SIGNALS:
- Named institutions (MIT, Stanford, Iowa Writers' Workshop)
- Named awards (Pushcart, NEA Fellowship, Pulitzer)
- Named publications (The New Yorker, Nature, Random House)
- Specific years, dates, metrics

LOW CONFIDENCE SIGNALS:
- No proper nouns in credentials
- "I am passionate about..."
- "I have always loved..."
- No professional background documented
```

---

## 8. OUTPUT REQUIREMENTS

### 8.1 Mandatory Outputs
Every bio generation MUST return:
```json
{
  "query_bio": "string (50-100 words)",
  "long_bio": "string (200-250 words)",
  "confidence_score": "number (0-100)",
  "confidence_band": "HIGH | MEDIUM | LOW",
  "evidence_anchors": ["list of named credentials used"],
  "blocked_terms": ["list of terms replaced or removed"],
  "prestige_tier": "1-5",
  "manuscript_relevance": "string (how author qualifies for THIS story)"
}
```

### 8.2 Audit Trail Requirements
Log all governance interventions:
- Hard blocks replaced
- Soft claims adjusted
- Evidence anchors added
- Prestige claims validated/rejected

### 8.3 Anti-Hallucination Rule
The system MUST NOT fabricate, infer, or embellish credentials, publications, institutions, awards, or durations not explicitly provided in the input. When evidence is missing, the system must neutralize or omit claims rather than invent details.

**Prohibited Actions:**
- Inventing institution names not in input
- Fabricating publication titles or journals
- Inferring awards or honors not stated
- Extrapolating years of experience beyond input
- Creating plausible-sounding but fictional credentials

**Required Actions When Evidence Absent:**
- Use neutral language ("brings professional experience")
- Omit specifics rather than invent
- Log missing evidence for user feedback
- Lower confidence score accordingly

### 8.4 User-Facing Messaging
If confidence score < 50%, return warning:
```
"⚠️ Bio confidence: LOW. Consider adding:
- Named publications, awards, or degrees
- Specific professional credentials
- Relevant subject matter expertise
- Connection to manuscript theme"
```

---

## 9. IMPLEMENTATION CHECKLIST

### Pre-Generation Validation
- [ ] Input contains >50 words of bio information
- [ ] Input is not generic "I love writing" boilerplate
- [ ] At least one verifiable credential detected

### Generation-Time Validation
- [ ] All HARD_BLOCK terms checked against evidence
- [ ] Quantifiers meet documented thresholds
- [ ] Prestige claims anchored to named bodies
- [ ] Third-person voice enforced
- [ ] Manuscript relevance connection made

### Post-Generation Validation
- [ ] Word count within bounds (Query: 50-100, Long: 200-250)
- [ ] Confidence score calculated and returned
- [ ] Evidence anchors documented
- [ ] Structural order validated

---

## 10. EXAMPLES

### Example 1: High Confidence Bio (Named Credentials)
**Input:**
```
PhD in Cellular Biology from Concordia University. 20+ years in technical writing.
Published in Journal of Cell Physiology. Merit award from Society for Technical Communication.
Senior member of STC.
```

**Query Bio Output:**
```
Dr. [Name] holds a PhD in Cellular Biology from Concordia University and has published
research in the Journal of Cell Physiology. With over 20 years in technical writing and
documentation, [Name] received a merit award from the Society for Technical Communication
for excellence in scientific publications. As a senior member of STC, [Name] brings rigorous
research methodology to debut fiction exploring genetic engineering ethics.
```

**Confidence:** HIGH (95%) - Multiple named credentials, institutional anchors, specific awards.

---

### Example 2: Medium Confidence Bio (Professional Experience)
**Input:**
```
10 years as emergency room nurse. No publications. Passionate about medical thrillers.
```

**Query Bio Output:**
```
[Name] brings 10 years of emergency medicine experience to fiction, having worked as an ER
nurse in high-trauma urban hospitals. This debut medical thriller draws on direct clinical
experience with life-or-death decision-making under pressure. [Name] writes with the urgency
and authenticity that only frontline healthcare providers can deliver.
```

**Confidence:** MEDIUM (65%) - Professional experience documented, but no publications or named institutions.

---

### Example 3: Low Confidence Bio (No Verifiable Credentials)
**Input:**
```
I've always loved writing. I'm passionate about fantasy novels. I've been writing for years.
```

**Query Bio Output:**
```
[Name] is a debut fantasy novelist currently seeking representation. With a lifelong interest
in speculative fiction, [Name] has developed a unique voice in the genre through dedicated
study of worldbuilding and character development. This manuscript represents years of craft
refinement and narrative experimentation.
```

**Confidence:** LOW (35%) - No verifiable credentials, generic passion statements.

**Warning Issued:** "⚠️ Consider adding professional credentials, education, or relevant expertise."

---

## 11. REVISION PROTOCOL

### When to Reject Input and Request More Info
- Input <30 words
- Input is generic template ("I am a writer who loves...")
- Input contains only aspirations, no credentials
- No connection between credentials and manuscript possible

### Rejection Message Template
```
"Insufficient biographical information for agent-ready bio generation. Please provide:
- Education (degrees, institutions)
- Professional experience (years, field, roles)
- Publications (journals, publishers, titles)
- Awards or recognitions (names, dates)
- Subject matter expertise relevant to your manuscript

Generic statements like 'I love writing' are not sufficient for query letters."
```

---

## 12. CANON VERSIONING

**v1.0 (2026-01-07):** Initial governance standard  
**Next Review:** 2026-04-07 (quarterly evaluation)

**Compliance Status:** ACTIVE  
**Enforcement:** MANDATORY for all biography generation endpoints  
**Audit Frequency:** Per-generation logging + monthly aggregate review

---

**END OF BIO GOVERNANCE CANON v1.0**