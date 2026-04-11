import { Logo, LogoIcon } from '../components/Logo';

export default function BrandShowcase() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-16 py-20">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-20">
            <h1 className="mb-4 text-[42px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Nautilus Brand System
            </h1>
            <p className="text-[18px] text-[#666666]">
              Logo variations and usage guidelines
            </p>
          </div>

          {/* Full Logo */}
          <section className="mb-20 border-b border-[#EAEAEA] pb-20">
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Primary Logo
            </h2>
            <div className="grid grid-cols-3 gap-12">
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[300px]">
                <Logo variant="full" color="dark" size={80} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[300px] bg-[#1C2B24]">
                <Logo variant="full" color="white" size={80} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[300px]">
                <Logo variant="full" color="gold" size={80} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-12 mt-4 text-center text-[13px] text-[#666666]">
              <div>Dark on White (Primary)</div>
              <div>White on Dark</div>
              <div>Gold Accent</div>
            </div>
          </section>

          {/* Horizontal Logo */}
          <section className="mb-20 border-b border-[#EAEAEA] pb-20">
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Horizontal Logo
            </h2>
            <div className="grid grid-cols-3 gap-12">
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px]">
                <Logo variant="horizontal" color="dark" size={40} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px] bg-[#1C2B24]">
                <Logo variant="horizontal" color="white" size={40} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px]">
                <Logo variant="horizontal" color="gold" size={40} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-12 mt-4 text-center text-[13px] text-[#666666]">
              <div>Navigation & Headers</div>
              <div>Dark Backgrounds</div>
              <div>Premium Contexts</div>
            </div>
          </section>

          {/* Monogram */}
          <section className="mb-20 border-b border-[#EAEAEA] pb-20">
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Monogram
            </h2>
            <div className="grid grid-cols-4 gap-12">
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px]">
                <Logo variant="monogram" color="dark" size={60} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px] bg-[#1C2B24]">
                <Logo variant="monogram" color="white" size={60} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px]">
                <Logo variant="monogram" color="gold" size={60} />
              </div>
              <div className="border border-[#EAEAEA] p-12 flex items-center justify-center min-h-[200px] bg-[#f8f8f8]">
                <Logo variant="monogram" color="dark" size={60} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-12 mt-4 text-center text-[13px] text-[#666666]">
              <div>Social Media</div>
              <div>Dark Mode</div>
              <div>Premium Badge</div>
              <div>App Icon</div>
            </div>
          </section>

          {/* Icon/Favicon */}
          <section className="mb-20 border-b border-[#EAEAEA] pb-20">
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Icon & Favicon
            </h2>
            <div className="grid grid-cols-5 gap-8">
              <div className="border border-[#EAEAEA] p-8 flex items-center justify-center aspect-square">
                <LogoIcon color="dark" size={64} />
              </div>
              <div className="border border-[#EAEAEA] p-8 flex items-center justify-center aspect-square bg-[#1C2B24]">
                <LogoIcon color="white" size={64} />
              </div>
              <div className="border border-[#EAEAEA] p-8 flex items-center justify-center aspect-square">
                <LogoIcon color="dark" size={48} />
              </div>
              <div className="border border-[#EAEAEA] p-8 flex items-center justify-center aspect-square">
                <LogoIcon color="dark" size={32} />
              </div>
              <div className="border border-[#EAEAEA] p-8 flex items-center justify-center aspect-square">
                <LogoIcon color="dark" size={16} />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-8 mt-4 text-center text-[13px] text-[#666666]">
              <div>64px</div>
              <div>Dark BG</div>
              <div>48px</div>
              <div>32px</div>
              <div>16px</div>
            </div>
          </section>

          {/* Color Palette */}
          <section className="mb-20 border-b border-[#EAEAEA] pb-20">
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Brand Colors
            </h2>
            <div className="grid grid-cols-3 gap-12">
              <div>
                <div className="aspect-square bg-[#1C2B24] border border-[#EAEAEA] mb-4"></div>
                <div className="text-[15px] mb-1">Deep Green</div>
                <div className="text-[13px] text-[#666666] font-mono">#1C2B24</div>
                <div className="text-[13px] text-[#666666] mt-2">Primary brand color</div>
              </div>
              <div>
                <div className="aspect-square bg-[#A38B4A] border border-[#EAEAEA] mb-4"></div>
                <div className="text-[15px] mb-1">Muted Gold</div>
                <div className="text-[13px] text-[#666666] font-mono">#A38B4A</div>
                <div className="text-[13px] text-[#666666] mt-2">Premium accent</div>
              </div>
              <div>
                <div className="aspect-square bg-[#FFFFFF] border border-[#EAEAEA] mb-4"></div>
                <div className="text-[15px] mb-1">White</div>
                <div className="text-[13px] text-[#666666] font-mono">#FFFFFF</div>
                <div className="text-[13px] text-[#666666] mt-2">Background, purity</div>
              </div>
            </div>
          </section>

          {/* Typography */}
          <section className="mb-20">
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Typography
            </h2>
            <div className="grid grid-cols-2 gap-12">
              <div className="border border-[#EAEAEA] p-12">
                <div className="text-[13px] text-[#666666] tracking-wide uppercase mb-4">Display / Serif</div>
                <div className="text-[48px] mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
                  Nautilus
                </div>
                <div className="text-[15px] text-[#666666]">
                  Cormorant Garamond<br />
                  Logo, headings, elegant moments
                </div>
              </div>
              <div className="border border-[#EAEAEA] p-12">
                <div className="text-[13px] text-[#666666] tracking-wide uppercase mb-4">Body / Sans</div>
                <div className="text-[32px] mb-4">
                  Nautilus
                </div>
                <div className="text-[15px] text-[#666666]">
                  Inter<br />
                  Body text, UI, data
                </div>
              </div>
            </div>
          </section>

          {/* Usage Guidelines */}
          <section>
            <h2 className="mb-8 text-[28px]" style={{ fontFamily: 'var(--font-serif)' }}>
              Usage Guidelines
            </h2>
            <div className="grid grid-cols-2 gap-8">
              <div className="border border-[#EAEAEA] p-8">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-6 h-6 text-[#1A2A44]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="text-[18px]" style={{ fontFamily: 'var(--font-serif)' }}>Do</div>
                </div>
                <ul className="space-y-3 text-[15px] text-[#666666]">
                  <li>• Maintain clear space around logo</li>
                  <li>• Use approved color variations</li>
                  <li>• Keep proportions intact</li>
                  <li>• Use horizontal version for headers</li>
                  <li>• Ensure minimum size of 24px height</li>
                </ul>
              </div>
              <div className="border border-[#EAEAEA] p-8">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-6 h-6 text-[#d4183d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <div className="text-[18px]" style={{ fontFamily: 'var(--font-serif)' }}>Don't</div>
                </div>
                <ul className="space-y-3 text-[15px] text-[#666666]">
                  <li>• Rotate or skew the logo</li>
                  <li>• Add gradients or effects</li>
                  <li>• Change colors outside palette</li>
                  <li>• Stretch or distort proportions</li>
                  <li>• Place on busy backgrounds</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
