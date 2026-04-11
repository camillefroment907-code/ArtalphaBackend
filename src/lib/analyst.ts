export interface LotData {
  artist: string;
  title: string;
  price: number;
  estimate: number;
  medium?: string;
  technique?: string;
  auction_house?: string;
  country?: string;
  price_per_cm2?: number;
  artist_avg_price?: number;
  deal_score?: number;
  pct_below?: number;
}

export type VerdictType = 'STRONG BUY' | 'BUY' | 'WATCH' | 'PASS';

export interface AnalysisResult {
  // Verdict
  verdict: VerdictType;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  verdictReason: string;
  bullCase: string;
  bearCase: string;
  idealBuyerProfile: string;
  holdPeriod: string;
  exitStrategy: string;
  // Artist profile
  artistBiography: string;
  marketTier: string;
  marketTierExplanation: string;
  cotationScore: number;
  cotationLabel: string;
  liquidity: string;
  priceTrend: string;
  priceTrendExplanation: string;
  notableSales: string;
  similarArtists: string[];
  // Artwork
  provenanceQuality: string;
  provenanceNotes: string;
  rarity: string;
  rarityExplanation: string;
  periodSignificance: string;
  // Market
  currentPricing: string;
  pricingExplanation: string;
  comparableSales: Array<{ description: string; price: string; year: string; house: string }>;
  marketTiming: string;
  timingExplanation: string;
  // Projections
  projectionMethodology: string;
  basePrice: number;
  projections: {
    conservative: { cagr: number; '5yr': number; '10yr': number; '20yr': number; '50yr': number; scenario: string };
    base:         { cagr: number; '5yr': number; '10yr': number; '20yr': number; '50yr': number; scenario: string };
    optimistic:   { cagr: number; '5yr': number; '10yr': number; '20yr': number; '50yr': number; scenario: string };
    confidence: string;
    keyFactors: string[];
    risks: string[];
  };
  // Risk
  overallRisk: string;
  risks: Array<{ factor: string; severity: string; explanation: string }>;
  riskMitigants: string[];
  raw?: string;
}

export const VERDICT_CONFIG: Record<VerdictType, { color: string; bg: string; border: string; icon: string }> = {
  'STRONG BUY': { color: '#FFFFFF', bg: '#1A2A44', border: '#1A2A44', icon: '▲▲' },
  'BUY':        { color: '#FFFFFF', bg: '#2D6A4F', border: '#2D6A4F', icon: '▲' },
  'WATCH':      { color: '#92400E', bg: '#FEF3C7', border: '#D97706', icon: '◎' },
  'PASS':       { color: '#7F1D1D', bg: '#FEE2E2', border: '#DC2626', icon: '▼' },
};

