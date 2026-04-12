import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface FilterSidebarProps {
  onFilterChange: (filters: Filters) => void;
  tab: 'alpha' | 'live';
}

export interface Filters {
  // Shared
  searchQuery: string;
  sortBy: string;
  // Market tab sources (multi-select, server-side)
  sources: string[];
  auctionHouseSearch: string;
  // Alpha tab single-source (kept for compat)
  platforms: string[];
  // Alpha
  scoreRange: [number, number];
  upsideRange: string;
  categories: string[];
  mediums: string[];
  minPrice: number;
  maxPrice: number;
  artistSearch: string;
  // Market date range
  auctionDateFrom: string;
  auctionDateTo: string;
  // Market country filter
  countries: string[];
  // Alpha-specific
  artistRating: string;   // 'all' | 'emerging' | 'established' | 'blue_chip'
  auctionTiming: string;  // 'all' | '24h' | 'week' | 'month'
  // Legacy (unused but kept for type compat)
  priceRange: [number, number];
  artworkTypes: string[];
  artists: string[];
  sizes: string[];
}

const DEFAULT_FILTERS: Filters = {
  searchQuery: '',
  sortBy: '',
  sources: [],
  auctionHouseSearch: '',
  platforms: [],
  scoreRange: [0, 5],
  upsideRange: 'all',
  categories: [],
  mediums: [],
  minPrice: 0,
  maxPrice: 0,
  artistSearch: '',
  auctionDateFrom: '',
  auctionDateTo: '',
  countries: [],
  artistRating: 'all',
  auctionTiming: 'all',
  priceRange: [0, 1000000],
  artworkTypes: [],
  artists: [],
  sizes: [],
};

// ── data ─────────────────────────────────────────────────────
const CATEGORIES = [
  'Paintings', 'Drawings', 'Sculpture', 'Prints', 'Photography',
  'Jewelry', 'Furniture', 'Ceramics', 'Books', 'Asian Art',
];
const MEDIUMS = [
  'Oil on canvas', 'Watercolor', 'Acrylic', 'Mixed media',
  'Bronze', 'Marble', 'Lithograph', 'Photography',
];

// source.value must match the DB enum value (lowercase)
const MARKET_SOURCES = [
  { label: 'Drouot',        value: 'drouot',        flag: '🇫🇷' },
  { label: 'Interenchères', value: 'interencheres',  flag: '🇫🇷' },
  { label: 'Invaluable',    value: 'invaluable',     flag: '🇺🇸' },
  { label: "Sotheby's",     value: 'sothebys',       flag: '🇬🇧' },
  { label: "Christie's",    value: 'christies',      flag: '🇬🇧' },
  { label: 'Bonhams',       value: 'bonhams',        flag: '🇬🇧' },
  { label: 'Other',         value: 'other',          flag: '🌐' },
];

const MARKET_COUNTRIES = [
  { label: 'France',   value: 'FR', flag: '🇫🇷' },
  { label: 'UK',       value: 'GB', flag: '🇬🇧' },
  { label: 'USA',      value: 'US', flag: '🇺🇸' },
  { label: 'Germany',  value: 'DE', flag: '🇩🇪' },
  { label: 'Italy',    value: 'IT', flag: '🇮🇹' },
  { label: 'Other',    value: 'other', flag: '🌐' },
];

const ARTIST_RATINGS = [
  { value: 'all',         label: 'All artists'  },
  { value: 'emerging',    label: 'Emerging'     },
  { value: 'established', label: 'Established'  },
  { value: 'blue_chip',   label: 'Blue Chip'    },
];

const AUCTION_TIMING = [
  { value: 'all',   label: 'Any date'     },
  { value: '24h',   label: 'Ending in 24h' },
  { value: 'week',  label: 'This week'    },
  { value: 'month', label: 'This month'   },
];

const MARKET_SORT = [
  { value: 'auction_date_asc', label: 'Ending soonest' },
  { value: 'estimate_asc',     label: 'Estimate: low → high' },
  { value: 'estimate_desc',    label: 'Estimate: high → low' },
  { value: 'created_at_desc',  label: 'Recently added' },
];

const ALPHA_SORT = [
  { value: 'deal_score_desc',  label: 'Best score first' },
  { value: 'upside_desc',      label: 'Highest upside %' },
  { value: 'auction_date_asc', label: 'Ending soonest' },
  { value: 'price_asc',        label: 'Price: low → high' },
  { value: 'created_at_desc',  label: 'Recently detected' },
];

const ALPHA_PLATFORMS = ['Drouot', 'Interenchères', "Christie's", "Sotheby's", 'Invaluable'];

