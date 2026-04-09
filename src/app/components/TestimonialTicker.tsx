import { useEffect, useRef } from 'react';

interface Testimonial {
  quote: string;
  author: string;
  location: string;
}

const testimonials: Testimonial[] = [
  {
    quote: 'ArtAlpha helped me identify a work that doubled in value in 8 months.',
    author: 'Private Collector',
    location: 'London',
  },
  {
    quote: 'Finally a data-driven approach to art investing.',
    author: 'Family Office',
    location: 'Geneva',
  },
  {
    quote: 'The Bloomberg Terminal for art.',
    author: 'Art Advisor',
    location: 'New York',
  },
  {
    quote: 'Remarkable insights into market inefficiencies I would have never spotted.',
    author: 'Investment Manager',
    location: 'Hong Kong',
  },
  {
    quote: 'ArtAlpha transformed how our fund approaches art as an asset class.',
    author: 'Art Fund Director',
    location: 'Paris',
  },
  {
    quote: 'The most sophisticated art market intelligence platform available.',
    author: 'Wealth Manager',
    location: 'Singapore',
  },
];

export function TestimonialTicker() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let scrollInterval: NodeJS.Timeout;

    const startScrolling = () => {
      scrollInterval = setInterval(() => {
        if (scrollContainer) {
          scrollContainer.scrollLeft += 1;

          if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth / 2) {
            scrollContainer.scrollLeft = 0;
          }
        }
      }, 30);
    };

    startScrolling();

    return () => {
      if (scrollInterval) clearInterval(scrollInterval);
    };
  }, []);

  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <div className="relative overflow-hidden">
      <div
        ref={scrollRef}
        className="flex gap-8 overflow-x-hidden"
        style={{ scrollBehavior: 'auto' }}
      >
        {duplicatedTestimonials.map((testimonial, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-[480px] border border-[#EAEAEA] p-8"
          >
            <div className="text-[16px] leading-relaxed mb-6 text-[#111111]">
              "{testimonial.quote}"
            </div>
            <div className="text-[13px] text-[#666666]">
              — {testimonial.author}, {testimonial.location}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
