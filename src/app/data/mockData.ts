export interface Artwork {
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
}

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  nationality: string;
  birthYear: string;
  movement: string;
  marketTrend: string;
  liquidity: 'Low' | 'Medium' | 'High';
  averagePrice: string;
  recordPrice: string;
  description: string;
  totalSales: number;
  pricePerCm2: string;
  yearOverYearGrowth: string;
}

export const mockArtworks: Artwork[] = [
  {
    id: '1',
    imageUrl: 'https://images.unsplash.com/photo-1763792334906-70a24d373140?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    artistName: 'Georges Mathieu',
    title: 'Composition Abstraite',
    price: '€42,000',
    estimatedValue: '€85,000',
    upside: '102%',
    score: 5,
    technique: 'Oil on canvas',
    dimensions: '146 × 114 cm',
    platform: 'Drouot',
    rationale: 'This work represents a pivotal period in Mathieu\'s career, executed during his most sought-after phase (1958-1962). Recent auction results show strong collector demand for works from this era, with comparable pieces achieving 80-120% above estimate. The provenance traces to a prominent European collection, adding significant value. Market analysis indicates undervaluation relative to recent sales of similar scale and period.',
    pricePerCm2: '€2.52',
    comparables: [
      { title: 'Les Capétiens Partout', price: '€95,000', date: 'Dec 2024' },
      { title: 'Hommage à Louis XI', price: '€78,000', date: 'Nov 2024' },
      { title: 'Bataille de Bouvines', price: '€112,000', date: 'Sep 2024' },
    ],
  },
  {
    id: '2',
    imageUrl: 'https://images.unsplash.com/photo-1771814494885-3b60f056a55a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    artistName: 'Helen Frankenthaler',
    title: 'Mountain Vista',
    price: '€125,000',
    estimatedValue: '€180,000',
    upside: '44%',
    score: 4,
    technique: 'Acrylic on canvas',
    dimensions: '183 × 244 cm',
    platform: 'Artsy',
    rationale: 'A significant color-field work from Frankenthaler\'s mature period showing her characteristic soak-stain technique. The monumental scale and vibrant palette align with current market preferences. Recent museum acquisitions of similar works validate strong institutional interest. Price point offers compelling value relative to auction benchmarks.',
    pricePerCm2: '€2.80',
    comparables: [
      { title: 'Azure Pools', price: '€165,000', date: 'Jan 2025' },
      { title: 'Canyon', price: '€195,000', date: 'Oct 2024' },
      { title: 'Western Dream', price: '€142,000', date: 'Aug 2024' },
    ],
  },
  {
    id: '3',
    imageUrl: 'https://images.unsplash.com/photo-1762718984199-b00c15f3d347?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    artistName: 'David Hockney',
    title: 'Crossed Legs Study',
    price: '€58,000',
    estimatedValue: '€95,000',
    upside: '64%',
    score: 5,
    technique: 'Lithograph on paper',
    dimensions: '91 × 61 cm',
    platform: 'Phillips',
    rationale: 'From Hockney\'s celebrated figurative series of the 1970s. This lithograph displays the artist\'s masterful draftsmanship and characteristic use of vibrant color. Edition numbers are increasingly scarce on the market, and recent sales demonstrate sustained collector appetite for works from this period. The current asking price represents a significant discount to recent auction results.',
    pricePerCm2: '€10.44',
    comparables: [
      { title: 'Two Figures', price: '€88,000', date: 'Feb 2025' },
      { title: 'Portrait Study', price: '€102,000', date: 'Dec 2024' },
      { title: 'Seated Figure', price: '€79,000', date: 'Nov 2024' },
    ],
  },
  {
    id: '4',
    imageUrl: 'https://images.unsplash.com/photo-1768692507063-ae43e2c4ecfd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    artistName: 'Anish Kapoor',
    title: 'Void Meditation',
    price: '€185,000',
    estimatedValue: '€265,000',
    upside: '43%',
    score: 4,
    technique: 'Mixed media installation',
    dimensions: '200 × 150 × 150 cm',
    platform: 'Christie\'s',
    rationale: 'A powerful example of Kapoor\'s exploration of absence and presence. The intense red pigment and void form are signature elements of his most coveted works. Growing institutional recognition in Asia presents significant upside. The work\'s exhibition history and immaculate condition support valuation.',
    pricePerCm2: '€4.11',
    comparables: [
      { title: 'Red Chamber', price: '€245,000', date: 'Mar 2025' },
      { title: 'Descent into Limbo', price: '€310,000', date: 'Jan 2025' },
      { title: 'Shadow III', price: '€225,000', date: 'Nov 2024' },
    ],
  },
  {
    id: '5',
    imageUrl: 'https://images.unsplash.com/photo-1766289496802-6a8b6977ca55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    artistName: 'Gerhard Richter',
    title: 'Abstraktes Bild',
    price: '€320,000',
    estimatedValue: '€480,000',
    upside: '50%',
    score: 5,
    technique: 'Oil on canvas',
    dimensions: '102 × 92 cm',
    platform: 'Sotheby\'s',
    rationale: 'Richter\'s abstract paintings continue to set market records. This mid-scale work displays his signature squeegee technique with exceptional color harmony. The 1990s dating places it in a highly desirable period. Private sale price represents opportunity versus comparable auction results. Strong potential for appreciation given artist\'s sustained market trajectory.',
    pricePerCm2: '€34.09',
    comparables: [
      { title: 'A.B. Still', price: '€520,000', date: 'Feb 2025' },
      { title: 'Abstraktes Bild 849-3', price: '€445,000', date: 'Dec 2024' },
      { title: 'Cage Grid', price: '€395,000', date: 'Oct 2024' },
    ],
  },
  {
    id: '6',
    imageUrl: 'https://images.unsplash.com/photo-1762928289094-197055a5d5c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    artistName: 'Ellsworth Kelly',
    title: 'White Curve',
    price: '€210,000',
    estimatedValue: '€295,000',
    upside: '40%',
    score: 4,
    technique: 'Oil on canvas',
    dimensions: '198 × 178 cm',
    platform: 'Artsy',
    rationale: 'Kelly\'s reductive geometric works are highly prized by collectors and institutions. This large-scale piece exemplifies his mature style with precise execution and commanding presence. The minimalist composition aligns with current collecting trends. Price analysis shows significant room for appreciation based on recent comparable sales.',
    pricePerCm2: '€5.96',
    comparables: [
      { title: 'Yellow Curve', price: '€285,000', date: 'Jan 2025' },
      { title: 'Red Blue', price: '€325,000', date: 'Nov 2024' },
      { title: 'Black Form', price: '€265,000', date: 'Sep 2024' },
    ],
  },
];

