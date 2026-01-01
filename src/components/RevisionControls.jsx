import React from 'react';
import { Button } from "@/components/ui/button";
import { FileEdit, Eye, CheckCircle2, X } from 'lucide-react';

/**
 * Reusable revision control buttons
 */
export default function RevisionControls({
    hasBaseline,
    hasRevision,
    showingViewer,
    processing,
    onRequestRevision,
    onShowViewer,
    onApprove,
    onClose
}) {
    if (showingViewer) {
        return (
            <div className="flex gap-2">
                <Button
                    onClick={onApprove}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve & Promote to Baseline
                </Button>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={processing}
                >
                    <X className="w-4 h-4 mr-2" />
                    Close Viewer
                </Button>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            {hasBaseline && !hasRevision && (
                <Button
                    variant="outline"
                    onClick={onRequestRevision}
                    disabled={processing}
                >
                    <FileEdit className="w-4 h-4 mr-2" />
                    Request Revision
                </Button>
            )}
            {hasRevision && (
                <Button
                    variant="outline"
                    onClick={onShowViewer}
                    disabled={processing}
                >
                    <Eye className="w-4 h-4 mr-2" />
                    Review Changes
                </Button>
            )}
        </div>
    );
}