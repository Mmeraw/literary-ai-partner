# RevisionGrade: Defensive Error Handling Standards

**Status:** Mandatory Engineering Standard  
**Applies to:** All feature flows (Evaluate, Revise, Convert, Output, StoryGate Studio, StoryGate)  
**Last Updated:** 2026-01-01

---

## Core Principle

**No Silent Failures.** Every user action that triggers backend processing must provide clear, immediate feedback on success, failure, or loading state. Users should never be left wondering if their action worked.

---

## Mandatory Requirements

### 1. Response Validation (Every API Call)

All API/function calls (`base44.functions.invoke()`, `base44.entities.*`, `base44.integrations.*`) **MUST**:

```javascript
// ✅ CORRECT
const response = await base44.functions.invoke('generateSynopsis', payload);

console.log('Full response:', response);

// Validate response structure
if (!response || typeof response !== 'object') {
    throw new Error('Invalid response format received');
}

// Validate required fields exist
if (!response.synopsis) {
    console.error('Missing synopsis in response:', response);
    throw new Error('Synopsis not found in response');
}

setSynopsis(response.synopsis);
```

```javascript
// ❌ WRONG - No validation, silent failure if structure changes
const response = await base44.functions.invoke('generateSynopsis', payload);
setSynopsis(response.data.synopsis); // Fails silently if .data doesn't exist
```

### 2. Unified Error Handling

Every `try/catch` block **MUST**:

- **Log the full error** with context to console
- **Show a user-friendly message** via toast
- **Include actionable guidance** (e.g., "Please try again")

```javascript
// ✅ CORRECT
try {
    const response = await base44.functions.invoke('generateQuery', payload);
    // ... validation ...
    setQueryLetter(response.query_letter);
    toast.success('Query letter generated!');
} catch (error) {
    console.error('Query letter generation error:', error);
    const errorMsg = error.message || 'Unknown error occurred';
    toast.error('Failed to generate query letter: ' + errorMsg, {
        description: 'Please try again or contact support if the issue persists.',
        duration: 5000
    });
}
```

```javascript
// ❌ WRONG - Generic message, no logging
try {
    // ... code ...
} catch (error) {
    toast.error('Failed to generate'); // Too vague, no context
}
```

### 3. Loading + Failure States (All Buttons)

Every button that triggers async operations **MUST**:

- Show **loading state** immediately on click
- Show **success state** with visible output OR
- Show **error state** with clear message and retry option
- **Never** leave the button spinning indefinitely

```jsx
// ✅ CORRECT
const [generating, setGenerating] = useState(false);

const handleGenerate = async () => {
    setGenerating(true);
    try {
        const response = await base44.functions.invoke('generatePitch', payload);
        
        if (!response || !response.pitch) {
            throw new Error('Pitch not found in response');
        }
        
        setPitch(response.pitch);
        toast.success('Pitch generated!');
    } catch (error) {
        console.error('Pitch generation error:', error);
        toast.error('Failed to generate pitch: ' + (error.message || 'Unknown error'));
    } finally {
        setGenerating(false); // ALWAYS stop loading
    }
};

<Button onClick={handleGenerate} disabled={generating}>
    {generating ? (
        <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
        </>
    ) : (
        <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Pitch
        </>
    )}
</Button>
```

```jsx
// ❌ WRONG - No finally block, button stuck spinning on error
const handleGenerate = async () => {
    setGenerating(true);
    try {
        const response = await base44.functions.invoke('generatePitch', payload);
        setPitch(response.pitch);
        setGenerating(false); // Never reached if error thrown!
    } catch (error) {
        toast.error('Failed');
    }
};
```

### 4. Console Logging for Debugging

Every API response **MUST** be logged before processing:

```javascript
const response = await base44.functions.invoke('functionName', payload);
console.log('Full response object:', response);
console.log('Specific field:', response.expected_field);

// Then validate and process...
```

This allows rapid diagnosis when Base44 changes response structure.

### 5. Field Existence Checks