export const mockArtists: Artist[] = [
  {
    id: '1',
    name: 'Georges Mathieu',
    imageUrl: 'https://images.unsplash.com/photo-1763792334906-70a24d373140?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    nationality: 'French',
    birthYear: '1921',
    movement: 'Lyrical Abstraction',
    marketTrend: '+12%',
    liquidity: 'High',
    averagePrice: '€68,000',
    recordPrice: '€285,000',
    description: 'Pioneer of Lyrical Abstraction and a central figure in the European abstract expressionist movement. Known for dynamic gestural paintings created with spontaneous, calligraphic brushwork.',
    totalSales: 342,
    pricePerCm2: '€3.20',
    yearOverYearGrowth: '+18%',
  },
  {
    id: '2',
    name: 'Helen Frankenthaler',
    imageUrl: 'https://images.unsplash.com/photo-1771814494885-3b60f056a55a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    nationality: 'American',
    birthYear: '1928',
    movement: 'Color Field',
    marketTrend: '+8%',
    liquidity: 'High',
    averagePrice: '€145,000',
    recordPrice: '€2,100,000',
    description: 'Influential abstract expressionist who pioneered the soak-stain technique, creating luminous color field paintings that revolutionized post-war American art.',
    totalSales: 428,
    pricePerCm2: '€4.50',
    yearOverYearGrowth: '+11%',
  },
  {
    id: '3',
    name: 'David Hockney',
    imageUrl: 'https://images.unsplash.com/photo-1762718984199-b00c15f3d347?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    nationality: 'British',
    birthYear: '1937',
    movement: 'Pop Art',
    marketTrend: '+15%',
    liquidity: 'High',
    averagePrice: '€420,000',
    recordPrice: '€70,000,000',
    description: 'Leading figure in the Pop Art movement known for vibrant depictions of California life, innovative photographic collages, and mastery across multiple mediums.',
    totalSales: 612,
    pricePerCm2: '€12.80',
    yearOverYearGrowth: '+22%',
  },
  {
    id: '4',
    name: 'Anish Kapoor',
    imageUrl: 'https://images.unsplash.com/photo-1768692507063-ae43e2c4ecfd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    nationality: 'British-Indian',
    birthYear: '1954',
    movement: 'Contemporary',
    marketTrend: '+9%',
    liquidity: 'Medium',
    averagePrice: '€285,000',
    recordPrice: '€3,400,000',
    description: 'Contemporary sculptor exploring themes of presence and absence through monumental works. Known for reflective surfaces and intense pigments.',
    totalSales: 215,
    pricePerCm2: '€5.20',
    yearOverYearGrowth: '+14%',
  },
  {
    id: '5',
    name: 'Gerhard Richter',
    imageUrl: 'https://images.unsplash.com/photo-1766289496802-6a8b6977ca55?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    nationality: 'German',
    birthYear: '1932',
    movement: 'Contemporary',
    marketTrend: '+11%',
    liquidity: 'High',
    averagePrice: '€580,000',
    recordPrice: '€37,100,000',
    description: 'One of the most important contemporary artists, known for abstract paintings created with his signature squeegee technique and photorealistic works.',
    totalSales: 892,
    pricePerCm2: '€38.50',
    yearOverYearGrowth: '+16%',
  },
  {
    id: '6',
    name: 'Ellsworth Kelly',
    imageUrl: 'https://images.unsplash.com/photo-1762928289094-197055a5d5c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    nationality: 'American',
    birthYear: '1923',
    movement: 'Minimalism',
    marketTrend: '+7%',
    liquidity: 'Medium',
    averagePrice: '€325,000',
    recordPrice: '€4,800,000',
    description: 'Minimalist master known for bold geometric compositions and pure color. His reductive approach influenced generations of abstract artists.',
    totalSales: 524,
    pricePerCm2: '€8.90',
    yearOverYearGrowth: '+9%',
  },
];