function buildPrompt(lot: LotData): string {
  const p = lot.price || 0;
  return `You are the Chief Investment Officer at Nautilus, the world's most sophisticated art investment platform.

Produce a complete investment dossier for this auction lot. Be precise, data-driven, and honest about uncertainty.

ARTWORK DATA:
Artist: ${lot.artist || 'Unknown'}
Title: ${lot.title || 'Untitled'}
Current Price: €${p.toLocaleString()}
High Estimate: €${(lot.estimate || 0).toLocaleString()}
${lot.medium ? `Medium: ${lot.medium}` : ''}
${lot.technique ? `Technique: ${lot.technique}` : ''}
Auction House: ${lot.auction_house || 'Unknown'}
${lot.country ? `Country: ${lot.country}` : ''}
${lot.price_per_cm2 ? `Price/cm²: €${lot.price_per_cm2.toFixed(2)}` : ''}
${lot.artist_avg_price ? `Artist avg auction price: €${lot.artist_avg_price.toLocaleString()}` : ''}
${lot.deal_score ? `Nautilus deal score: ${lot.deal_score}/100` : ''}
${lot.pct_below ? `Below estimate: ${lot.pct_below.toFixed(0)}%` : ''}

Return ONLY valid JSON (no markdown, no extra text) matching this schema exactly:

{
  "artist_profile": {
    "biography": "2-3 sentences: nationality, movement, career highlights",
    "market_tier": "BLUE_CHIP | ESTABLISHED | MID_CAREER | EMERGING | DECORATIVE",
    "market_tier_explanation": "1 sentence",
    "cotation_score": 1,
    "cotation_label": "string",
    "liquidity": "HIGH | MEDIUM | LOW",
    "liquidity_explanation": "1 sentence",
    "price_trend": "RISING | STABLE | DECLINING | VOLATILE",
    "price_trend_explanation": "1 sentence",
    "notable_sales": "1-2 sentences about record prices if known",
    "similar_artists": ["Artist 1", "Artist 2", "Artist 3"]
  },
  "artwork_analysis": {
    "provenance_quality": "STRONG | MODERATE | WEAK | UNKNOWN",
    "provenance_notes": "string",
    "rarity": "UNIQUE | RARE | COMMON_FOR_ARTIST | MASS_PRODUCED",
    "rarity_explanation": "1 sentence",
    "period_significance": "string"
  },
  "market_analysis": {
    "current_pricing": "SIGNIFICANTLY_UNDERVALUED | UNDERVALUED | FAIR_VALUE | OVERVALUED",
    "pricing_explanation": "2 sentences",
    "comparable_sales": [
      { "description": "string", "price": "€X,XXX", "year": "YYYY", "house": "string" }
    ],
    "market_timing": "EXCELLENT | GOOD | NEUTRAL | POOR",
    "timing_explanation": "string"
  },
  "investment_projections": {
    "methodology": "string",
    "conservative": { "cagr": 0.03, "5yr": 0, "10yr": 0, "20yr": 0, "50yr": 0, "scenario": "string" },
    "base":         { "cagr": 0.06, "5yr": 0, "10yr": 0, "20yr": 0, "50yr": 0, "scenario": "string" },
    "optimistic":   { "cagr": 0.10, "5yr": 0, "10yr": 0, "20yr": 0, "50yr": 0, "scenario": "string" },
    "projection_confidence": "LOW | MEDIUM | HIGH",
    "key_projection_factors": ["factor 1"],
    "risks_to_projection": ["risk 1"]
  },
  "investment_verdict": {
    "verdict": "STRONG_BUY | BUY | WATCH | PASS",
    "confidence": "HIGH | MEDIUM | LOW",
    "one_line": "string",
    "bull_case": "string",
    "bear_case": "string",
    "ideal_buyer_profile": "string",
    "hold_period": "string",
    "exit_strategy": "string"
  },
  "risk_assessment": {
    "overall_risk": "LOW | MEDIUM | HIGH | VERY_HIGH",
    "risks": [{ "factor": "string", "severity": "LOW|MEDIUM|HIGH", "explanation": "string" }],
    "risk_mitigants": ["string"]
  }
}

RULES:
- Calculate ALL projection values using the cagr: value = ${p} * (1 + cagr)^years. Do NOT leave zeros.
- Adjust cagr by artist tier: Blue chip 0.08-0.12, Established 0.05-0.08, Emerging 0.03-0.06, Unknown 0.01-0.04
- conservative cagr = base cagr - 0.03, optimistic cagr = base cagr + 0.04
- Be honest: if artist is unknown, say so and use low cagr
- All money in EUR`;
}

function calcProj(base: number, cagr: number, scenario: string) {
  return {
    cagr,
    '5yr':  Math.round(base * Math.pow(1 + cagr, 5)),
    '10yr': Math.round(base * Math.pow(1 + cagr, 10)),
    '20yr': Math.round(base * Math.pow(1 + cagr, 20)),
    '50yr': Math.round(base * Math.pow(1 + cagr, 50)),
    scenario,
  };
}

