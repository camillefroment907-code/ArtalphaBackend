import { Lock } from 'lucide-react';
import { Artwork } from '../data/mockData';

interface LockedOpportunityCardProps {
  artwork: Artwork;
  onClick: () => void;
}

export function LockedOpportunityCard({ artwork, onClick }: LockedOpportunityCardProps) {
  return (
    <div className="cursor-pointer group" onClick={onClick}>
      <div className="relative aspect-[3/4] overflow-hidden mb-4" style={{ backgroundColor: '#F5F5F5' }}>
        {/* Blurred Image */}
        <img
          src={artwork.imageUrl}
          alt={artwork.title}
          className="w-full h-full object-cover"
          style={{ filter: 'blur(12px)' }}
        />
        
        {/* Overlay */}
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center transition-opacity"
          style={{ backgroundColor: 'rgba(250, 250, 248, 0.92)' }}
        >
          <div 
            className="w-12 h-12 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5' }}
          >
            <Lock className="w-5 h-5" style={{ color: '#1A1A1A' }} />
          </div>
          <div className="text-[13px] tracking-[0.15em] uppercase" style={{ color: '#737373' }}>
            Members Only
          </div>
        </div>
      </div>

      {/* Blurred Info */}
      <div style={{ filter: 'blur(4px)' }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-[18px] mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              {artwork.title}
            </div>
            <div className="text-[14px] text-[#666666]">{artwork.artist}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-[14px]">
          <div className="text-[#666666]">{artwork.year}</div>
          <div className="text-[#666666]">•</div>
          <div className="text-[#666666]">{artwork.medium}</div>
        </div>

        <div className="flex items-center justify-between py-4" style={{ borderTop: '1px solid #F5F5F5' }}>
          <div>
            <div className="text-[11px] text-[#999999] tracking-wide uppercase mb-1">
              Current Price
            </div>
            <div className="text-[20px]" style={{ fontFamily: 'var(--font-serif)' }}>
              {artwork.currentPrice}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
