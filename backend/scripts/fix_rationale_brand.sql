-- One-shot: replace legacy brand names in lot rationales
-- Run once against production DB, then discard.

UPDATE lots SET score_rationale = REPLACE(score_rationale, 'HONO', 'Nautilus')
WHERE score_rationale LIKE '%HONO%';

UPDATE lots SET score_rationale = REPLACE(score_rationale, 'ArtAlpha', 'Nautilus')
WHERE score_rationale LIKE '%ArtAlpha%';
