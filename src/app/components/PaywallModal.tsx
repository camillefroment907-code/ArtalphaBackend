import { X, Check, Lock } from 'lucide-react';

interface PaywallModalProps {
  onClose: () => void;
  onSubscribe: () => void;
  onUpgrade?: () => void;
  viewedCount: number;
  maxFree: number;
}

export function PaywallModal({ onClose, onSubscribe, onUpgrade, viewedCount, maxFree }: PaywallModalProps) {
  const benefits = [
    'All undervalued artworks',
    'Full investment analysis',
    'Real-time alerts',
    'Portfolio tracking',
    'Market intelligence reports',
    'Price prediction models',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(26, 26, 26, 0.75)' }}>
      <div 
        className="relative w-full max-w-[600px] overflow-hidden"
        style={{ backgroundColor: '#FAFAF8' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center hover:bg-white/50 transition-colors"
        >
          <X className="w-5 h-5" style={{ color: '#737373' }} />
        </button>

        {/* Content */}
        <div className="p-16">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div 
              className="w-16 h-16 flex items-center justify-center"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E5E5' }}
            >
              <Lock className="w-7 h-7" style={{ color: '#1A1A1A' }} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-center mb-4 text-[42px] leading-[1.1]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            Private Access Required
          </h2>

          {/* Subtitle */}
          <p className="text-center mb-10 text-[16px]" style={{ color: '#737373' }}>
            You've accessed {viewedCount} of {maxFree} free opportunity.
          </p>

          {/* Divider */}
          <div className="w-16 h-px mx-auto mb-10" style={{ backgroundColor: '#E5E5E5' }}></div>

          {/* Benefits */}
          <div className="mb-12">
            <div className="text-center text-[13px] tracking-[0.1em] uppercase mb-6" style={{ color: '#999999' }}>
              Unlock Full Access To
            </div>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-4 px-6">
                  <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center" style={{ backgroundColor: '#1A2A44' }}>
                    <Check className="w-3.5 h-3.5" style={{ color: '#FFFFFF' }} />
                  </div>
                  <span className="text-[16px]" style={{ color: '#1A1A1A' }}>
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onUpgrade ?? onSubscribe}
            className="w-full py-4 text-[14px] tracking-[0.1em] transition-colors"
            style={{ 
              backgroundColor: '#1A1A1A',
              color: '#FFFFFF',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#000000'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1A1A1A'}
          >
            UNLOCK FULL ACCESS
          </button>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-[13px]" style={{ color: '#999999' }}>
              Start your 7-day free trial
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
