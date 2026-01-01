import { toast } from 'sonner';

/**
 * Centralized TXT export utility
 * @param {string} content - Content to export
 * @param {string} filename - Output filename
 */
export function exportTxt(content, filename) {
    if (!content) {
        toast.error('No content to export');
        return;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded!');
}

/**
 * Export revised version comparison
 */
export function exportRevisionComparison(baseline, revised, filename) {
    const content = `BASELINE VERSION:\n${baseline}\n\n${'='.repeat(80)}\n\nREVISED VERSION:\n${revised}`;
    exportTxt(content, filename);
}