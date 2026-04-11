import { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { TrendingUp, Database, LineChart, Lock, Zap, Users } from 'lucide-react';

export default function About() {
  const [showAuthModal, setShowAuthModal] = useState(false);

  const capabilities = [
    {
      icon: Database,
      title: 'Global Data Aggregation',
      description: 'Real-time tracking across 50+ auction houses, galleries, and private sales worldwide.',
    },
    {
      icon: LineChart,
      title: 'Predictive Analytics',
      description: 'Machine learning models trained on 20+ years of market data to identify undervalued works.',
    },
    {
      icon: TrendingUp,
      title: 'Price Discovery',
      description: 'Proprietary valuation algorithms that detect mispriced artworks before the market corrects.',
    },
    {
      icon: Lock,
      title: 'Institutional-Grade Security',
      description: 'Bank-level encryption and data protection for your portfolio and investment strategies.',
    },
    {
      icon: Zap,
      title: 'Real-Time Alerts',
      description: 'Instant notifications when high-potential opportunities match your investment criteria.',
    },
    {
      icon: Users,
      title: 'Expert Network',
      description: 'Access to art advisors, market specialists, and institutional-grade research.',
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      {/* Header */}
      <header className="px-16 py-6 bg-white sticky top-0 z-40" style={{ borderBottom: '1px solid #E5E5E5' }}>
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <Logo variant="horizontal" color="dark" size={28} />
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/opportunities" className="text-[14px] text-[#666666] hover:text-[#111111] transition-colors">
              Opportunities
            </Link>
            <Link to="/pricing" className="text-[14px] text-[#666666] hover:text-[#111111] transition-colors">
              Pricing
            </Link>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-[14px] text-[#666666] hover:text-[#111111] transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="border border-[#111111] px-6 py-2 text-[13px] tracking-wide hover:bg-[#111111] hover:text-white transition-colors"
            >
              START TRIAL
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-16 py-24 max-w-[1400px] mx-auto">
        <div className="max-w-[900px]">
          <div className="inline-block border px-4 py-2 mb-8" style={{ borderColor: '#E5E5E5' }}>
            <div className="text-[11px] tracking-[0.15em] uppercase" style={{ color: '#737373' }}>
              About Nautilus
            </div>
          </div>
          <h1 className="mb-8 text-[64px] leading-[1.05]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            A New Standard for Art Investment
          </h1>
          <div className="w-24 h-px mb-12" style={{ backgroundColor: '#1A1A1A' }}></div>
          <p className="text-[22px] leading-[1.6]" style={{ color: '#4A4A4A' }}>
            Nautilus transforms how collectors and institutions invest in art by combining decades of market data with advanced analytics to identify undervalued opportunities across global auction houses and galleries.
          </p>
        </div>
      </section>

      {/* Positioning Statement */}
      <section className="px-16 py-20 bg-white">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="mb-8 text-[42px] leading-[1.15]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                The art market lacks the analytical rigor found in traditional finance.
              </h2>
              <p className="text-[17px] leading-[1.7] mb-6" style={{ color: '#666666' }}>
                While equities, bonds, and commodities benefit from sophisticated data tools, art investment has remained opaque—reliant on relationships, intuition, and incomplete information.
              </p>
              <p className="text-[17px] leading-[1.7]" style={{ color: '#666666' }}>
                Nautilus changes this by bringing institutional-grade intelligence to the art market, enabling data-driven decisions backed by rigorous analysis and predictive modeling.
              </p>
            </div>
            <div className="bg-white border p-12" style={{ borderColor: '#E5E5E5' }}>
              <div className="space-y-8">
                <div>
                  <div className="text-[48px] mb-2" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    €2.7B
                  </div>
                  <div className="text-[14px]" style={{ color: '#737373' }}>
                    Annual transaction volume analyzed
                  </div>
                </div>
                <div>
                  <div className="text-[48px] mb-2" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    50+
                  </div>
                  <div className="text-[14px]" style={{ color: '#737373' }}>
                    Global auction houses tracked
                  </div>
                </div>
                <div>
                  <div className="text-[48px] mb-2" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    20 years
                  </div>
                  <div className="text-[14px]" style={{ color: '#737373' }}>
                    Historical market data
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-16 py-24" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-[900px] mx-auto text-center">
          <div className="text-[11px] tracking-[0.15em] uppercase mb-6" style={{ color: '#737373' }}>
            Our Mission
          </div>
          <h2 className="mb-8 text-[48px] leading-[1.2]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            Democratize access to institutional-grade art market intelligence
          </h2>
          <p className="text-[18px] leading-[1.7] max-w-[700px] mx-auto" style={{ color: '#666666' }}>
            We believe collectors, advisors, and institutions deserve the same analytical tools used in traditional finance—transparency, data, and actionable insights to make informed investment decisions.
          </p>
        </div>
      </section>

      {/* What We Do */}
      <section className="px-16 py-24 bg-white">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <div className="text-[11px] tracking-[0.15em] uppercase mb-4" style={{ color: '#737373' }}>
              What We Do
            </div>
            <h2 className="text-[42px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
              How Nautilus Works
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-8">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <div key={index} className="border p-8" style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAF8' }}>
                  <Icon className="w-8 h-8 mb-6" style={{ color: '#1A1A1A' }} />
                  <h3 className="mb-4 text-[20px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    {capability.title}
                  </h3>
                  <p className="text-[15px] leading-[1.6]" style={{ color: '#666666' }}>
                    {capability.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="px-16 py-24" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <div className="text-[11px] tracking-[0.15em] uppercase mb-4" style={{ color: '#737373' }}>
              Who It's For
            </div>
            <h2 className="text-[42px] max-w-[700px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
              Built for serious collectors and institutional investors
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-12">
            <div className="bg-white border p-10" style={{ borderColor: '#E5E5E5' }}>
              <h3 className="mb-4 text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                Private Collectors
              </h3>
              <p className="text-[16px] leading-[1.7] mb-6" style={{ color: '#666666' }}>
                UHNW individuals and emerging collectors seeking data-driven insights to build and optimize their art portfolios with confidence.
              </p>
              <ul className="space-y-3">
                {[
                  'Identify undervalued artworks before market correction',
                  'Track portfolio value in real-time',
                  'Receive sell timing recommendations',
                  'Access institutional-grade research',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#1A1A1A' }}></div>
                    <span className="text-[15px]" style={{ color: '#666666' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border p-10" style={{ borderColor: '#E5E5E5' }}>
              <h3 className="mb-4 text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                Institutional Investors
              </h3>
              <p className="text-[16px] leading-[1.7] mb-6" style={{ color: '#666666' }}>
                Family offices, art funds, and advisors who require sophisticated analytics and portfolio management tools.
              </p>
              <ul className="space-y-3">
                {[
                  'Multi-portfolio tracking and reporting',
                  'Custom alerts for investment criteria',
                  'API access for systems integration',
                  'Dedicated account management',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#1A1A1A' }}></div>
                    <span className="text-[15px]" style={{ color: '#666666' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technology */}
      <section className="px-16 py-24 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-5 gap-12 items-center">
            <div className="col-span-2">
              <div className="text-[11px] tracking-[0.15em] uppercase mb-6" style={{ color: '#737373' }}>
                Technology
              </div>
              <h2 className="mb-6 text-[42px] leading-[1.15]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                Powered by advanced analytics
              </h2>
              <p className="text-[16px] leading-[1.7]" style={{ color: '#666666' }}>
                Our proprietary algorithms analyze millions of data points—auction results, gallery sales, artist trajectories, exhibition history, and market sentiment—to detect patterns invisible to traditional analysis.
              </p>
            </div>
            <div className="col-span-3 border p-10 space-y-6" style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAF8' }}>
              {[
                { label: 'Machine Learning Models', value: 'Trained on 20+ years of data' },
                { label: 'Data Sources', value: '50+ auction houses & galleries' },
                { label: 'Update Frequency', value: 'Real-time market tracking' },
                { label: 'Artist Database', value: '100,000+ contemporary artists' },
                { label: 'Artwork Records', value: '2M+ auction results analyzed' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between pb-6" style={{ borderBottom: i < 4 ? '1px solid #E5E5E5' : 'none' }}>
                  <div className="text-[14px]" style={{ color: '#737373' }}>
                    {item.label}
                  </div>
                  <div className="text-[15px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-16 py-32 text-center" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-[800px] mx-auto">
          <h2 className="mb-6 text-[48px] leading-[1.15]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            Start investing smarter today
          </h2>
          <p className="text-[18px] mb-12" style={{ color: '#666666' }}>
            Join collectors and institutions using data to make better art investment decisions.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-[#111111] text-white px-10 py-4 text-[13px] tracking-[0.1em] hover:bg-[#1A2A44] transition-colors"
            >
              START 5-DAY TRIAL
            </button>
            <Link
              to="/pricing"
              className="border border-[#111111] px-10 py-4 text-[13px] tracking-[0.1em] hover:bg-[#111111] hover:text-white transition-colors"
            >
              VIEW PRICING
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-16 py-12 bg-white">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex items-center justify-between" style={{ borderTop: '1px solid #E5E5E5', paddingTop: '3rem' }}>
            <Logo variant="horizontal" color="dark" size={24} />
            <div className="flex items-center gap-8 text-[14px]" style={{ color: '#666666' }}>
              <Link to="/" className="hover:text-[#111111] transition-colors">Home</Link>
              <Link to="/opportunities" className="hover:text-[#111111] transition-colors">Opportunities</Link>
              <Link to="/pricing" className="hover:text-[#111111] transition-colors">Pricing</Link>
              <Link to="/about" className="hover:text-[#111111] transition-colors">About</Link>
            </div>
            <div className="text-[13px]" style={{ color: '#666666' }}>
              © 2026 Nautilus. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowAuthModal(false)}>
          <div className="bg-white w-full max-w-[1200px] grid grid-cols-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-16">
              <div className="max-w-[400px]">
                <h2 className="mb-2 text-[32px]" style={{ fontFamily: 'var(--font-serif)' }}>
                  Start Your Free Trial
                </h2>
                <p className="text-[15px] text-[#666666] mb-12">
                  7 days free. No credit card required.
                </p>

                <form className="space-y-6">
                  <div>
                    <label className="block text-[13px] text-[#666666] mb-2 tracking-wide uppercase">Full Name</label>
                    <input
                      type="text"
                      className="w-full border border-[#EAEAEA] px-4 py-3 text-[15px] focus:outline-none focus:border-[#111111] transition-colors"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#666666] mb-2 tracking-wide uppercase">Email</label>
                    <input
                      type="email"
                      className="w-full border border-[#EAEAEA] px-4 py-3 text-[15px] focus:outline-none focus:border-[#111111] transition-colors"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[#666666] mb-2 tracking-wide uppercase">Password</label>
                    <input
                      type="password"
                      className="w-full border border-[#EAEAEA] px-4 py-3 text-[15px] focus:outline-none focus:border-[#111111] transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#111111] text-white py-4 text-[14px] tracking-wide hover:bg-[#1A2A44] transition-colors"
                  >
                    START FREE TRIAL
                  </button>
                </form>

                <div className="mt-8 text-center">
                  <p className="text-[14px] text-[#666666]">
                    Already have an account?{' '}
                    <button className="text-[#111111] hover:underline">
                      Log in
                    </button>
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1720727226875-44a17a151320?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                alt="Art"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-8 right-8 w-10 h-10 bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
              >
                <span className="text-[20px]">×</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