const SIZE_CHIPS = [
  { label: 'Small',  value: 'small',  sub: '< 40cm' },
  { label: 'Medium', value: 'medium', sub: '40–100cm' },
  { label: 'Large',  value: 'large',  sub: '> 100cm' },
];

const UPSIDE_OPTIONS = [
  { value: 'all', label: 'Any upside' },
  { value: '10',  label: '+10% and above' },
  { value: '20',  label: '+20% and above' },
  { value: '33',  label: '+33% and above' },
  { value: '50',  label: '+50% and above' },
];

const PRICE_CHIPS = [
  { label: '< €1K',      min: 0,      max: 1000   },
  { label: '€1K–10K',   min: 1000,   max: 10000  },
  { label: '€10K–50K',  min: 10000,  max: 50000  },
  { label: '€50K–200K', min: 50000,  max: 200000 },
  { label: '> €200K',   min: 200000, max: 0      },
];

// ── helpers ──────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0]; }
function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function addMonths(n: number) {
  const d = new Date(); d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

// ── sub-components ───────────────────────────────────────────
function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: '#888', marginBottom: '10px',
    }}>
      {children}{count ? ` (${count})` : ''}
    </div>
  );
}

function ChipBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
        border: '1px solid',
        borderColor: active ? 'var(--navy)' : '#E0DDDA',
        background: active ? 'var(--navy)' : 'white',
        color: active ? 'white' : '#555',
        borderRadius: '4px',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── main component ───────────────────────────────────────────
