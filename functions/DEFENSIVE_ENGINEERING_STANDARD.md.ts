# Defensive Engineering Standard (Applies to All RevisionGrade & StoryGate Routes)

**Status:** Mandatory — Part of Operating Model  
**Effective:** 2026-01-01  
**Enforcement:** Non-negotiable requirement for all releases

---

## Purpose

This standard extends the existing Operating Model's **Observability / No Silent Failures** principle with concrete, testable engineering requirements.

**Operating Model Commitment:**  
*"Failures must be detectable via logs or dashboards. No silent or 'invisible' failures."*

**This Standard Implements:**  
Specific code patterns and UI behaviors that make that commitment real.

---

## Core Requirements

### 1. Response Validation (Every API Call)

Every API/function invocation **MUST**:

✅ **Validate that a response was received**
```javascript
if (!response || typeof response !== 'object') {
    throw new Error('Invalid response format received');
}
```

✅ **Validate that required fields exist before rendering**
```javascript
if (!response.letter || !response.score) {
    console.error('Missing required fields:', response);
    throw new Error('Required data not found in response');
}
```

❌ **NEVER assume fields exist without checking**
```javascript
// BAD - will crash silently if response.data doesn't exist
setContent(response.data.content);
```

### 2. Error Handling (Every Try/Catch)

On validation failure or exception, **MUST**:

✅ **Log a structured error** with:
- Route name
- Function name  
- Payload summary
- Error message
- Full response (if available)

```javascript
console.error('[QueryLetter] Generation failed:', {
    function: 'generateQueryLetterPackage',
    payload: { file_url, synopsis_mode },
    error: error.message,
    response: response
});
```

✅ **Show a clear, consistent UI message**
```javascript
toast.error('Failed to generate query letter: ' + errorMsg, {
    description: 'The team has been notified. Please try again or contact support if the issue persists.',
    duration: 5000
});
```

Template message format:
> "We couldn't [action]. The team has been notified; please try again."

### 3. Loading States (Every User Action)

No primary user action (Generate, Evaluate, Upload, Promote to StoryGate) **MAY** fail silently.

Every button that triggers backend processing **MUST**:

✅ **Show loading state immediately**
```jsx
<Button disabled={generating}>
    {generating ? (
        <>
            <Loader2 className="animate-spin" />
            Generating...
        </>
    ) : (
        'Generate'
    )}
</Button>
```

✅ **Always stop loading in finally block**
```javascript
try {
    const response = await base44.functions.invoke(...);
    // process response
} catch (error) {
    // handle error
} finally {
    setGenerating(false); // REQUIRED
}
```

✅ **Exit into explicit success OR failure state**
- Success: Show visible output + success toast
- Failure: Show error message + retry option
- Never: Leave button spinning indefinitely

---

## Release Acceptance Criteria

A fix or feature is **NOT accepted** unless **BOTH** conditions are met:

### ✅ Condition 1: Console/Network Logs Show Handled Error Paths

Every error scenario produces a structured log entry with:
- Route name
- Function name
- Error message
- Timestamp
- Full context (response, payload summary)

### ✅ Condition 2: UI Displays Either a Result or an Explicit Error State

Every outcome is clear to the user:
- **Success:** Visible output + confirmation message
- **Failure:** Error message + actionable guidance (retry, contact support)
- **Never:** Spinning button with no feedback

---

## Verification Checklist (Required Before Release)

Test **every** primary user action:

- [ ] **Happy Path:** Feature works as expected
- [ ] **Network Failure:** Disconnect internet → user sees error message
- [ ] **Malformed Response:** Backend returns unexpected structure → user sees error
- [ ] **Missing Fields:** Backend omits expected field → user sees specific error
- [ ] **Loading Interruption:** Click button multiple times → no duplicate requests
- [ ] **Error Recovery:** After error, user can retry successfully
- [ ] **Console Logs:** All errors logged with full context
- [ ] **No Silent Failures:** Every scenario has visible feedback

**No release proceeds until all items are checked.**

---

## Routes Requiring Implementation

This standard applies to **ALL** routes, including:

### Evaluate
- Scene/chapter evaluation
- Full manuscript upload
- Screenplay evaluation
- WAVE analysis

### Revise
- Revision suggestions
- Suggestion acceptance
- Alternatives generation

### Convert
- Screenplay formatter
- Novel → Screenplay conversion

### Output
- Synopsis generation (Query/Standard/Extended)
- Biography generation
- Pitch generation
- Query Letter generation
- Complete Package generation
- Comparables generation
- Film Adaptation Package

### StoryGate
- Studio submission forms
- Industry verification
- Creator listing creation
- Access request flows
- Admin operations

---

## Implementation Pattern (Reference)

```javascript
const [generating, setGenerating] = useState(false);

const handleGenerate = async () => {
    setGenerating(true);
    
    try {
        const response = await base44.functions.invoke('generateContent', payload);
        
        console.log('[PageName] Response received:', response);
        
        // VALIDATE: Response exists and is object
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response format received');
        }
        
        // VALIDATE: Required fields exist
        if (!response.content) {
            console.error('[PageName] Missing content in response:', response);
            throw new Error('Content not found in response');
        }
        
        // SUCCESS PATH
        setContent(response.content);
        toast.success('Content generated successfully!');
        
    } catch (error) {
        // ERROR LOGGING
        console.error('[PageName] Generation failed:', {
            function: 'generateContent',
            payload: payload,
            error: error.message,
            stack: error.stack
        });
        
        // USER FEEDBACK
        const errorMsg = error.message || 'Unknown error occurred';
        toast.error(`Failed to generate content: ${errorMsg}`, {
            description: 'The team has been notified. Please try again or contact support.',
            duration: 5000
        });
        
    } finally {
        // ALWAYS STOP LOADING
        setGenerating(false);
    }
};
```

---

## Base44 Implementation Requirement

**To Base44 Engineering:**

Implement this Defensive Engineering Standard across **all RevisionGrade and StoryGate routes**.

**Deliverable:**  
Confirm the **first release version** where this is fully applied, so we can verify compliance.

**Verification:**  
We will test error paths on all major routes after implementation:
- All Evaluate flows
- All Revise flows
- All Convert flows
- All Output flows (7 generators)
- All StoryGate flows (4 flows)

This is **non-negotiable** per Operating Model. No exceptions without written approval.

---

## Questions or Escalations

Contact engineering lead before implementing workarounds or deviating from this standard.

**Rationale for denial:** This standard prevents production incidents where users lose work, receive no feedback, or encounter silent failures. Every shortcut here creates user-facing bugs.