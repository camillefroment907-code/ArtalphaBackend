import { Link } from 'react-router';
import { useState } from 'react';
import { OpportunityCard } from '../components/OpportunityCard';
import { mockArtworks, mockArtists } from '../data/mockData';

export default function Home() {
  const [heroIndex] = useState(0);
  const heroArtwork = mockArtworks[heroIndex];
  const topOpportunities = mockArtworks.slice(0, 4);
  const trendingArtists = mockArtists.slice(0, 3);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative h-[75vh] overflow-hidden">
        <img
          src={heroArtwork.imageUrl}
          alt={`${heroArtwork.artistName} - ${heroArtwork.title}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-16">
          <div className="max-w-[800px]">
            <div className="text-white/80 text-[13px] tracking-wide uppercase mb-3">
              Featured Opportunity
            </div>
            <h2 className="text-white mb-2 text-[36px]" style={{ fontFamily: 'var(--font-serif)' }}>
              {heroArtwork.artistName}
            </h2>
            <div className="text-white/90 mb-6 text-[20px]" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
              {heroArtwork.title}
            </div>
            <div className="flex items-center gap-8 mb-8">
              <div>
                <div className="text-white/70 text-[13px] mb-1">Current Price</div>
                <div className="text-white text-[18px]">{heroArtwork.price}</div>
              </div>
              <div>
                <div className="text-white/70 text-[13px] mb-1">Estimated Value</div>
                <div className="text-white text-[18px]">{heroArtwork.estimatedValue}</div>
              </div>
              <div>
                <div className="text-white/70 text-[13px] mb-1">Upside</div>
                <div className="text-white text-[18px]">+{heroArtwork.upside}</div>
              </div>
            </div>
            <Link
              to={`/opportunities/${heroArtwork.id}`}
              className="inline-block border border-white bg-white text-[#111111] px-8 py-3 text-[13px] tracking-wide hover:bg-transparent hover:text-white transition-colors"
            >
              VIEW OPPORTUNITY
            </Link>
          </div>
        </div>
      </section>

      {/* Top Opportunities Section */}
      <section className="px-16 py-20 border-b border-[#EAEAEA]">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="mb-2 text-[32px]" style={{ fontFamily: 'var(--font-serif)' }}>
                Top Opportunities
              </h2>
              <div className="text-[#666666]">
                Highest value artworks detected this week
              </div>
            </div>
            <Link
              to="/opportunities"
              className="text-[13px] border border-[#111111] px-6 py-2 tracking-wide hover:bg-[#111111] hover:text-white transition-colors"
            >
              VIEW ALL
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-x-8 gap-y-12">
            {topOpportunities.map((artwork) => (
              <Link key={artwork.id} to={`/opportunities/${artwork.id}`} className="block">
                <OpportunityCard
                  {...artwork}
                  onClick={() => {}}
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Artists Section */}
      <section className="px-16 py-20 border-b border-[#EAEAEA]">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="mb-2 text-[32px]" style={{ fontFamily: 'var(--font-serif)' }}>
                Trending Artists
              </h2>
              <div className="text-[#666666]">
                Rising valuations and market momentum
              </div>
            </div>
            <Link
              to="/artists"
              className="text-[13px] border border-[#111111] px-6 py-2 tracking-wide hover:bg-[#111111] hover:text-white transition-colors"
            >
              VIEW ALL
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-12">
            {trendingArtists.map((artist) => (
              <Link key={artist.id} to={`/artists/${artist.id}`} className="group">
                <div className="aspect-[3/4] overflow-hidden border border-[#EAEAEA] mb-6">
                  <img
                    src={artist.imageUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="text-[20px] mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                  {artist.name}
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#666666] text-[14px]">{artist.movement}</span>
                  <span className="text-[#1A2A44] text-[14px]">{artist.marketTrend} YoY</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#666666]">Avg: {artist.averagePrice}</span>
                  <span className="text-[#666666]">Liquidity: {artist.liquidity}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Market Snapshot Section */}
      <section className="px-16 py-20">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="mb-2 text-[32px]" style={{ fontFamily: 'var(--font-serif)' }}>
                Market Snapshot
              </h2>
              <div className="text-[#666666]">
                Real-time intelligence across platforms
              </div>
            </div>
            <Link
              to="/market"
              className="text-[13px] border border-[#111111] px-6 py-2 tracking-wide hover:bg-[#111111] hover:text-white transition-colors"
            >
              FULL ANALYSIS
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-12">
            <div className="border-l border-[#EAEAEA] pl-6">
              <div className="text-[13px] text-[#666666] tracking-wide uppercase mb-3">
                Total Opportunities
              </div>
              <div className="text-[42px] mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                {mockArtworks.length}
              </div>
              <div className="text-[13px] text-[#1A2A44]">+3 since yesterday</div>
            </div>

            <div className="border-l border-[#EAEAEA] pl-6">
              <div className="text-[13px] text-[#666666] tracking-wide uppercase mb-3">
                Average Upside
              </div>
              <div className="text-[42px] mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                57%
              </div>
              <div className="text-[13px] text-[#666666]">Across all artworks</div>
            </div>

            <div className="border-l border-[#EAEAEA] pl-6">
              <div className="text-[13px] text-[#666666] tracking-wide uppercase mb-3">
                Platforms Monitored
              </div>
              <div className="text-[42px] mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                12
              </div>
              <div className="text-[13px] text-[#666666]">Updated in real-time</div>
            </div>

            <div className="border-l border-[#EAEAEA] pl-6">
              <div className="text-[13px] text-[#666666] tracking-wide uppercase mb-3">
                Top Score Today
              </div>
              <div className="text-[42px] mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                5.0
              </div>
              <div className="text-[13px] text-[#1A2A44]">3 artworks rated</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
