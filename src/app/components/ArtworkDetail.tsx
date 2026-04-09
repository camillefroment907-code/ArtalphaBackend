import { ScoreBadge } from './ScoreBadge';

interface ArtworkDetailProps {
  artwork: {
    id: string;
    imageUrl: string;
    artistName: string;
    title: string;
    price: string;
    estimatedValue: string;
    upside: string;
    score: number;
    technique: string;
    dimensions: string;
    platform: string;
    rationale: string;
    pricePerCm2: string;
    comparables: Array<{
      title: string;
      price: string;
      date: string;
    }>;
  };
  onClose: () => void;
}

export function ArtworkDetail({ artwork, onClose }: ArtworkDetailProps) {
  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      <div className="max-w-[1600px] mx-auto px-16 py-12">
        <button
          onClick={onClose}
          className="mb-8 text-[#666666] hover:text-[#111111] transition-colors"
        >
          ← Back to opportunities
        </button>

        <div className="flex gap-16">
          <div className="flex-[0_0_70%]">
            <div className="border border-[#EAEAEA]">
              <img
                src={artwork.imageUrl}
                alt={`${artwork.artistName} - ${artwork.title}`}
                className="w-full h-auto"
              />
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-8">
              <div className="text-[13px] tracking-wide uppercase text-[#666666] mb-2">
                {artwork.platform}
              </div>
              <h1 className="mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
                {artwork.artistName}
              </h1>
              <div className="text-[#666666] mb-6" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                {artwork.title}
              </div>
              <div className="flex items-center gap-4 mb-6">
                <ScoreBadge score={artwork.score} />
                <span className="text-[13px] text-[#666666]">Opportunity Score</span>
              </div>
            </div>

            <div className="border-t border-[#EAEAEA] pt-6 mb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[13px] text-[#666666] mb-1">Technique</div>
                  <div className="text-[15px]">{artwork.technique}</div>
                </div>
                <div>
                  <div className="text-[13px] text-[#666666] mb-1">Dimensions</div>
                  <div className="text-[15px]">{artwork.dimensions}</div>
                </div>
                <div>
                  <div className="text-[13px] text-[#666666] mb-1">Current Price</div>
                  <div className="text-[15px]">{artwork.price}</div>
                </div>
                <div>
                  <div className="text-[13px] text-[#666666] mb-1">Estimated Value</div>
                  <div className="text-[15px]">{artwork.estimatedValue}</div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-[#EAEAEA]">
                <div className="text-[24px] text-[#1A2A44]" style={{ fontFamily: 'var(--font-serif)' }}>
                  +{artwork.upside} upside potential
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="text-[13px] tracking-wide uppercase text-[#666666] mb-3">
                Investment Rationale
              </div>
              <div className="text-[15px] leading-relaxed text-[#111111]">
                {artwork.rationale}
              </div>
            </div>

            <div className="border-t border-[#EAEAEA] pt-6">
              <div className="text-[13px] tracking-wide uppercase text-[#666666] mb-4">
                Market Data
              </div>
              <div className="mb-6">
                <div className="text-[13px] text-[#666666] mb-1">Price per cm²</div>
                <div className="text-[15px]">{artwork.pricePerCm2}</div>
              </div>
              <div>
                <div className="text-[13px] text-[#666666] mb-3">Comparable Sales</div>
                <div className="space-y-3">
                  {artwork.comparables.map((comp, index) => (
                    <div key={index} className="flex justify-between text-[14px] pb-3 border-b border-[#EAEAEA] last:border-0">
                      <span className="text-[#111111]">{comp.title}</span>
                      <span className="text-[#666666]">{comp.price}</span>
                      <span className="text-[#666666]">{comp.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              className="mt-10 w-full border border-[#111111] bg-[#111111] text-white py-4 px-8 hover:bg-white hover:text-[#111111] transition-colors"
            >
              Request Investment Memo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
