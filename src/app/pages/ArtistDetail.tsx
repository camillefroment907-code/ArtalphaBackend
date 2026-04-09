import { useParams, useNavigate, Link } from 'react-router';
import { OpportunityCard } from '../components/OpportunityCard';
import { mockArtists, mockArtworks } from '../data/mockData';

export default function ArtistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const artist = mockArtists.find(a => a.id === id);

  if (!artist) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
            Artist not found
          </h2>
          <Link to="/artists" className="text-[#666666] hover:text-[#111111]">
            ← Back to Artists
          </Link>
        </div>
      </div>
    );
  }

  const artistArtworks = mockArtworks.filter(a => a.artistName === artist.name);
  const priceHistory = [
    { year: '2020', price: 52000 },
    { year: '2021', price: 58000 },
    { year: '2022', price: 61000 },
    { year: '2023', price: 65000 },
    { year: '2024', price: 68000 },
    { year: '2025', price: parseFloat(artist.averagePrice.replace(/[€,]/g, '')) },
  ];
  const maxPrice = Math.max(...priceHistory.map(p => p.price));

  return (
    <div className="min-h-screen bg-white">
      <div className="px-16 py-12">
        <button
          onClick={() => navigate('/artists')}
          className="mb-8 text-[#666666] hover:text-[#111111] transition-colors"
        >
          ← Back to Artists
        </button>

        <div className="max-w-[1600px] mx-auto">
          <div className="flex gap-16 mb-20">
            {/* Left: Artist Info */}
            <div className="flex-[0_0_35%]">
              <div className="aspect-[3/4] overflow-hidden border border-[#EAEAEA] mb-8">
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <h1 className="mb-4 text-[36px]" style={{ fontFamily: 'var(--font-serif)' }}>
                {artist.name}
              </h1>

              <div className="mb-8">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Nationality</div>
                    <div className="text-[15px]">{artist.nationality}</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Born</div>
                    <div className="text-[15px]">{artist.birthYear}</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Movement</div>
                    <div className="text-[15px]">{artist.movement}</div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Liquidity</div>
                    <div className="text-[15px]">{artist.liquidity}</div>
                  </div>
                </div>

                <div className="text-[15px] leading-relaxed text-[#111111] mb-8">
                  {artist.description}
                </div>
              </div>

              <div className="border-t border-[#EAEAEA] pt-8">
                <div className="text-[13px] tracking-wide uppercase text-[#666666] mb-6">
                  Market Data
                </div>
                <div className="space-y-6">
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Average Price</div>
                    <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {artist.averagePrice}
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Record Price</div>
                    <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {artist.recordPrice}
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Market Trend</div>
                    <div className="text-[24px] text-[#1A2A44]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {artist.marketTrend} YoY
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Total Sales</div>
                    <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {artist.totalSales}
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] text-[#666666] mb-1">Price per cm²</div>
                    <div className="text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
                      {artist.pricePerCm2}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Price Chart */}
            <div className="flex-1">
              <div className="mb-12">
                <h3 className="mb-6 text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
                  Price Evolution
                </h3>
                <div className="border border-[#EAEAEA] p-12">
                  <div className="flex items-end justify-between h-[300px]">
                    {priceHistory.map((item, index) => (
                      <div key={item.year} className="flex flex-col items-center flex-1">
                        <div className="w-full flex flex-col items-center justify-end h-full pb-4">
                          <div className="text-[13px] text-[#666666] mb-2">
                            {(item.price / 1000).toFixed(0)}k
                          </div>
                          <div
                            className="w-12 bg-[#1A2A44] transition-all"
                            style={{
                              height: `${(item.price / maxPrice) * 100}%`,
                            }}
                          />
                        </div>
                        <div className="text-[13px] text-[#666666] mt-4">{item.year}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-6 text-[24px]" style={{ fontFamily: 'var(--font-serif)' }}>
                  Current Opportunities
                </h3>
                {artistArtworks.length > 0 ? (
                  <div className="grid grid-cols-2 gap-12">
                    {artistArtworks.map((artwork) => (
                      <div key={artwork.id} onClick={() => navigate(`/opportunities/${artwork.id}`)}>
                        <OpportunityCard
                          {...artwork}
                          onClick={() => {}}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-[#EAEAEA] p-12 text-center text-[#666666]">
                    No current opportunities available for this artist
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
