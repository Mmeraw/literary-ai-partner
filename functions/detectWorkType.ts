import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

// Load master data
let cachedMasterData = null;
async function loadMasterData() {
    if (cachedMasterData) return cachedMasterData;
    
    const masterDataUrl = 'https://raw.githubusercontent.com/yourusername/yourrepo/main/functions/masterdata/work_type_criteria_applicability.v1.json';
    
    // Try loading from GitHub first, fallback to inline
    try {
        const response = await fetch(masterDataUrl);
        if (response.ok) {
            cachedMasterData = await response.json();
            return cachedMasterData;
        }
    } catch (error) {
        console.warn('Could not load master data from URL, using inline fallback');
    }
    
    // Inline fallback with minimal structure
    cachedMasterData = {
        matrixVersion: 'v1.0.0',
        workTypes: {
            personalEssayReflection: { label: 'Personal Essay / Reflection', family: 'Prose Nonfiction' },
            featureScreenplay: { label: 'Feature Screenplay', family: 'Script/Screenplay' },
            novelChapter: { label: 'Novel Chapter', family: 'Prose Fiction' },
            shortStory: { label: 'Short Story', family: 'Prose Fiction' },
            memoirVignette: { label: 'Memoir Vignette', family: 'Prose Nonfiction' },
            scriptSceneFilmTv: { label: 'Script Scene (Film/TV)', family: 'Script/Screenplay' },
            otherUserDefined: { label: 'Other (User-Defined)', family: 'Other' }
        }
    };
    
    return cachedMasterData;
}