export function FilterSidebar({ onFilterChange, tab }: FilterSidebarProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilterChange(next);
  };

  const toggleArr = (key: keyof Filters, value: string) => {
    const arr = (filters[key] as string[]) || [];
    update({
      [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
    } as Partial<Filters>);
  };

  const setPriceChip = (min: number, max: number) => {
    const already = filters.minPrice === min && filters.maxPrice === max;
    update({ minPrice: already ? 0 : min, maxPrice: already ? 0 : max });
  };

  const isPriceActive = (min: number, max: number) =>
    filters.minPrice === min && filters.maxPrice === max;

  const sortOptions = tab === 'live' ? MARKET_SORT : ALPHA_SORT;
  const defaultSort = tab === 'live' ? 'auction_date_asc' : 'deal_score_desc';
  const activeSortBy = filters.sortBy || defaultSort;

  const activeCount =
    (filters.searchQuery ? 1 : 0) +
    (tab === 'live' ? filters.sources.length : filters.platforms.length) +
    filters.categories.length +
    filters.mediums.length +
    (filters.countries?.length > 0 ? 1 : 0) +
    (filters.scoreRange[0] > 0 ? 1 : 0) +
    (filters.upsideRange !== 'all' ? 1 : 0) +
    (filters.artistRating !== 'all' ? 1 : 0) +
    (filters.auctionTiming !== 'all' ? 1 : 0) +
    (filters.minPrice > 0 || filters.maxPrice > 0 ? 1 : 0) +
    (filters.auctionDateFrom ? 1 : 0) +
    (filters.artistSearch ? 1 : 0) +
    (filters.auctionHouseSearch ? 1 : 0);

  const S: React.CSSProperties = { marginBottom: '20px' };

  return (
    <div style={{ width: '280px', minWidth: '280px', padding: '20px 16px', background: '#FAFAF8' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px', paddingTop: '4px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--navy)', margin: 0 }}>
          {tab === 'live' ? 'Live Filters' : 'Alpha Filters'}
        </h3>
        {activeCount > 0 && (
          <button
            onClick={() => { setFilters(DEFAULT_FILTERS); onFilterChange(DEFAULT_FILTERS); }}
            style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Reset all
          </button>
        )}
      </div>

      {/* Global search */}
      <div style={S}>
        <SectionLabel>Search</SectionLabel>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#aaa' }} />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={e => update({ searchQuery: e.target.value })}
            placeholder={tab === 'live' ? 'Title, artist, auction house…' : 'Title, artist, keyword…'}
            style={{
              width: '100%', paddingLeft: '32px', paddingRight: filters.searchQuery ? '30px' : '10px',
              paddingTop: '8px', paddingBottom: '8px',
              fontSize: '12px', border: '1px solid #E0DDDA', background: 'white',
              color: 'var(--navy)', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {filters.searchQuery && (
            <button onClick={() => update({ searchQuery: '' })} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', display: 'flex' }}>
              <X style={{ width: '12px', height: '12px' }} />
            </button>
          )}
        </div>
      </div>

      {/* Sort by */}
      <div style={S}>
        <SectionLabel>Sort by</SectionLabel>
        <select
          value={activeSortBy}
          onChange={e => update({ sortBy: e.target.value })}
          style={{
            width: '100%', padding: '8px 10px', fontSize: '12px',
            border: '1px solid #E0DDDA', background: 'white',
            color: 'var(--navy)', cursor: 'pointer', outline: 'none',
          }}
        >
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* ── LIVE TAB FILTERS ────────────────────────────── */}
      {tab === 'live' && (
        <>
          {/* Auction date */}
          <div style={S}>
            <SectionLabel>Auction date</SectionLabel>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                type="date"
                value={filters.auctionDateFrom}
                onChange={e => update({ auctionDateFrom: e.target.value })}
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px', border: '1px solid #E0DDDA', background: 'white', color: 'var(--navy)', outline: 'none' }}
              />
              <span style={{ alignSelf: 'center', color: '#aaa', fontSize: '11px' }}>→</span>
              <input
                type="date"
                value={filters.auctionDateTo}
                onChange={e => update({ auctionDateTo: e.target.value })}
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px', border: '1px solid #E0DDDA', background: 'white', color: 'var(--navy)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {[
                { label: 'Today',       from: todayStr(),  to: todayStr()    },
                { label: 'Tomorrow',    from: addDays(1),  to: addDays(1)    },
                { label: 'This week',   from: todayStr(),  to: addDays(7)    },
                { label: 'This month',  from: todayStr(),  to: addMonths(1)  },
                { label: '3 months',    from: todayStr(),  to: addMonths(3)  },
              ].map(({ label, from, to }) => (
                <ChipBtn
                  key={label}
                  active={filters.auctionDateFrom === from && filters.auctionDateTo === to}
                  onClick={() => {
                    const already = filters.auctionDateFrom === from && filters.auctionDateTo === to;
                    update({ auctionDateFrom: already ? '' : from, auctionDateTo: already ? '' : to });
                  }}
                >{label}</ChipBtn>
              ))}
            </div>
          </div>

          {/* Price / estimate */}
          <div style={S}>
            <SectionLabel>Estimate (€)</SectionLabel>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input
                type="number"
                value={filters.minPrice || ''}
                onChange={e => update({ minPrice: Number(e.target.value) || 0 })}
                placeholder="Min"
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px', border: '1px solid #E0DDDA', background: 'white', color: 'var(--navy)', outline: 'none' }}
              />
              <span style={{ alignSelf: 'center', color: '#aaa', fontSize: '11px' }}>→</span>
              <input
                type="number"
                value={filters.maxPrice || ''}
                onChange={e => update({ maxPrice: Number(e.target.value) || 0 })}
                placeholder="Max"
                style={{ flex: 1, padding: '6px 8px', fontSize: '11px', border: '1px solid #E0DDDA', background: 'white', color: 'var(--navy)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {PRICE_CHIPS.map(({ label, min, max }) => (
                <ChipBtn key={label} active={isPriceActive(min, max)} onClick={() => setPriceChip(min, max)}>
                  {label}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Source / platform — server-side multi-select */}
          <div style={S}>
            <SectionLabel count={filters.sources.length || undefined}>Source</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {MARKET_SOURCES.map(({ label, value, flag }) => (
                <ChipBtn
                  key={value}
                  active={filters.sources.includes(value)}
                  onClick={() => toggleArr('sources', value)}
                >
                  {flag} {label}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Country */}
          <div style={S}>
            <SectionLabel count={filters.countries?.length || undefined}>Country</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {MARKET_COUNTRIES.map(({ label, value, flag }) => (
                <ChipBtn
                  key={value}
                  active={filters.countries?.includes(value) ?? false}
                  onClick={() => toggleArr('countries', value)}
                >
                  {flag} {label}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Auction house free-text */}
          <div style={S}>
            <SectionLabel>Auction house (name)</SectionLabel>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#aaa' }} />
              <input
                type="text"
                value={filters.auctionHouseSearch}
                onChange={e => update({ auctionHouseSearch: e.target.value })}
                placeholder="e.g. Hôtel Drouot, Salle 7…"
                style={{
                  width: '100%', paddingLeft: '30px', paddingRight: filters.auctionHouseSearch ? '30px' : '10px',
                  paddingTop: '8px', paddingBottom: '8px',
                  fontSize: '12px', border: '1px solid #E0DDDA', background: 'white',
                  color: 'var(--navy)', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {filters.auctionHouseSearch && (
                <button onClick={() => update({ auctionHouseSearch: '' })} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', display: 'flex' }}>
                  <X style={{ width: '12px', height: '12px' }} />
                </button>
              )}
            </div>
          </div>

          {/* Category */}
          <div style={S}>
            <SectionLabel count={filters.categories.length || undefined}>Category</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {CATEGORIES.map(cat => (
                <ChipBtn key={cat} active={filters.categories.includes(cat)} onClick={() => toggleArr('categories', cat)}>
                  {cat}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Medium */}
          <div style={S}>
            <SectionLabel count={filters.mediums.length || undefined}>Medium</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {MEDIUMS.map(m => (
                <ChipBtn key={m} active={filters.mediums.includes(m)} onClick={() => toggleArr('mediums', m)}>
                  {m}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Artist */}
          <div style={{ ...S, paddingBottom: '32px' }}>
            <SectionLabel>Artist</SectionLabel>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#aaa' }} />
              <input
                type="text"
                value={filters.artistSearch}
                onChange={e => update({ artistSearch: e.target.value })}
                placeholder="Artist name…"
                style={{
                  width: '100%', paddingLeft: '30px', paddingRight: '10px',
                  paddingTop: '8px', paddingBottom: '8px',
                  fontSize: '12px', border: '1px solid #E0DDDA', background: 'white',
                  color: 'var(--navy)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* ── ALPHA TAB FILTERS ───────────────────────────── */}
      {tab === 'alpha' && (
        <>
          {/* Deal score */}
          <div style={S}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <SectionLabel>Deal score</SectionLabel>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-serif)', color: 'var(--navy)' }}>
                {filters.scoreRange[0]}+ / 5
              </span>
            </div>
            <input
              type="range" min={0} max={5} step={1}
              value={filters.scoreRange[0]}
              onChange={e => update({ scoreRange: [parseInt(e.target.value), 5] })}
              style={{ width: '100%', accentColor: 'var(--navy)' }}
            />
            <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
              {filters.scoreRange[0] >= 4 ? 'Strong deals only' :
               filters.scoreRange[0] >= 3 ? 'Good + strong' :
               filters.scoreRange[0] >= 2 ? 'Moderate and above' :
               filters.scoreRange[0] >= 1 ? 'Low risk and above' : 'All opportunities'}
            </div>
          </div>

          {/* Upside % */}
          <div style={S}>
            <SectionLabel>Minimum upside</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {UPSIDE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => update({ upsideRange: value })}
                  style={{
                    padding: '8px 12px', fontSize: '12px', textAlign: 'left', cursor: 'pointer',
                    border: '1px solid',
                    borderColor: filters.upsideRange === value ? 'var(--navy)' : '#E0DDDA',
                    background: filters.upsideRange === value ? 'var(--navy)' : 'white',
                    color: filters.upsideRange === value ? 'white' : '#555',
                    transition: 'all 0.12s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={S}>
            <SectionLabel>Budget</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {PRICE_CHIPS.map(({ label, min, max }) => (
                <ChipBtn key={label} active={isPriceActive(min, max)} onClick={() => setPriceChip(min, max)}>
                  {label}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Category */}
          <div style={S}>
            <SectionLabel count={filters.categories.length || undefined}>Category</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {CATEGORIES.map(cat => (
                <ChipBtn key={cat} active={filters.categories.includes(cat)} onClick={() => toggleArr('categories', cat)}>
                  {cat}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Artist rating */}
          <div style={S}>
            <SectionLabel>Artist tier</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ARTIST_RATINGS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => update({ artistRating: value })}
                  style={{
                    padding: '8px 12px', fontSize: '12px', textAlign: 'left', cursor: 'pointer',
                    border: '1px solid',
                    borderColor: filters.artistRating === value ? 'var(--navy)' : '#E0DDDA',
                    background: filters.artistRating === value ? 'var(--navy)' : 'white',
                    color: filters.artistRating === value ? 'white' : '#555',
                    transition: 'all 0.12s',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Auction timing / urgency */}
          <div style={S}>
            <SectionLabel>Auction timing</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {AUCTION_TIMING.map(({ value, label }) => (
                <ChipBtn
                  key={value}
                  active={filters.auctionTiming === value}
                  onClick={() => update({ auctionTiming: value })}
                >
                  {label}
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Size */}
          <div style={S}>
            <SectionLabel count={filters.sizes.length || undefined}>Size</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {SIZE_CHIPS.map(({ label, value, sub }) => (
                <ChipBtn key={value} active={filters.sizes.includes(value)} onClick={() => toggleArr('sizes', value)}>
                  {label} <span style={{ opacity: 0.6, fontSize: '10px' }}>{sub}</span>
                </ChipBtn>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div style={{ ...S, paddingBottom: '32px' }}>
            <SectionLabel count={filters.platforms.length || undefined}>Platform</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {ALPHA_PLATFORMS.map(p => (
                <ChipBtn key={p} active={filters.platforms.includes(p)} onClick={() => toggleArr('platforms', p)}>
                  {p}
                </ChipBtn>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
