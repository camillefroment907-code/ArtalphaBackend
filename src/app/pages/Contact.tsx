import { useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Logo';
import { Mail } from 'lucide-react';

export default function Contact() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log('Form submitted:', formData);
  };

  const contactEmails = [
    {
      label: 'General Inquiries',
      email: 'contact@artalpha.com',
      description: 'Questions about the platform, features, or membership',
    },
    {
      label: 'Partnerships',
      email: 'partnerships@artalpha.com',
      description: 'Institutional partnerships, galleries, and auction houses',
    },
    {
      label: 'Investors',
      email: 'investors@artalpha.com',
      description: 'Investment opportunities and corporate information',
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
            <Link to="/about" className="text-[14px] text-[#666666] hover:text-[#111111] transition-colors">
              About
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
      <section className="px-16 py-24 max-w-[1000px] mx-auto text-center">
        <div className="inline-block border px-4 py-2 mb-8" style={{ borderColor: '#E5E5E5' }}>
          <div className="text-[11px] tracking-[0.15em] uppercase" style={{ color: '#737373' }}>
            Contact
          </div>
        </div>
        <h1 className="mb-8 text-[64px] leading-[1.05]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
          Get in touch with our team
        </h1>
        <div className="w-24 h-px mb-12 mx-auto" style={{ backgroundColor: '#1A1A1A' }}></div>
        <p className="text-[18px] leading-[1.7] max-w-[600px] mx-auto" style={{ color: '#666666' }}>
          Whether you're exploring membership, have questions about our platform, or seeking institutional partnerships, we're here to help.
        </p>
      </section>

      {/* Contact Form & Direct Contact */}
      <section className="px-16 py-20">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-5 gap-16">
            {/* Contact Form - 3 columns */}
            <div className="col-span-3">
              <div className="bg-white border p-12" style={{ borderColor: '#E5E5E5' }}>
                <h2 className="mb-2 text-[32px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                  Send us a message
                </h2>
                <p className="text-[15px] mb-10" style={{ color: '#666666' }}>
                  We typically respond within 24 hours
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-[13px] mb-3 tracking-[0.05em] uppercase" style={{ color: '#737373' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#111111] transition-colors"
                      style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAF8' }}
                      placeholder="John Smith"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] mb-3 tracking-[0.05em] uppercase" style={{ color: '#737373' }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#111111] transition-colors"
                      style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAF8' }}
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] mb-3 tracking-[0.05em] uppercase" style={{ color: '#737373' }}>
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={8}
                      className="w-full border px-4 py-3.5 text-[15px] focus:outline-none focus:border-[#111111] transition-colors resize-none"
                      style={{ borderColor: '#E5E5E5', backgroundColor: '#FAFAF8' }}
                      placeholder="Tell us how we can help you..."
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#111111] text-white py-4 text-[13px] tracking-[0.1em] hover:bg-[#000000] transition-colors"
                  >
                    SEND MESSAGE
                  </button>
                </form>
              </div>
            </div>

            {/* Direct Contact - 2 columns */}
            <div className="col-span-2">
              <div className="mb-8">
                <h3 className="mb-6 text-[24px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                  Direct Contact
                </h3>
                <p className="text-[15px] leading-[1.7]" style={{ color: '#666666' }}>
                  For specific inquiries, you can reach us directly at the following addresses.
                </p>
              </div>

              <div className="space-y-6">
                {contactEmails.map((contact, index) => (
                  <div
                    key={index}
                    className="bg-white border p-6"
                    style={{ borderColor: '#E5E5E5' }}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Mail className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: '#737373' }} />
                      <div className="flex-1">
                        <div className="text-[13px] mb-2 tracking-[0.05em] uppercase" style={{ color: '#737373' }}>
                          {contact.label}
                        </div>
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-[16px] hover:underline block mb-2"
                          style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}
                        >
                          {contact.email}
                        </a>
                        <p className="text-[13px] leading-[1.6]" style={{ color: '#999999' }}>
                          {contact.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Information */}
      <section className="px-16 py-20 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-3 gap-12">
            <div className="border-l pl-6" style={{ borderColor: '#E5E5E5' }}>
              <h3 className="mb-4 text-[20px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                Office Hours
              </h3>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: '#666666' }}>
                Monday – Friday
              </p>
              <p className="text-[15px] leading-[1.7]" style={{ color: '#666666' }}>
                9:00 AM – 6:00 PM CET
              </p>
            </div>

            <div className="border-l pl-6" style={{ borderColor: '#E5E5E5' }}>
              <h3 className="mb-4 text-[20px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                Response Time
              </h3>
              <p className="text-[15px] leading-[1.7]" style={{ color: '#666666' }}>
                We aim to respond to all inquiries within 24 hours during business days.
              </p>
            </div>

            <div className="border-l pl-6" style={{ borderColor: '#E5E5E5' }}>
              <h3 className="mb-4 text-[20px]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
                Support
              </h3>
              <p className="text-[15px] leading-[1.7]" style={{ color: '#666666' }}>
                Members have access to dedicated account managers and priority support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-16 py-24 text-center" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-[700px] mx-auto">
          <h2 className="mb-6 text-[42px] leading-[1.15]" style={{ fontFamily: 'var(--font-serif)', color: '#1A1A1A' }}>
            Ready to get started?
          </h2>
          <p className="text-[17px] mb-10" style={{ color: '#666666' }}>
            Join collectors and institutions using data to invest smarter
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-[#111111] text-white px-10 py-4 text-[13px] tracking-[0.1em] hover:bg-[#000000] transition-colors"
          >
            START 5-DAY TRIAL
          </button>
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
              <Link to="/contact" className="hover:text-[#111111] transition-colors">Contact</Link>
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