// Structural detection heuristics (non-ML, pattern-based)
function detectWorkTypeFromText(text) {
    const lowerText = text.toLowerCase();
    const lines = text.split('\n');
    
    // Count structural markers
    const hasSluglines = /^(int\.|ext\.)/im.test(text);
    const hasCharacterCues = lines.some(line => /^[A-Z\s]{3,}$/.test(line.trim()) && line.trim().length < 40);
    const hasFadeIn = /fade in:/i.test(text);
    const hasActScene = /^(act|scene)\s+[ivx0-9]/im.test(text);
    
    const firstPersonDensity = (text.match(/\b(i|me|my|myself)\b/gi) || []).length / text.split(/\s+/).length;
    const hasThesisMarkers = /\b(therefore|thus|in conclusion|as i|however|moreover)\b/i.test(text);
    const hasReflectiveMarkers = /\b(as i look back|i realized|i learned|looking back)\b/i.test(text);
    
    const hasChapterMarker = /^chapter\s+[0-9ivx]/im.test(text);
    const hasPilotMarker = /\bpilot\b/i.test(text);
    const hasEpisodeMarker = /\b(episode|s\d+e\d+)\b/i.test(text);
    
    const wordCount = text.split(/\s+/).length;
    
    // Detection logic (structural cues only)
    
    // Script/Screenplay detection
    if (hasSluglines && hasCharacterCues) {
        if (hasFadeIn || wordCount > 5000) {
            if (hasPilotMarker) return { workTypeId: 'televisionPilot', confidence: 'high' };
            if (hasEpisodeMarker) return { workTypeId: 'televisionEpisode', confidence: 'high' };
            return { workTypeId: 'featureScreenplay', confidence: 'high' };
        }
        return { workTypeId: 'scriptSceneFilmTv', confidence: 'high' };
    }
    
    // Stage play
    if (hasActScene && hasCharacterCues) {
        return { workTypeId: 'stagePlayScript', confidence: 'medium' };
    }
    
    // Submission materials
    if (/\b(dear\s+agent|query|word\s+count:|genre:)/i.test(text)) {
        return { workTypeId: 'queryPackage', confidence: 'high' };
    }
    
    if (/^(logline|premise|hook):/im.test(text) && wordCount < 200) {
        return { workTypeId: 'pitchOrLogline', confidence: 'medium' };
    }
    
    if (/\b(synopsis|plot\s+summary)\b/i.test(text) && wordCount < 1500) {
        return { workTypeId: 'synopsis', confidence: 'medium' };
    }
    
    if (/\b(treatment|series\s+bible|season\s+\d+)\b/i.test(text)) {
        return { workTypeId: 'treatmentOrSeriesBible', confidence: 'medium' };
    }
    
    if (/\b(outline|chapter\s+breakdown|beat\s+sheet)\b/i.test(text)) {
        return { workTypeId: 'outlineOrProposal', confidence: 'medium' };
    }
    
    // Prose nonfiction
    if (firstPersonDensity > 0.03 && (hasReflectiveMarkers || hasThesisMarkers)) {
        if (wordCount < 1500) {
            return { workTypeId: 'personalEssayReflection', confidence: 'medium' };
        }
        if (/\b(memoir|remember|childhood|mother|father)\b/i.test(text)) {
            if (hasChapterMarker) {
                return { workTypeId: 'memoirChapterNarrative', confidence: 'medium' };
            }
            return { workTypeId: 'memoirVignette', confidence: 'medium' };
        }
        return { workTypeId: 'creativeNonfiction', confidence: 'low' };
    }
    
    // Academic/professional
    if (/\b(abstract|methodology|literature\s+review|hypothesis)\b/i.test(text)) {
        return { workTypeId: 'academicAnalyticalProse', confidence: 'medium' };
    }
    
    if (/\b(industry|professional|technical|enterprise)\b/i.test(text) && wordCount < 2000) {
        return { workTypeId: 'professionalNonfictionSample', confidence: 'low' };
    }
    
    // Opinion/editorial
    if (/\b(should|must|ought|policy|argue)\b/i.test(text) && hasThesisMarkers) {
        return { workTypeId: 'opinionEditorial', confidence: 'low' };
    }
    
    // Prose fiction
    if (wordCount < 1500 && !hasChapterMarker) {
        // Could be flash fiction, short story, or prose scene
        if (wordCount < 500) {
            return { workTypeId: 'flashFictionMicro', confidence: 'low' };
        }
        if (/\b(suddenly|the door|she turned|he said)\b/i.test(text)) {
            return { workTypeId: 'proseScene', confidence: 'low' };
        }
        return { workTypeId: 'shortStory', confidence: 'low' };
    }
    
    if (hasChapterMarker) {
        return { workTypeId: 'novelChapter', confidence: 'medium' };
    }
    
    // Literary vs genre fiction (weak signal)
    if (/\b(magic|dragon|spaceship|detective|murder|vampire)\b/i.test(lowerText)) {
        return { workTypeId: 'genreFictionGeneral', confidence: 'low' };
    }
    
    if (wordCount > 1000) {
        return { workTypeId: 'literaryFictionGeneral', confidence: 'low' };
    }
    
    // Fallback: uncertain
    return { workTypeId: 'otherUserDefined', confidence: 'low' };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const { text, title } = await req.json();
        
        if (!text) {
            return Response.json({ error: 'Text required for detection' }, { status: 400 });
        }
        
        // Load master data
        const data = await loadMasterData();
        
        // Detect Work Type
        const detection = detectWorkTypeFromText(text);
        const workType = data.workTypes[detection.workTypeId] || { 
            label: 'Unknown Work Type', 
            family: 'Other' 
        };
        
        return Response.json({
            detected_work_type: detection.workTypeId,
            detection_confidence: detection.confidence,
            work_type_label: workType.label,
            family: workType.family,
            matrix_version: data.matrixVersion,
            requires_confirmation: true,
            all_work_types: Object.entries(data.workTypes).map(([id, wt]) => ({
                id,
                label: wt.label,
                family: wt.family
            }))
        });
        
    } catch (error) {
        console.error('Detection error:', error);
        
        Sentry.captureException(error, {
            tags: {
                function: 'detectWorkType',
                feature: 'work_type_detection'
            }
        });
        await Sentry.flush(2000);
        
        return Response.json({ error: error.message }, { status: 500 });
    }
});