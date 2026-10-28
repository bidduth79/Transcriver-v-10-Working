// Removes AI looping artifacts: repeated paragraphs, sentences and run-on clauses
export const removeRepetitiveBlocks = (text: string): string => {
    if (!text || text.length < 100) return text;
    
    let cleaned = text;

    // 1. Paragraph-level O(N) deduplication across the entire text
    const paragraphs = cleaned.split(/\n+/);
    const deduplicatedParagraphs: string[] = [];
    const seenParagraphs = new Map<string, number>();

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        // Normalize text for comparison by stripping timestamps, bold markers, and common punctuation
        const normalized = trimmed
            .replace(/^\[[0-9০-৯]{1,2}:[0-9০-৯]{2}(:[0-9০-৯]{2})?\]\s*(\*\*.*?\*\*\s*)?/, '')
            .replace(/[।,?!.\s]/g, '')
            .slice(0, 120);

        if (normalized.length > 20) {
            const count = seenParagraphs.get(normalized) || 0;
            if (count >= 2) {
                continue;
            }
            seenParagraphs.set(normalized, count + 1);
        }
        deduplicatedParagraphs.push(para);
    }
    cleaned = deduplicatedParagraphs.join('\n\n');

    // 2. Sentence-level O(N) deduplication (catches repeating sentences within unformatted blocks)
    const sentenceTokens = cleaned.split(/([।?!]|\n+)/);
    const sentenceUnits: string[] = [];
    for (let i = 0; i < sentenceTokens.length; i += 2) {
        const unit = (sentenceTokens[i] || '') + (sentenceTokens[i + 1] || '');
        // Keep newline-only units so paragraph breaks after "।", "?" or "!" are preserved
        if (unit.trim() || unit.includes('\n')) sentenceUnits.push(unit);
    }

    const finalSentences: string[] = [];
    const recentSentences: string[] = [];
    const globalSentenceCounts = new Map<string, number>();

    for (let unit of sentenceUnits) {
        // 3. Fast O(N) clause deduplication inside very long run-on sentences (>250 chars without punctuation)
        if (unit.length > 250 && unit.includes(',')) {
            const clauses = unit.split(',');
            const dedupClauses: string[] = [];
            const recentClauses: string[] = [];
            for (const clause of clauses) {
                const cNorm = clause.replace(/\s+/g, '').trim();
                if (cNorm.length > 18 && recentClauses.includes(cNorm)) {
                    continue;
                }
                if (cNorm.length > 18) {
                    recentClauses.push(cNorm);
                    if (recentClauses.length > 5) recentClauses.shift();
                }
                dedupClauses.push(clause);
            }
            unit = dedupClauses.join(',');
        }

        const norm = unit
            .replace(/^[\s\n]*\[[0-9০-৯]{1,2}:[0-9০-৯]{2}(:[0-9০-৯]{2})?\]\s*(\*\*.*?\*\*\s*)?/, '')
            .replace(/[।,?!.\s]/g, '')
            .trim();

        if (norm.length > 15) {
            if (recentSentences.includes(norm)) {
                continue; // Skip consecutive or near-consecutive repeating sentence
            }
            const totalSeen = globalSentenceCounts.get(norm) || 0;
            if (norm.length > 30 && totalSeen >= 2) {
                continue; // Skip long sentence repeated multiple times across the transcript
            }
            globalSentenceCounts.set(norm, totalSeen + 1);
            recentSentences.push(norm);
            if (recentSentences.length > 15) recentSentences.shift();
        }
        finalSentences.push(unit);
    }
    cleaned = finalSentences.join('');

    return cleaned.trim();
};

// A paragraph longer than this is split for reading (about a minute of Bengali speech)
const LONG_PARAGRAPH_CHARS = 900;
// Each new piece collects whole sentences until it reaches about this length
const PIECE_CHARS = 500;

/**
 * Gemini sometimes writes a long speech as one huge paragraph. This splits such a paragraph after a
 * sentence end (। ? !) into readable pieces. No word is changed or lost; the first piece keeps the
 * timestamp and speaker, the others have none, since the audio time of a sentence is not known.
 */
export const splitLongParagraphs = (text: string): string => {
    if (!text) return text;
    return text.split('\n').map(line => {
        if (line.length <= LONG_PARAGRAPH_CHARS) return line;
        const sentences = line.split(/(?<=[।?!])\s+/);
        if (sentences.length < 2) return line;
        const pieces: string[] = [];
        let piece = '';
        for (const sentence of sentences) {
            piece = piece ? `${piece} ${sentence}` : sentence;
            if (piece.length >= PIECE_CHARS) {
                pieces.push(piece);
                piece = '';
            }
        }
        if (piece) {
            // A short tail joins the piece before it rather than standing alone
            if (pieces.length > 0 && piece.length < PIECE_CHARS / 3) pieces[pieces.length - 1] += ` ${piece}`;
            else pieces.push(piece);
        }
        return pieces.join('\n\n');
    }).join('\n');
};
