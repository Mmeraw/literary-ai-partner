# RevisionGrade Incident Log

## Purpose
Track systematic issues, pattern-level bugs, and governance incidents to prevent recurrence and improve code quality.

---

## 2026-01-01: File Upload Handler Wiring Failure (RESOLVED)

**Incident Type:** Pattern-level regression  
**Severity:** High (silent failure, no user feedback)  
**Status:** ✅ Resolved  

### Root Cause
File upload buttons using `<Button asChild>` with `<label>` wrapper broke click event propagation:
- The `asChild` prop caused the Button to forward its props to the child span
- Click events on the label didn't reach the hidden file input
- Result: Silent failure - spinner shows but `onChange` never fires

### Affected Pages
1. **PitchGenerator** - Manuscript upload for pitch generation
2. **CompletePackage** - CV/Resume upload for bio extraction  
3. **FilmAdaptation** - DOCX/TXT manuscript uploads

### Pattern Identified
```jsx
// ❌ BROKEN PATTERN
<input type="file" id="upload" onChange={handler} className="hidden" />
<label htmlFor="upload">
  <Button asChild>
    <span>Upload</span>
  </Button>
</label>

// ✅ CORRECT PATTERN  
<input type="file" id="upload" onChange={handler} className="hidden" />
<label htmlFor="upload" className="cursor-pointer inline-block">
  <Button>Upload</Button>
</label>
```

### Fix Applied
- Removed `asChild` prop from all affected Button components
- Moved file inputs before labels for clarity
- Added `cursor-pointer` to labels for better UX
- Verified all three pages now trigger uploads correctly

### Prevention Checklist
- [ ] Audit all file upload patterns quarterly
- [ ] Add linting rule to flag `<Button asChild>` inside `<label>`
- [ ] Document file upload best practices in component library
- [ ] Add integration test for file upload flows

### Governance Action Items
1. **Pattern Audit Standard:** When fixing a bug, always search for similar patterns across the codebase
2. **QA Regression Sweep:** Before marking issues resolved, verify all similar UI patterns
3. **Documentation:** Update component usage guidelines with anti-patterns
4. **Testing:** Add E2E tests for critical upload flows

---

## Template for New Incidents

```markdown
## YYYY-MM-DD: [Incident Title] ([STATUS])

**Incident Type:** [Pattern/Data/Security/Performance]  
**Severity:** [Critical/High/Medium/Low]  
**Status:** [Open/Investigating/Resolved/Monitoring]  

### Root Cause
[Technical explanation]

### Affected Components
[List of files/pages/features]

### Pattern Identified
[Code examples showing broken vs. correct patterns]

### Fix Applied
[What was changed]

### Prevention Checklist
[Actions to prevent recurrence]

### Governance Action Items
[Process improvements]
```

---

## Governance Principles

1. **Mistake-Proof Similar Processes:** When an error pattern is found, audit all similar implementations
2. **Document Anti-Patterns:** Add discovered anti-patterns to this log with examples
3. **Regression Prevention:** Use this log as a checklist before releases
4. **Continuous Improvement:** Review quarterly and update prevention strategies