{
  "exported_at": "2026-01-10",
  "total_entities": 35,
  "note": "All entity schemas exported for review - these are your data models",
  "schemas": {
    "Submission": {
      "name": "Submission",
      "type": "object",
      "properties": {
        "title": {"type": "string", "description": "Title of the manuscript"},
        "text": {"type": "string", "description": "The original draft text submitted"},
        "result_json": {"type": "object", "description": "Full evaluation result from AI"},
        "overall_score": {"type": "number", "description": "Overall quality score 0-10"},
        "status": {"type": "string", "enum": ["draft", "evaluating", "reviewed", "finalized"], "default": "draft"},
        "revised_text": {"type": "string", "description": "Finalized revised version"},
        "deleted_at": {"type": "string", "format": "date-time", "description": "Soft delete timestamp for 30-day recovery"}
      },
      "required": ["title", "text"]
    },
    "Suggestion": {
      "name": "Suggestion",
      "type": "object",
      "properties": {
        "submission_id": {"type": "string", "description": "Reference to the parent submission"},
        "original_segment": {"type": "string", "description": "The original text segment being evaluated"},
        "action": {"type": "string", "enum": ["keep", "replace", "delete"], "description": "Recommended action"},
        "replacement_text": {"type": "string", "description": "Suggested replacement if action is replace"},
        "reasoning": {"type": "string", "description": "Explanation for the suggestion"},
        "criteria_referenced": {"type": "array", "items": {"type": "string"}, "description": "Which criteria triggered this suggestion"},
        "ai_source": {"type": "string", "enum": ["analyst_1", "analyst_2"], "description": "Which AI analyst made this suggestion"},
        "status": {"type": "string", "enum": ["pending", "accepted", "rejected", "alternatives_requested"], "default": "pending"},
        "alternatives": {"type": "array", "items": {"type": "string"}, "description": "Alternative suggestions if requested"},
        "segment_index": {"type": "number", "description": "Order of this segment in the text"}
      },
      "required": ["submission_id", "original_segment", "action"]
    },
    "EvaluationCriteria": {
      "name": "EvaluationCriteria",
      "type": "object",
      "properties": {
        "name": {"type": "string", "description": "Name of the criterion"},
        "description": {"type": "string", "description": "Detailed description of what this criterion evaluates"},
        "category": {"type": "string", "enum": ["literary_agent", "wave_revision"], "description": "Whether this is a literary agent criterion or Wave Revision item"},
        "weight": {"type": "number", "description": "Importance weight for scoring"},
        "order": {"type": "number", "description": "Display order"}
      },
      "required": ["name", "category"]
    },
    "RevisionSession": {
      "name": "RevisionSession",
      "type": "object",
      "properties": {
        "submission_id": {"type": "string", "description": "Reference to the original submission"},
        "title": {"type": "string", "description": "Manuscript title"},
        "original_text": {"type": "string", "description": "Original manuscript text"},
        "current_text": {"type": "string", "description": "Text with accepted changes applied (authoritative current version)"},
        "current_wave": {"type": "number", "description": "Current wave number in sequence", "default": 1},
        "current_position": {"type": "number", "description": "Current suggestion index", "default": 0},
        "style_mode": {"type": "string", "enum": ["neutral", "lyrical", "rhythmical", "literary", "commercial"], "default": "neutral", "description": "Revision style preference selected by user"},
        "voice_preservation_level": {"type": "string", "enum": ["maximum", "balanced", "polish"], "default": "balanced", "description": "Voice preservation level"},
        "evaluation_result": {"type": "object", "description": "Evaluation results if available"},
        "suggestions": {"type": "array", "items": {"type": "object"}, "description": "Array of revision suggestions"},
        "version_history": {"type": "array", "items": {"type": "object"}, "description": "Immutable version history"},
        "overall_feedback": {"type": "object", "description": "User feedback on revision session"},
        "status": {"type": "string", "enum": ["in_progress", "completed", "paused"], "default": "in_progress"}
      },
      "required": ["submission_id", "title", "original_text"]
    },
    "Manuscript": {
      "name": "Manuscript",
      "type": "object",
      "properties": {
        "title": {"type": "string", "description": "Manuscript title"},
        "full_text": {"type": "string", "description": "Complete manuscript text"},
        "word_count": {"type": "number", "description": "Total word count"},
        "is_final": {"type": "boolean", "default": false, "description": "Flag indicating this version is locked for output generation (read-only)"},
        "parent_manuscript_id": {"type": "string", "description": "Reference to parent manuscript if this is a clone"},
        "finalized_at": {"type": "string", "format": "date-time"},
        "finalized_by": {"type": "string", "description": "Email of user who finalized this manuscript"},
        "finalization_note": {"type": "string", "description": "Optional note recorded at finalization"},
        "language_variant": {"type": "string", "enum": ["en-US", "en-UK", "en-CA", "en-AU"], "default": "en-US"},
        "evaluation_mode": {"type": "string", "enum": ["standard", "transgressive", "trauma_memoir"], "default": "standard"},
        "market_path": {"type": "string", "enum": ["mainstream_agent_ready", "transgressive_niche", "literary_extreme"], "default": "mainstream_agent_ready"},
        "transgressive_analysis": {"type": "object", "description": "Transgressive mode evaluation results"},
        "spine_score": {"type": "number", "description": "Overall spine evaluation score (0-10)"},
        "spine_evaluation": {"type": "object", "description": "Full spine evaluation results"},
        "spine_completed_at": {"type": "string", "format": "date-time"},
        "next_phase": {"type": "string"},
        "wave_trigger_retry_count": {"type": "number", "default": 0},
        "phase_3_started_at": {"type": "string", "format": "date-time"},
        "phase_3_run_id": {"type": "string"},
        "wave_trigger_error": {"type": "string"},
        "wave_trigger_failed_at": {"type": "string", "format": "date-time"},
        "evaluation_progress": {"type": "object", "description": "Real-time evaluation progress tracking"},
        "revisiongrade_overall": {"type": "number", "description": "Final composite score: spine + WAVE"},
        "revisiongrade_breakdown": {"type": "object"},
        "continuity_report": {"type": "object"},
        "status": {"type": "string", "enum": ["uploaded", "splitting", "summarizing", "spine_evaluating", "spine_complete", "wave_trigger_retrying", "evaluating_chapters", "ready", "ready_with_errors", "paused", "failed", "wave_trigger_failed"], "default": "uploaded"}
      },
      "required": ["title", "full_text", "word_count"]
    },
    "Chapter": {
      "name": "Chapter",
      "type": "object",
      "properties": {
        "manuscript_id": {"type": "string"},
        "order": {"type": "number"},
        "title": {"type": "string"},
        "text": {"type": "string"},
        "word_count": {"type": "number"},
        "summary_json": {"type": "object"},
        "evaluation_score": {"type": "number"},
        "evaluation_result": {"type": "object"},
        "wave_results_json": {"type": "object"},
        "chapter_craft_score": {"type": "number"},
        "status": {"type": "string", "enum": ["pending", "summarizing", "summarized", "evaluating", "evaluated", "failed"], "default": "pending"},
        "wave_status": {"type": "string", "enum": ["not_started", "running", "evaluated", "failed"], "default": "not_started"},
        "wave_started_at": {"type": "string", "format": "date-time"},
        "wave_completed_at": {"type": "string", "format": "date-time"},
        "wave_progress": {"type": "object"},
        "wave_scores": {"type": "object"},
        "wave_error": {"type": "string"},
        "error_message": {"type": "string"},
        "retry_count": {"type": "number"}
      },
      "required": ["manuscript_id", "order", "title", "text", "word_count"]
    },
    "Analytics": {
      "name": "Analytics",
      "type": "object",
      "properties": {
        "page": {"type": "string"},
        "path": {"type": "string"},
        "referrer": {"type": "string"},
        "user_agent": {"type": "string"},
        "device_type": {"type": "string", "enum": ["mobile", "tablet", "desktop"]},
        "session_id": {"type": "string"},
        "visitor_id": {"type": "string"},
        "user_id": {"type": "string"},
        "event_type": {"type": "string"},
        "metadata": {"type": "object"}
      },
      "required": ["page", "path"]
    },
    "EvaluationSignal": {
      "name": "EvaluationSignal",
      "type": "object",
      "properties": {
        "submission_id": {"type": "string"},
        "content_type": {"type": "string", "enum": ["scene", "chapter", "manuscript", "screenplay"]},
        "overall_score": {"type": "number"},
        "signal_family_scores": {"type": "object"},
        "issue_codes": {"type": "array", "items": {"type": "object"}},
        "is_revision": {"type": "boolean", "default": false},
        "original_signal_id": {"type": "string"}
      },
      "required": ["submission_id", "content_type", "overall_score"]
    },
    "ComparativeReport": {
      "name": "ComparativeReport",
      "type": "object",
      "properties": {
        "manuscript_id": {"type": "string"},
        "manuscript_title": {"type": "string"},
        "genre": {"type": "string"},
        "subgenre": {"type": "string"},
        "user_synopsis": {"type": "string"},
        "comparison_data": {"type": "object"},
        "summary_bullets": {"type": "array", "items": {"type": "string"}}
      },
      "required": ["manuscript_id", "manuscript_title", "genre", "comparison_data"]
    },
    "NarrativeThread": {
      "name": "NarrativeThread",
      "type": "object",
      "properties": {
        "manuscript_id": {"type": "string"},
        "label": {"type": "string"},
        "thread_type": {"type": "string", "enum": ["character", "conflict", "object_symbol", "question_promise", "relationship", "motif", "physical_continuity"]},
        "introduced_chapter": {"type": "number"},
        "introduced_scene": {"type": "string"},
        "mentions": {"type": "array", "items": {"type": "object"}},
        "resolution_status": {"type": "string", "enum": ["resolved", "intentionally_open", "unresolved_suspect", "deferred"], "default": "unresolved_suspect"},
        "resolution_chapter": {"type": "number"},
        "resolution_note": {"type": "string"},
        "author_override": {"type": "boolean", "default": false},
        "flag_reason": {"type": "string"}
      },
      "required": ["manuscript_id", "label", "thread_type", "introduced_chapter"]
    },
    "StorygateSubmission": {
      "name": "StorygateSubmission",
      "type": "object",
      "properties": {
        "primaryPath": {"type": "string", "enum": ["MANUSCRIPT", "SCREEN"]},
        "first_name": {"type": "string"},
        "last_name": {"type": "string"},
        "email": {"type": "string", "format": "email"},
        "phone": {"type": "string"},
        "project_title": {"type": "string"},
        "format": {"type": "string", "enum": ["novel", "feature_film", "series", "memoir", "narrative_nonfiction", "other"]},
        "genre": {"type": "string", "enum": ["literary_fiction", "commercial_upmarket", "thriller_suspense", "mystery_crime", "science_fiction", "fantasy", "horror", "historical_fiction", "romance", "young_adult", "middle_grade", "nonfiction", "other_cross_genre"]},
        "genre_other": {"type": "string"},
        "tone": {"type": "string"},
        "description": {"type": "string"},
        "project_stage": {"type": "string", "enum": ["early_draft", "revised_draft", "near_final"]},
        "seeking": {"type": "array", "items": {"type": "string"}},
        "why_storygate": {"type": "string"},
        "evaluationSource": {"type": "string", "enum": ["RevisionGrade", "Equivalent", "None"]},
        "evaluationScore": {"type": "number"},
        "evaluationReportId": {"type": "string"},
        "evaluatorType": {"type": "string"},
        "evaluatorName": {"type": "string"},
        "evaluationDate": {"type": "string", "format": "date"},
        "evaluationSummary": {"type": "string"},
        "queryLetterText": {"type": "string"},
        "synopsisText": {"type": "string"},
        "authorBioText": {"type": "string"},
        "marketNotesText": {"type": "string"},
        "queryHookText": {"type": "string"},
        "loglineText": {"type": "string"},
        "adaptationPitchText": {"type": "string"},
        "filmDeckFileId": {"type": "string"},
        "sourceWorkType": {"type": "string", "enum": ["NOVEL", "SERIES", "OTHER"]},
        "sourceMaterialFileId": {"type": "string"},
        "screeningStatus": {"type": "string", "enum": ["AUTO_DECLINED", "ELIGIBLE", "RECOMMEND_HUMAN_REVIEW", "INVITED"], "default": "ELIGIBLE"},
        "screeningReasons": {"type": "array", "items": {"type": "string"}},
        "status": {"type": "string", "enum": ["pending_review", "tier_1_declined", "tier_2_hold", "tier_3_reviewing", "engaged", "archived"], "default": "pending_review"},
        "tier": {"type": "number", "enum": [1, 2, 3]},
        "internal_notes": {"type": "string"},
        "review_date": {"type": "string", "format": "date-time"},
        "reviewer": {"type": "string"}
      },
      "required": ["primaryPath", "first_name", "last_name", "email", "project_title", "description", "why_storygate", "evaluationSource"]
    },
    "IndustryUser": {
      "name": "IndustryUser",
      "type": "object",
      "properties": {
        "user_email": {"type": "string"},
        "full_name": {"type": "string"},
        "company": {"type": "string"},
        "role_type": {"type": "string", "enum": ["agent", "producer", "executive", "manager", "other"]},
        "verification_status": {"type": "string", "enum": ["pending", "verified", "rejected", "revoked"], "default": "pending"},
        "verification_date": {"type": "string", "format": "date-time"},
        "bio": {"type": "string"},
        "linkedin_url": {"type": "string"},
        "imdb_url": {"type": "string"},
        "verified_by": {"type": "string"},
        "rate_limit_flags": {"type": "number", "default": 0},
        "suspended": {"type": "boolean", "default": false}
      },
      "required": ["user_email", "full_name", "company", "role_type"]
    },
    "ProjectListing": {
      "name": "ProjectListing",
      "type": "object",
      "properties": {
        "manuscript_id": {"type": "string"},
        "creator_email": {"type": "string"},
        "visibility": {"type": "string", "enum": ["private", "discoverable", "restricted"], "default": "private"},
        "title": {"type": "string"},
        "genre": {"type": "string"},
        "format": {"type": "string", "enum": ["novel", "screenplay", "series", "other"]},
        "logline": {"type": "string"},
        "synopsis_public": {"type": "string"},
        "word_count": {"type": "number"},
        "stage": {"type": "string", "enum": ["draft", "revised", "final"]},
        "revisiongrade_score": {"type": "number"},
        "materials_available": {"type": "array", "items": {"type": "string"}},
        "access_requires_approval": {"type": "boolean", "default": true},
        "contact_enabled": {"type": "boolean", "default": false},
        "active": {"type": "boolean", "default": true}
      },
      "required": ["manuscript_id", "creator_email", "title", "format"]
    },
    "AccessLog": {
      "name": "AccessLog",
      "type": "object",
      "properties": {
        "user_email": {"type": "string"},
        "user_role": {"type": "string", "enum": ["creator", "industry", "admin"]},
        "action_type": {"type": "string", "enum": ["browse", "view_listing", "request_access", "unlock", "contact_initiate", "permission_change", "revoke_access"]},
        "project_listing_id": {"type": "string"},
        "manuscript_id": {"type": "string"},
        "success": {"type": "boolean"},
        "failure_reason": {"type": "string"},
        "ip_address": {"type": "string"},
        "metadata": {"type": "object"}
      },
      "required": ["user_email", "user_role", "action_type"]
    },
    "AccessUnlock": {
      "name": "AccessUnlock",
      "type": "object",
      "properties": {
        "project_listing_id": {"type": "string"},
        "manuscript_id": {"type": "string"},
        "industry_user_email": {"type": "string"},
        "creator_email": {"type": "string"},
        "status": {"type": "string", "enum": ["pending", "approved", "denied", "revoked"], "default": "pending"},
        "requested_at": {"type": "string", "format": "date-time"},
        "approved_at": {"type": "string", "format": "date-time"},
        "revoked_at": {"type": "string", "format": "date-time"},
        "request_message": {"type": "string"},
        "materials_accessed": {"type": "array", "items": {"type": "string"}},
        "contact_unlocked": {"type": "boolean", "default": false}
      },
      "required": ["project_listing_id", "manuscript_id", "industry_user_email", "creator_email"]
    },
    "RouteHealthLog": {
      "name": "RouteHealthLog",
      "type": "object",
      "properties": {
        "route": {"type": "string"},
        "status": {"type": "string", "enum": ["healthy", "error"]},
        "error_type": {"type": "string", "enum": ["blank_page", "wrong_title", "timeout", "http_error", "missing_marker"]},
        "expected_title": {"type": "string"},
        "actual_title": {"type": "string"},
        "expected_marker": {"type": "string"},
        "marker_found": {"type": "boolean"},
        "response_time_ms": {"type": "number"},
        "http_status": {"type": "number"},
        "error_details": {"type": "string"},
        "request_id": {"type": "string"}
      },
      "required": ["route", "status"]
    },
    "StoryGateFilmSubmission": {
      "name": "StoryGateFilmSubmission",
      "type": "object",
      "properties": {
        "project_title": {"type": "string"},
        "project_type": {"type": "string", "enum": ["Feature Film", "Limited Series", "Series", "Narrative Nonfiction"]},
        "primary_genre": {"type": "string"},
        "secondary_genre": {"type": "string"},
        "creator_name": {"type": "string"},
        "creator_email": {"type": "string", "format": "email"},
        "linkedin_url": {"type": "string"},
        "logline": {"type": "string"},
        "synopsis": {"type": "string"},
        "evaluation_type": {"type": "string", "enum": ["Film Adaptation", "Series Development", "Narrative Review"]},
        "intended_outcome": {"type": "string", "enum": ["Film", "Television", "Publishing", "Cross-Platform"]},
        "submission_file_url": {"type": "string"},
        "file_mime_type": {"type": "string"},
        "file_size_mb": {"type": "number"},
        "status": {"type": "string", "enum": ["submitted", "under_review", "approved", "declined", "revision_requested"], "default": "submitted"},
        "evaluation_score": {"type": "number"},
        "reviewer_notes": {"type": "string"},
        "generated_deck_url": {"type": "string"}
      },
      "required": ["project_title", "project_type", "primary_genre", "creator_name", "creator_email", "logline", "synopsis", "evaluation_type", "intended_outcome"]
    },
    "RevisionEvent": {
      "name": "RevisionEvent",
      "type": "object",
      "properties": {
        "output_id": {"type": "string"},
        "output_type": {"type": "string", "enum": ["query", "synopsis", "agent_package", "film_adaptation", "complete_submission", "biography", "pitch"]},
        "revision_type": {"type": "string", "enum": ["manual", "trustedpath"], "default": "manual"},
        "base_version_id": {"type": "string"},
        "new_version_id": {"type": "string"},
        "status": {"type": "string", "enum": ["pending", "approved", "rejected"], "default": "pending"},
        "approved_at": {"type": "string", "format": "date-time"},
        "approved_by": {"type": "string"}
      },
      "required": ["output_id", "output_type"]
    },
    "OutputVersion": {
      "name": "OutputVersion",
      "type": "object",
      "properties": {
        "output_id": {"type": "string"},
        "output_type": {"type": "string", "enum": ["query", "synopsis", "agent_package", "film_adaptation", "complete_submission", "biography", "pitch"]},
        "version_number": {"type": "number"},
        "content": {"type": "string"},
        "is_baseline": {"type": "boolean", "default": false}
      },
      "required": ["output_id", "output_type", "version_number", "content"]
    },
    "RevisionSegment": {
      "name": "RevisionSegment",
      "type": "object",
      "properties": {
        "revision_event_id": {"type": "string"},
        "original_text": {"type": "string"},
        "revised_text": {"type": "string"},
        "change_type": {"type": "string", "enum": ["edit", "insert", "delete"]},
        "rationale": {"type": "string"},
        "criteria_tag": {"type": "string", "enum": ["clarity", "pacing", "structure", "tone", "redundancy", "specificity", "voice", "grammar"]},
        "order_index": {"type": "number"}
      },
      "required": ["revision_event_id", "original_text", "revised_text", "order_index"]
    },
    "Document": {
      "name": "Document",
      "type": "object",
      "properties": {
        "project_id": {"type": "string"},
        "type": {"type": "string", "enum": ["MANUSCRIPT", "SCREENPLAY", "CHAPTER", "SCENE", "SYNOPSIS", "QUERY_LETTER", "PITCH", "LOG_LINE", "AUTHOR_BIO", "MARKET_COMPARABLES", "SUPPORTING_DOC"]},
        "scope": {"type": "string", "enum": ["FULL", "PARTIAL", "UNIT"]},
        "state": {"type": "string", "enum": ["UPLOADED", "EVALUATED", "REVISION_IN_PROGRESS", "REVISED", "RESCORED", "LOCKED"], "default": "UPLOADED"},
        "parent_document_id": {"type": "string"},
        "content_reference_id": {"type": "string"},
        "content_reference_type": {"type": "string", "enum": ["Manuscript", "Chapter", "Synopsis", "Query", "Pitch", "Bio", "ComparativeReport"]},
        "title": {"type": "string"},
        "latest_score": {"type": "number"},
        "baseline_score": {"type": "number"},
        "last_activity_at": {"type": "string", "format": "date-time"},
        "locked_at": {"type": "string", "format": "date-time"},
        "locked_by": {"type": "string"},
        "state_history": {"type": "array", "items": {"type": "object"}}
      },
      "required": ["type", "scope", "state", "title"]
    },
    "DocumentVersion": {
      "name": "DocumentVersion",
      "type": "object",
      "properties": {
        "document_id": {"type": "string"},
        "version_number": {"type": "number"},
        "state_at_time": {"type": "string", "enum": ["UPLOADED", "EVALUATED", "REVISION_IN_PROGRESS", "REVISED", "RESCORED", "LOCKED"]},
        "content_snapshot": {"type": "string"},
        "score_snapshot": {"type": "number"},
        "evaluation_data": {"type": "object"},
        "diff_from_previous": {"type": "string"},
        "created_by": {"type": "string"},
        "notes": {"type": "string"}
      },
      "required": ["document_id", "version_number", "state_at_time"]
    },
    "Project": {
      "name": "Project",
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "primary_mode": {"type": "string", "enum": ["Novel", "Screenplay", "Mixed"], "default": "Novel"},
        "description": {"type": "string"},
        "archived": {"type": "boolean", "default": false}
      },
      "required": ["name"]
    },
    "EvaluationAuditEvent": {
      "name": "EvaluationAuditEvent",
      "type": "object",
      "properties": {
        "event_id": {"type": "string"},
        "request_id": {"type": "string"},
        "timestamp_utc": {"type": "string", "format": "date-time"},
        "detected_format": {"type": "string", "enum": ["scene", "chapter", "manuscript", "screenplay"]},
        "routed_pipeline": {"type": "string", "enum": ["quick", "manuscript"]},
        "user_email": {"type": "string"},
        "evaluation_mode": {"type": "string", "enum": ["standard", "transgressive", "trauma_memoir"]},
        "language_variant": {"type": "string", "enum": ["en-US", "en-UK", "en-CA", "en-AU"]},
        "voice_preservation": {"type": "string", "enum": ["maximum", "balanced", "polish"]},
        "validators_run": {"type": "array", "items": {"type": "string"}},
        "validators_failed": {"type": "array", "items": {"type": "string"}},
        "failure_codes": {"type": "array", "items": {"type": "string"}},
        "sla_metrics": {"type": "object"},
        "submission_id": {"type": "string"},
        "manuscript_id": {"type": "string"},
        "qachecklist_results": {"type": "object"},
        "detected_work_type": {"type": "string"},
        "detection_confidence": {"type": "string", "enum": ["low", "medium", "high"]},
        "user_action": {"type": "string", "enum": ["confirm", "override"]},
        "user_provided_work_type": {"type": "string"},
        "final_work_type_used": {"type": "string"},
        "matrix_version": {"type": "string"},
        "criteria_plan": {"type": "object"}
      },
      "required": ["event_id", "request_id", "timestamp_utc", "detected_format", "routed_pipeline", "user_email"]
    },
    "QueryLetterJob": {
      "name": "QueryLetterJob",
      "type": "object",
      "properties": {
        "status": {"type": "string", "enum": ["pending", "processing", "completed", "failed"], "default": "pending"},
        "manuscript_text": {"type": "string"},
        "manuscript_file_url": {"type": "string"},
        "bio": {"type": "string"},
        "synopsis_mode": {"type": "string", "default": "auto"},
        "existing_synopsis": {"type": "string"},
        "one_line_pitch": {"type": "string"},
        "pitch_paragraph": {"type": "string"},
        "comps_mode": {"type": "string", "default": "auto"},
        "manual_comps": {"type": "string"},
        "genre": {"type": "string"},
        "voice_intensity": {"type": "string", "default": "house"},
        "progress": {"type": "string"},
        "result": {"type": "object"},
        "error_message": {"type": "string"},
        "processing_started_at": {"type": "string", "format": "date-time"},
        "completed_at": {"type": "string", "format": "date-time"}
      },
      "required": ["manuscript_text", "bio"]
    },
    "EvaluationRun": {
      "name": "EvaluationRun",
      "type": "object",
      "properties": {
        "projectId": {"type": "string"},
        "workTypeUi": {"type": "string"},
        "sourceFileId": {"type": "string"},
        "sourceFilename": {"type": "string"},
        "sourceWordCountEstimate": {"type": "number"},
        "inputFingerprintHash": {"type": "string"},
        "segmentationMode": {"type": "string"},
        "segmentationUserConfirmed": {"type": "boolean", "default": false},
        "phase2Enabled": {"type": "boolean", "default": true},
        "readinessFloor": {"type": "number", "default": 8.0},
        "coverageMinChapters": {"type": "number", "default": 5},
        "coverageMinWordPct": {"type": "number", "default": 0.25},
        "governanceVersion": {"type": "string", "default": "EVAL_METHOD_v1.0.0"},
        "allowRawTextInPhase2": {"type": "boolean", "default": false},
        "phase2ReadOnlyScores": {"type": "boolean", "default": true},
        "status": {"type": "string", "enum": ["created", "segmented", "phase1_complete", "gated", "phase2_skipped", "phase2_complete", "complete", "failed"], "default": "created"},
        "statusDetail": {"type": "string"}
      },
      "required": ["projectId", "workTypeUi", "sourceFileId", "inputFingerprintHash", "governanceVersion"]
    },
    "EvaluationSegment": {
      "name": "EvaluationSegment",
      "type": "object",
      "properties": {
        "runId": {"type": "string"},
        "segmentIndex": {"type": "number"},
        "segmentStableId": {"type": "string"},
        "segmentLabel": {"type": "string"},
        "segmentStartOffset": {"type": "number"},
        "segmentEndOffset": {"type": "number"},
        "segmentWordCount": {"type": "number"},
        "criteriaScores": {"type": "object"},
        "criteriaNotes": {"type": "array", "items": {"type": "object"}},
        "waveSubstrate": {"type": "object"},
        "compressedSummary": {"type": "string"}
      },
      "required": ["runId", "segmentIndex", "segmentStableId", "segmentLabel", "segmentWordCount"]
    },
    "EvaluationArtifacts": {
      "name": "EvaluationArtifacts",
      "type": "object",
      "properties": {
        "runId": {"type": "string"},
        "phase1OverallReadiness": {"type": "number"},
        "phase1CriteriaAggregate": {"type": "object"},
        "coverageSegmentsEvaluated": {"type": "number"},
        "coverageSegmentsTotalEstimate": {"type": "number"},
        "coverageWordCountEvaluated": {"type": "number"},
        "coverageWordCountTotalEstimate": {"type": "number"},
        "coverageWordPctEvaluated": {"type": "number"},
        "chapterSummaries": {"type": "array", "items": {"type": "object"}},
        "beatMap": {"type": "object"},
        "actMap": {"type": "object"},
        "threadGraph": {"type": "object"}
      },
      "required": ["runId", "phase1OverallReadiness"]
    },
    "EvaluationGateDecision": {
      "name": "EvaluationGateDecision",
      "type": "object",
      "properties": {
        "runId": {"type": "string"},
        "readinessFloor": {"type": "number"},
        "readinessValue": {"type": "number"},
        "readinessPassed": {"type": "boolean"},
        "coverageMinChapters": {"type": "number"},
        "coverageMinWordPct": {"type": "number"},
        "coverageChaptersValue": {"type": "number"},
        "coverageWordPctValue": {"type": "number"},
        "coveragePassed": {"type": "boolean"},
        "coverageFailReason": {"type": "string"},
        "integrityPassed": {"type": "boolean"},
        "integrityObserved": {"type": "object"},
        "integrityFailReason": {"type": "string"},
        "phase2Allowed": {"type": "boolean"},
        "phase2BlockReason": {"type": "string", "enum": ["readiness_insufficient", "coverage_insufficient", "integrity_failed", "policy_disabled"]},
        "userMessageTitle": {"type": "string"},
        "userMessageBody": {"type": "string"}
      },
      "required": ["runId", "readinessPassed", "coveragePassed", "integrityPassed", "phase2Allowed"]
    },
    "EvaluationSpineSynthesis": {
      "name": "EvaluationSpineSynthesis",
      "type": "object",
      "properties": {
        "runId": {"type": "string"},
        "spineReadiness": {"type": "number"},
        "diagnosis": {"type": "array", "items": {"type": "object"}},
        "waveGuide": {"type": "object"},
        "governanceAssertions": {"type": "object"}
      },
      "required": ["runId", "spineReadiness", "governanceAssertions"]
    },
    "AgencyOrg": {
      "name": "AgencyOrg",
      "type": "object",
      "properties": {
        "orgName": {"type": "string"},
        "orgType": {"type": "string", "enum": ["AGENCY", "PRODUCTION_COMPANY", "MANAGEMENT", "STUDIO", "OTHER"]},
        "website": {"type": "string"},
        "verifiedStatus": {"type": "string", "enum": ["UNVERIFIED", "PENDING", "VERIFIED", "SUSPENDED"], "default": "UNVERIFIED"},
        "verifiedAt": {"type": "string", "format": "date-time"},
        "verifiedBy": {"type": "string"},
        "primaryContactEmail": {"type": "string", "format": "email"},
        "notes": {"type": "string"}
      },
      "required": ["orgName", "orgType"]
    },
    "OrgMembership": {
      "name": "OrgMembership",
      "type": "object",
      "properties": {
        "orgId": {"type": "string"},
        "userEmail": {"type": "string", "format": "email"},
        "role": {"type": "string", "enum": ["ADMIN", "MEMBER", "GUEST"], "default": "MEMBER"},
        "joinedAt": {"type": "string", "format": "date-time"},
        "active": {"type": "boolean", "default": true}
      },
      "required": ["orgId", "userEmail"]
    },
    "IndustryDecision": {
      "name": "IndustryDecision",
      "type": "object",
      "properties": {
        "submissionId": {"type": "string"},
        "orgId": {"type": "string"},
        "decisionMakerEmail": {"type": "string", "format": "email"},
        "decision": {"type": "string", "enum": ["PASS", "REQUEST_FULL", "OFFER_REP", "PENDING"]},
        "internalReasonCode": {"type": "string", "enum": ["NOT_RIGHT_FIT", "LIST_FULL", "MARKET_TIMING", "CRAFT_CONCERNS", "OTHER"]},
        "internalNotes": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}}
      },
      "required": ["submissionId", "decisionMakerEmail", "decision"]
    },
    "IndustryMessage": {
      "name": "IndustryMessage",
      "type": "object",
      "properties": {
        "submissionId": {"type": "string"},
        "decisionId": {"type": "string"},
        "senderEmail": {"type": "string", "format": "email"},
        "recipientEmail": {"type": "string", "format": "email"},
        "messageType": {"type": "string", "enum": ["PASS", "REQUEST_MATERIALS", "INITIAL_INTEREST", "CUSTOM"]},
        "subject": {"type": "string"},
        "body": {"type": "string"},
        "sentAt": {"type": "string", "format": "date-time"},
        "status": {"type": "string", "enum": ["DRAFT", "SENT", "FAILED"], "default": "DRAFT"}
      },
      "required": ["submissionId", "senderEmail", "recipientEmail", "messageType", "subject", "body"]
    },
    "ResponseTemplate": {
      "name": "ResponseTemplate",
      "type": "object",
      "properties": {
        "orgId": {"type": "string"},
        "ownerEmail": {"type": "string", "format": "email"},
        "templateName": {"type": "string"},
        "messageType": {"type": "string", "enum": ["PASS", "REQUEST_MATERIALS", "INITIAL_INTEREST", "CUSTOM"]},
        "subject": {"type": "string"},
        "body": {"type": "string"},
        "isDefault": {"type": "boolean", "default": false},
        "shared": {"type": "boolean", "default": false}
      },
      "required": ["ownerEmail", "templateName", "messageType", "subject", "body"]
    }
  }
}