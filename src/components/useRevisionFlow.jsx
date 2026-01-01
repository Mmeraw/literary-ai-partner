import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Centralized revision flow hook - use this in ALL output pages
 * 
 * @param {string} outputType - 'synopsis', 'query', 'biography', 'pitch', etc.
 * @returns Revision state and handlers
 */
export function useRevisionFlow(outputType) {
    const [baselineVersionId, setBaselineVersionId] = useState(null);
    const [revisedVersionId, setRevisedVersionId] = useState(null);
    const [revisionEventId, setRevisionEventId] = useState(null);
    const [showViewer, setShowViewer] = useState(false);
    const [processing, setProcessing] = useState(false);

    /**
     * Create initial baseline OutputVersion
     */
    const createBaseline = async (content, outputId = null) => {
        try {
            const version = await base44.entities.OutputVersion.create({
                output_id: outputId || `${outputType}_${Date.now()}`,
                output_type: outputType,
                version_number: 1,
                content,
                is_baseline: true
            });
            setBaselineVersionId(version.id);
            return version;
        } catch (error) {
            console.error('Failed to create baseline version:', error);
            throw error;
        }
    };

    /**
     * Request revision: creates revised version + segments
     */
    const requestRevision = async (baselineContent, revisedContent) => {
        if (!baselineVersionId) {
            toast.error('No baseline version found');
            return;
        }

        setProcessing(true);
        try {
            // Create revised OutputVersion
            const baselineVersions = await base44.entities.OutputVersion.filter({ id: baselineVersionId });
            const baselineVersion = baselineVersions[0];

            const revisedVersion = await base44.entities.OutputVersion.create({
                output_id: baselineVersion.output_id,
                output_type: outputType,
                version_number: baselineVersion.version_number + 1,
                content: revisedContent,
                is_baseline: false
            });
            setRevisedVersionId(revisedVersion.id);

            // Generate revision segments
            const response = await base44.functions.invoke('generateRevisionSegments', {
                base_version_id: baselineVersionId,
                new_version_id: revisedVersion.id,
                output_type: outputType
            });

            if (response.success) {
                setRevisionEventId(response.revision_event_id);
                setShowViewer(true);
                toast.success(`Revision created with ${response.segment_count} changes`);
            } else {
                toast.error('Failed to generate revision segments');
            }
        } catch (error) {
            console.error('Revision request failed:', error);
            toast.error('Failed to create revision');
        } finally {
            setProcessing(false);
        }
    };

    /**
     * Approve revision: promotes revised → baseline
     */
    const approveRevision = async () => {
        if (!revisionEventId) {
            toast.error('No revision to approve');
            return;
        }

        setProcessing(true);
        try {
            await base44.functions.invoke('approveRevision', {
                revision_event_id: revisionEventId
            });

            // Update state: revised becomes new baseline
            setBaselineVersionId(revisedVersionId);
            setRevisedVersionId(null);
            setRevisionEventId(null);
            setShowViewer(false);

            toast.success('Revision approved and promoted to baseline!');
        } catch (error) {
            console.error('Approval failed:', error);
            toast.error('Failed to approve revision');
        } finally {
            setProcessing(false);
        }
    };

    /**
     * Close viewer without approving
     */
    const closeViewer = () => {
        setShowViewer(false);
    };

    return {
        baselineVersionId,
        revisedVersionId,
        revisionEventId,
        showViewer,
        processing,
        createBaseline,
        requestRevision,
        approveRevision,
        closeViewer,
        hasRevision: !!revisionEventId
    };
}