Never assume nested fields exist. Check at each level:

```javascript
// ✅ CORRECT
if (response?.data?.nested?.field) {
    setField(response.data.nested.field);
} else {
    console.warn('Field not found in response:', response);
}
```

```javascript
// ❌ WRONG - Will crash if any level is undefined
setField(response.data.nested.field);
```

---

## Implementation Checklist

For every user-facing feature:

- [ ] All API calls wrapped in `try/catch` with error logging
- [ ] Response validation checks type and required fields
- [ ] Loading state shown immediately on button click
- [ ] Loading state **always** stopped in `finally` block
- [ ] Success feedback shown to user (toast or visible output)
- [ ] Error feedback shown with actionable message
- [ ] Console logs capture full response for debugging
- [ ] No silent failures - user always sees result

---

## Common Patterns

### Pattern A: Simple Generation

```javascript
const [generating, setGenerating] = useState(false);
const [result, setResult] = useState(null);

const handleGenerate = async () => {
    setGenerating(true);
    try {
        const response = await base44.functions.invoke('generateContent', payload);
        
        console.log('Response:', response);
        
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response format');
        }
        
        if (!response.content) {
            console.error('Missing content in response:', response);
            throw new Error('Content not found in response');
        }
        
        setResult(response.content);
        toast.success('Content generated!');
    } catch (error) {
        console.error('Generation error:', error);
        toast.error('Failed to generate: ' + (error.message || 'Unknown error'));
    } finally {
        setGenerating(false);
    }
};
```

### Pattern B: Multi-Step Workflow

```javascript
const [step, setStep] = useState('upload');
const [uploading, setUploading] = useState(false);
const [processing, setProcessing] = useState(false);

const handleUpload = async (file) => {
    setUploading(true);
    try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        if (!file_url) {
            throw new Error('File upload did not return URL');
        }
        
        setStep('process');
        setFileUrl(file_url);
        toast.success('File uploaded!');
    } catch (error) {
        console.error('Upload error:', error);
        toast.error('Failed to upload file: ' + (error.message || 'Unknown error'));
    } finally {
        setUploading(false);
    }
};

const handleProcess = async () => {
    setProcessing(true);
    try {
        const response = await base44.functions.invoke('processFile', { file_url: fileUrl });
        
        if (!response || !response.result) {
            throw new Error('Processing did not return result');
        }
        
        setResult(response.result);
        setStep('complete');
        toast.success('Processing complete!');
    } catch (error) {
        console.error('Processing error:', error);
        toast.error('Failed to process: ' + (error.message || 'Unknown error'));
    } finally {
        setProcessing(false);
    }
};
```

---

## Testing Verification

Before deploying any feature, verify:

1. **Happy Path:** Feature works as expected
2. **Network Error:** Disconnect internet → user sees error message
3. **Malformed Response:** Backend returns unexpected structure → user sees error
4. **Missing Fields:** Backend omits expected field → user sees specific error
5. **Loading Interruption:** Click button multiple times → no duplicate requests
6. **Error Recovery:** After error, user can retry successfully

---

## Enforcement

This is a **non-negotiable standard**. All code reviews must verify:

- No `try/catch` blocks without error logging and user feedback
- No API calls without response validation
- No buttons without proper loading/error states
- No silent failures of any kind

Any PR that violates these standards should be rejected with reference to this document.

---

## Utility Helper (Recommended)

Use the standardized `ErrorHandler.jsx` utility:

```javascript
import { safeApiCall, withLoadingState } from '@/components/ErrorHandler';

// Automatic validation and error handling
const handleGenerate = () => withLoadingState(
    setGenerating,
    async () => {
        const result = await safeApiCall(
            () => base44.functions.invoke('generateContent', payload),
            'Generate Content',
            ['content'], // required fields
            { page: 'ContentGenerator', trackError: true }
        );
        setContent(result.content);
    },
    'Generate Content'
);
```

---

**Questions or exceptions?** Discuss with engineering lead before implementing workarounds.