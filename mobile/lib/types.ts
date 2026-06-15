// lib/types.ts

export interface PortfolioItem {
  id: string;
  user_id: string;
  workspace_id: string | null;
  artist_name: string | null;
  artist_name_display: string | null;
  artist_id: string | null;
  title: string | null;
  year_created: number | null;
  medium: string | null;
  dimensions: string | null;
  image_url: string | null;
  image_urls: string[];
  purchase_price_eur: number | null;
  purchase_date: string | null;
  purchase_auction_house: string | null;
  estimated_current_value_eur: number | null;
  estimation_confidence: number | null;
  last_estimated_at: string | null;
  certificate_of_authenticity: boolean;
  document_urls: string[];
  provenance: string | null;
  condition: string | null;
  personal_note: string | null; // max 140 chars, jamais généré
  import_mode: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  type: 'personal' | 'advisor_client';
  is_advisor: boolean;
  collection_manifesto: string | null;
  collection_goal: string | null;
  created_at: string;
}

export interface CollectionAlert {
  id: string;
  user_id: string;
  workspace_id: string | null;
  portfolio_item_id: string | null;
  artist_id: string | null;
  type:
    | 'market_sale'
    | 'valuation_up'
    | 'valuation_down'
    | 'exposition'
    | 'opportunity'
    | 'collection_health'
    | 'documentation';
  title: string;
  body: string | null;
  source_url: string | null;
  read: boolean;
  created_at: string;
}

export interface CollectionValuation {
  id: string;
  collection_item_id: string;
  user_id: string;
  estimated_value_eur: number;
  value_low: number | null;
  value_high: number | null;
  comparables_count: number;
  confidence: number | null;
  estimation_date: string;
  model_version: string | null;
}

// États de l'Artwork Model V1
export type ArtworkState = 'brouillon' | 'complete' | 'documentee' | 'valorisee';

export function getArtworkState(item: PortfolioItem): ArtworkState {
  if (item.estimated_current_value_eur !== null) return 'valorisee';
  if (item.certificate_of_authenticity || item.document_urls.length > 0)
    return 'documentee';
  if (item.medium && item.dimensions && item.image_url) return 'complete';
  return 'brouillon';
}
