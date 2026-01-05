# Function Spec: Manuscript Management (splitManuscript, cloneManuscript, markManuscriptFinal)
**5-Field Contract** | **Phase:** 0 Complete | **Version:** 1.0.0

---

## 1. INPUTS

### splitManuscript
- `manuscriptId`: string (required)
- `chapterDetectionMode`: enum (auto | manual) - default: auto
- `manualChapterMarkers`: array of strings (if mode=manual, e.g., ["Chapter", "Part"])

### cloneManuscript
- `manuscriptId`: string (required)
- `clonePurpose`: enum (backup | revision | version_lock)

### markManuscriptFinal
- `manuscriptId`: string (required)
- `finalizationNote`: string (optional, user note for finalization)

**Size Limits:**
- Manuscript must exist and be >= 2,000 words
- Chapter count after splitting: 1-100 chapters

**Visible Ingestion:**
- ManuscriptDashboard shows manuscript actions (split, clone, finalize)
- Splitting progress shown ("Detecting chapters...")
- Clone confirmation modal
- Finalization confirmation modal with warning (irreversible)

---

## 2. ROUTING

### splitManuscript
```
IF manuscript.status = "splitting" THEN BLOCK (already splitting)
IF manuscript.wordCount < 2000 THEN BLOCK (too short to split)
ELSE:
  1. Detect chapters (auto or manual markers)
  2. Split text into Chapter entities
  3. Update manuscript status to "summarizing"
```

### cloneManuscript
```
IF manuscript.is_final = true THEN allow clone
ELSE warn user (cloning non-final manuscript)
Create new Manuscript entity with:
  - parent_manuscript_id = original.id
  - full_text = original.full_text
  - all metadata copied
```

### markManuscriptFinal
```
IF manuscript.is_final = true THEN BLOCK (already final)
IF manuscript.status != "ready" THEN BLOCK (must be evaluated first)
ELSE:
  1. Set is_final = true
  2. Set finalized_at = now()
  3. Set finalized_by = user.email
  4. Record finalization_note
  5. Make manuscript read-only
```

---

## 3. VALIDATION

### splitManuscript Hard Fails:
- Manuscript not found
- Manuscript < 2,000 words
- Already splitting
- User not authenticated

### cloneManuscript Hard Fails:
- Manuscript not found
- User not authenticated

### markManuscriptFinal Hard Fails:
- Manuscript not found
- Already finalized
- Not evaluated (status != ready)
- User not authenticated

**Validation Sequence (all functions):**
1. Auth check (401 if fails)
2. Manuscript retrieval (404 if not found)
3. Function-specific state validation
4. Execute operation

**Visibility:**
- All validation failures return standardized error response
- Irreversible actions require confirmation modal
- State conflicts shown explicitly

---

## 4. OUTPUTS

### splitManuscript Output:
```json
{
  "success": true,
  "manuscriptId": "string",
  "chaptersCreated": "number",
  "chapters": [
    {
      "id": "string",
      "title": "string",
      "wordCount": "number",
      "orderIndex": "number"
    }
  ]
}
```

### cloneManuscript Output:
```json
{
  "success": true,
  "originalManuscriptId": "string",
  "clonedManuscriptId": "string",
  "clonedAt": "ISO 8601"
}
```

### markManuscriptFinal Output:
```json
{
  "success": true,
  "manuscriptId": "string",
  "finalized": true,
  "finalizedAt": "ISO 8601",
  "finalizedBy": "string"
}
```

**Storage:**
- splitManuscript: creates Chapter entities linked to manuscript
- cloneManuscript: creates new Manuscript entity
- markManuscriptFinal: updates Manuscript entity (read-only flag set)

---

## 5. AUDIT

### splitManuscript Audit:
```json
{
  "event_id": "evt_{timestamp}_{random}",
  "request_id": "{manuscript_id}_split",
  "timestamp_utc": "ISO 8601",
  "function_id": "splitManuscript",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "user_email": "user@example.com",
  "manuscript_id": "{id}",
  "chapter_detection_mode": "auto | manual",
  "chapters_created": "{number}",
  "success": true | false
}
```

### cloneManuscript Audit:
```json
{
  "event_id": "evt_{timestamp}_{random}",
  "request_id": "{manuscript_id}_clone",
  "timestamp_utc": "ISO 8601",
  "function_id": "cloneManuscript",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "user_email": "user@example.com",
  "original_manuscript_id": "{id}",
  "cloned_manuscript_id": "{id}",
  "clone_purpose": "backup | revision | version_lock",
  "success": true | false
}
```

### markManuscriptFinal Audit:
```json
{
  "event_id": "evt_{timestamp}_{random}",
  "request_id": "{manuscript_id}_finalize",
  "timestamp_utc": "ISO 8601",
  "function_id": "markManuscriptFinal",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "user_email": "user@example.com",
  "manuscript_id": "{id}",
  "finalized": true,
  "finalization_note": "{note or null}",
  "success": true | false
}
```

**Sentry Integration:**
- Errors captured per function with context

---

## Canon Reference

- Governed by: `EVALUATE_ENTRY_CANON.md` v1.2
- State machine: `WORKFLOW_STATE_MAPPING.md`

---

## Test Coverage

- Manual QA: Split, clone, finalize various manuscripts
- State transition validation automated

**Acceptance Criteria:**
✅ Split creates Chapter entities  
✅ Clone preserves all metadata  
✅ Finalize is irreversible  
✅ State validation works  
✅ Audit events logged