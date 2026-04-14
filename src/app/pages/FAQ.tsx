import { useState } from 'react';

const FAQ_ITEMS = [
  {
    category: 'About Nautilus',
    questions: [
      {
        q: 'What is Nautilus exactly?',
        a: 'Nautilus is a market intelligence platform for art investors. We aggregate data from 10+ global auction houses and primary market platforms, then score every lot on a 0–100 scale based on price vs comparable sales, artist momentum, and market demand. Think Bloomberg Terminal — but for art.',
      },
      {
        q: 'Who is Nautilus for?',
        a: 'Nautilus is built for anyone who approaches art as an investment: individual collectors with budgets from €1,000 to €1M+, family offices allocating to alternative assets, wealth managers advising clients with art holdings, and art funds needing systematic deal flow.',
      },
      {
        q: 'Is Nautilus financial advice?',
        a: "No. Nautilus provides market intelligence and data analysis — not financial advice. Our scores and analyses are informational tools to support your own research and decision-making. Art investment carries risk, and past performance does not guarantee future results.",
      },
    ],
  },
  {
    category: 'The Score',
    questions: [
      {
        q: 'How does the Nautilus score work?',
        a: 'Every lot receives a conviction score from 0 to 100. The score combines: current price vs comparable historical sales (price gap), artist market momentum (recent auction results, gallery tier, institutional demand), lot-specific factors (medium, size, provenance, condition), and market timing signals. A score of 80+ is "Exceptional" — our highest conviction tier.',
      },
      {
        q: 'How accurate is the score?',
        a: 'Over 18 months of tracked predictions, lots scoring 65+ have shown directional accuracy (sold above estimate or appreciated) 73% of the time. Lots scoring 80+ ("Exceptional") have averaged +31% upside. Past accuracy does not guarantee future results.',
      },
      {
        q: 'Why do some lots score 86/100 while others score 45/100?',
        a: 'The score reflects the combination of undervaluation and investment quality. A lot can be underpriced (low current price vs estimate) but score low if the artist has poor liquidity or declining demand. A high score requires both a pricing gap AND strong underlying artist fundamentals.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    questions: [
      {
        q: 'What is included in the free Explorer plan?',
        a: "The free plan gives you access to 3 opportunities per day, basic deal scores, 3 messages with Larry (our AI analyst), and up to 3 portfolio items. It's designed to let you evaluate the platform before committing.",
      },
      {
        q: 'Can I upgrade or downgrade anytime?',
        a: "You can upgrade at any time and the change takes effect immediately (prorated). Downgrades on annual plans take effect at the end of your billing period — you keep your current access until then.",
      },
      {
        q: 'Is there a money-back guarantee?',
        a: "Yes. If Nautilus doesn't identify a profitable opportunity matching your profile within your first 30 days, we refund your subscription in full. No questions asked.",
      },
      {
        q: 'Do you offer institutional pricing?',
        a: 'Yes. For art funds, family offices, and institutional buyers with custom needs, contact us at contact@get-nautilus.com for tailored pricing and API access.',
      },
    ],
  },
  {
    category: 'Data & Coverage',
    questions: [
      {
        q: 'Which auction houses does Nautilus cover?',
        a: "We currently cover Christie's, Sotheby's, Phillips, Drouot, Artcurial, Invaluable, Heritage Auctions, Artsy, and several regional houses — 10+ sources in total. We add new sources regularly.",
      },
      {
        q: 'How often is data updated?',
        a: 'Our pipeline runs continuously and ingests new lots as they become available. The platform reflects the most current data available from each source, typically within hours of publication.',
      },
      {
        q: 'Does Nautilus cover the primary market (galleries)?',
        a: 'Yes, partially. We cover select primary market platforms including Artsper, Saatchi Art, and Singulart. Full gallery coverage is in development.',
      },
    ],
  },
  {
    category: 'Larry — Your AI Analyst',
    questions: [
      {
        q: 'Who is Larry?',
        a: 'Larry is your private AI art market analyst, powered by Nautilus data and GPT-4. Ask Larry about any artist, lot, market trend, or investment strategy. Larry has full access to our database and can generate investment memos, compare artists, and explain market dynamics in plain language.',
      },
      {
        q: 'What can Larry help me with?',
        a: "Larry can: analyse a specific lot and explain its score, compare two artists' market trajectories, generate a full Investment Memo for any lot, explain what's driving market sentiment in a specific segment, recommend lots matching your budget and preferences, and answer any art market question.",
      },
    ],
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
            <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="#0A1628" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="2" fill="#C6A85A"/>
          </svg>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 600, color: 'var(--navy)', letterSpacing: '0.06em' }}>Nautilus</span>
        </a>
        <a href="/app/signup" style={{ background: 'var(--electric)', color: 'white', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em' }}>
          GET ACCESS
        </a>
      </div>

      {/* Hero */}
      <div style={{ background: 'var(--navy)', padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: '#C6A85A', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
            FAQ
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: 'white', lineHeight: 1.2, marginBottom: '16px' }}>
            Frequently asked questions
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            Everything you need to know about Nautilus, the score, and how we work.
          </p>
        </div>
      </div>

      {/* FAQ content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 40px 80px' }}>
        {FAQ_ITEMS.map((section, si) => (
          <div key={section.category} style={{ marginBottom: '48px' }}>
            {/* Category header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '4px', height: '20px', background: '#C6A85A', borderRadius: '2px', flexShrink: 0 }} />
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
                {section.category}
              </h2>
            </div>

            {/* Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {section.questions.map((item, qi) => {
                const key = `${si}-${qi}`;
                const isOpen = !!open[key];
                return (
                  <div key={key} style={{ background: 'white', border: `1px solid ${isOpen ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <button
                      onClick={() => toggle(key)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '16px 20px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{item.q}</span>
                      <span style={{ fontSize: '18px', color: isOpen ? 'var(--navy)' : 'var(--text-3)', flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', lineHeight: 1 }}>+</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 20px 16px', fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.8, borderTop: '1px solid var(--border-light)' }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer CTA */}
        <div style={{ marginTop: '16px', background: 'var(--navy)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: 'white', marginBottom: '10px' }}>
            Still have questions?
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
            Our team responds within 24 hours.
          </p>
          <a href="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '11px 28px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', transition: 'background 0.15s' }}>
            Contact us →
          </a>
        </div>
      </div>
    </div>
  );
}