function mapJsonToResult(d: any, basePrice: number): AnalysisResult {
  const ap = d.artist_profile || {};
  const aa = d.artwork_analysis || {};
  const ma = d.market_analysis || {};
  const ip = d.investment_projections || {};
  const iv = d.investment_verdict || {};
  const ra = d.risk_assessment || {};

  const verdictMap: Record<string, VerdictType> = {
    STRONG_BUY: 'STRONG BUY', 'STRONG BUY': 'STRONG BUY',
    BUY: 'BUY', WATCH: 'WATCH', PASS: 'PASS',
  };

  const fillProj = (raw: any, fallbackCagr: number, scenario: string) => {
    const cagr = raw?.cagr ?? fallbackCagr;
    const p = calcProj(basePrice, cagr, raw?.scenario ?? scenario);
    // Use AI values if non-zero, else calculate
    return {
      cagr,
      '5yr':  raw?.['5yr']  || p['5yr'],
      '10yr': raw?.['10yr'] || p['10yr'],
      '20yr': raw?.['20yr'] || p['20yr'],
      '50yr': raw?.['50yr'] || p['50yr'],
      scenario: raw?.scenario ?? scenario,
    };
  };

  return {
    verdict: verdictMap[iv.verdict] ?? 'WATCH',
    confidence: iv.confidence ?? 'MEDIUM',
    verdictReason: iv.one_line ?? '',
    bullCase: iv.bull_case ?? '',
    bearCase: iv.bear_case ?? '',
    idealBuyerProfile: iv.ideal_buyer_profile ?? '',
    holdPeriod: iv.hold_period ?? '',
    exitStrategy: iv.exit_strategy ?? '',
    artistBiography: ap.biography ?? '',
    marketTier: ap.market_tier ?? '',
    marketTierExplanation: ap.market_tier_explanation ?? '',
    cotationScore: Number(ap.cotation_score) || 0,
    cotationLabel: ap.cotation_label ?? '',
    liquidity: ap.liquidity ?? '',
    priceTrend: ap.price_trend ?? '',
    priceTrendExplanation: ap.price_trend_explanation ?? '',
    notableSales: ap.notable_sales ?? '',
    similarArtists: Array.isArray(ap.similar_artists) ? ap.similar_artists : [],
    provenanceQuality: aa.provenance_quality ?? '',
    provenanceNotes: aa.provenance_notes ?? '',
    rarity: aa.rarity ?? '',
    rarityExplanation: aa.rarity_explanation ?? '',
    periodSignificance: aa.period_significance ?? '',
    currentPricing: ma.current_pricing ?? '',
    pricingExplanation: ma.pricing_explanation ?? '',
    comparableSales: Array.isArray(ma.comparable_sales) ? ma.comparable_sales : [],
    marketTiming: ma.market_timing ?? '',
    timingExplanation: ma.timing_explanation ?? '',
    projectionMethodology: ip.methodology ?? '',
    basePrice,
    projections: {
      conservative: fillProj(ip.conservative, 0.03, 'Flat market, no artist appreciation'),
      base:         fillProj(ip.base,         0.06, 'Historical art market average'),
      optimistic:   fillProj(ip.optimistic,   0.10, 'Artist recognition increases, strong demand'),
      confidence: ip.projection_confidence ?? 'MEDIUM',
      keyFactors: Array.isArray(ip.key_projection_factors) ? ip.key_projection_factors : [],
      risks: Array.isArray(ip.risks_to_projection) ? ip.risks_to_projection : [],
    },
    overallRisk: ra.overall_risk ?? 'MEDIUM',
    risks: Array.isArray(ra.risks) ? ra.risks : [],
    riskMitigants: Array.isArray(ra.risk_mitigants) ? ra.risk_mitigants : [],
    raw: JSON.stringify(d),
  };
}

export async function analyzeArtwork(lot: LotData): Promise<AnalysisResult> {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!key || key.length < 20 || key.startsWith('REPLACE_')) {
    throw new Error('API key not configured. Add VITE_ANTHROPIC_API_KEY to .env');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: buildPrompt(lot) }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`API ${response.status}: ${(err as any)?.error?.message ?? 'Unknown error'}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';
  if (!text) throw new Error('Empty AI response');

  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return mapJsonToResult(JSON.parse(clean), lot.price || 0);
  } catch {
    throw new Error('Failed to parse AI response. The model returned invalid JSON.');
  }
}
