import React from 'react';

/**
 * ScreenplayText component - Renders screenplay text with proper WriterDuet formatting
 * 
 * Standard screenplay format:
 * - Scene headings (INT./EXT.): Left-aligned, all caps
 * - Action/Description: Left-aligned, normal case
 * - Character names: Centered (3.7" from left)
 * - Parentheticals: Centered under character (3.1" from left)
 * - Dialogue: Centered column (2.5" from left, max width 3.5")
 * - Transitions: Right-aligned or far right
 */

export default function ScreenplayText({ text, className = '' }) {
    const formatScreenplayLine = (line) => {
        const trimmed = line.trim();
        
        // Empty line
        if (!trimmed) {
            return <div className="h-4" key={Math.random()} />;
        }
        
        // Scene heading (INT./EXT./INT/EXT)
        if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed)) {
            return (
                <div key={Math.random()} className="text-left font-bold mb-2">
                    {trimmed}
                </div>
            );
        }
        
        // Transition (FADE IN:, CUT TO:, etc.)
        if (/^(FADE IN:|FADE OUT|FADE TO BLACK|CUT TO:|DISSOLVE TO:|SMASH CUT TO:)/.test(trimmed)) {
            return (
                <div key={Math.random()} className="text-right mb-2">
                    {trimmed}
                </div>
            );
        }
        
        // Character name (all caps, may have extension like (V.O.) or (O.S.))
        if (/^[A-Z][A-Z\s]+(\s*\([^)]+\))?\s*$/.test(trimmed) && trimmed.length < 50) {
            return (
                <div key={Math.random()} className="text-center font-semibold mt-4 mb-1">
                    {trimmed}
                </div>
            );
        }
        
        // Parenthetical (stage direction in dialogue)
        if (/^\([^)]+\)$/.test(trimmed)) {
            return (
                <div key={Math.random()} className="text-center text-sm italic mb-1" style={{ paddingLeft: '20%', paddingRight: '20%' }}>
                    {trimmed}
                </div>
            );
        }
        
        // Dialogue (follows character name, indented)
        const previousLines = text.split('\n');
        const currentIndex = previousLines.findIndex(l => l.trim() === trimmed);
        const previousLine = currentIndex > 0 ? previousLines[currentIndex - 1]?.trim() : '';
        
        // Check if previous line was a character name or parenthetical
        const isDialogue = /^[A-Z][A-Z\s]+(\s*\([^)]+\))?\s*$/.test(previousLine) || /^\([^)]+\)$/.test(previousLine);
        
        if (isDialogue) {
            return (
                <div key={Math.random()} className="mb-1" style={{ paddingLeft: '15%', paddingRight: '15%', textAlign: 'left' }}>
                    {trimmed}
                </div>
            );
        }
        
        // Action/description (default, left-aligned)
        return (
            <div key={Math.random()} className="text-left mb-2">
                {trimmed}
            </div>
        );
    };
    
    const lines = text.split('\n');
    
    return (
        <div className={`screenplay-text font-mono text-sm leading-relaxed ${className}`}>
            {lines.map((line, idx) => (
                <React.Fragment key={idx}>
                    {formatScreenplayLine(line)}
                </React.Fragment>
            ))}
        </div>
    );
}