import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

// Room templates — photo-realistic interiors
const ROOMS = [
  {
    id: 'salon_haussmann',
    name: 'Haussmann Salon',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80',
    wall: { x: 0.12, y: 0.05, width: 0.76, height: 0.65 },
    wallColor: '#F5F0E8',
    roomWidth: 6,
    roomHeight: 2.8,
  },
  {
    id: 'contemporary_white',
    name: 'Contemporary White',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
    wall: { x: 0.08, y: 0.02, width: 0.84, height: 0.72 },
    wallColor: '#FFFFFF',
    roomWidth: 7,
    roomHeight: 3.0,
  },
  {
    id: 'dark_luxury',
    name: 'Dark Luxury',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
    wall: { x: 0.1, y: 0.04, width: 0.80, height: 0.68 },
    wallColor: '#2C2C2C',
    roomWidth: 5.5,
    roomHeight: 2.7,
  },
  {
    id: 'office_premium',
    name: 'Premium Office',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    wall: { x: 0.05, y: 0.03, width: 0.90, height: 0.70 },
    wallColor: '#E8E4DC',
    roomWidth: 8,
    roomHeight: 3.2,
  },
  {
    id: 'bedroom_parisian',
    name: 'Parisian Bedroom',
    image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1200&q=80',
    wall: { x: 0.15, y: 0.05, width: 0.70, height: 0.60 },
    wallColor: '#F0EBE3',
    roomWidth: 4.5,
    roomHeight: 2.6,
  },
];

type FrameStyle = 'none' | 'gold' | 'black' | 'white' | 'wood';

export default function RoomVisualizer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedRoom, setSelectedRoom] = useState(ROOMS[0]);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [artworkTitle, setArtworkTitle] = useState('Your artwork');
  const [artworkArtist, setArtworkArtist] = useState('');
  const [artWidth, setArtWidth] = useState(80);
  const [artHeight, setArtHeight] = useState(60);
  const [position, setPosition] = useState({ x: 50, y: 40 });
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('gold');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from URL params (when coming from lot detail)
  useEffect(() => {
    const img    = searchParams.get('img');
    const title  = searchParams.get('title');
    const artist = searchParams.get('artist');
    const w      = searchParams.get('w');
    const h      = searchParams.get('h');

    if (img)    setArtworkUrl(decodeURIComponent(img));
    if (title)  setArtworkTitle(decodeURIComponent(title));
    if (artist) setArtworkArtist(decodeURIComponent(artist));
    if (w)      setArtWidth(Number(w));
    if (h)      setArtHeight(Number(h));
  }, []);

  // Calculate artwork pixel size based on room scale
  const getArtworkPixels = () => {
    if (!containerRef.current) return { width: 120, height: 90 };
    const rect = containerRef.current.getBoundingClientRect();
    const wallWidthPx = rect.width * selectedRoom.wall.width;
    const scaleX = wallWidthPx / (selectedRoom.roomWidth * 100); // px per cm
    return {
      width: artWidth * scaleX,
      height: artHeight * scaleX,
    };
  };

  const artPx = getArtworkPixels();

  const getFrameCSS = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      cursor: isDragging ? 'grabbing' : 'grab',
      transition: isDragging ? 'none' : 'box-shadow 0.2s',
      userSelect: 'none',
    };
    const frames: Record<FrameStyle, React.CSSProperties> = {
      none:  { boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
      gold:  { border: '12px solid #C6A85A', outline: '2px solid #8B7340', boxShadow: '0 12px 40px rgba(0,0,0,0.5), inset 0 0 0 2px #E8C97A' },
      black: { border: '10px solid #0A0A0A', outline: '1px solid #333', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' },
      white: { border: '12px solid #F8F8F8', outline: '1px solid #DDD', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' },
      wood:  { border: '14px solid #8B6914', outline: '2px solid #6B4F10', boxShadow: '0 12px 40px rgba(0,0,0,0.5)' },
    };
    return { ...base, ...frames[frameStyle] };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.x) / rect.width * 100;
    const dy = (e.clientY - dragStart.y) / rect.height * 100;
    setPosition(prev => ({
      x: Math.max(5, Math.min(95, prev.x + dx)),
      y: Math.max(5, Math.min(80, prev.y + dy)),
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => setIsDragging(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setArtworkUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Back
        </button>
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
            <path d="M 20 4 A 16 16 0 0 1 36 20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M 36 20 A 16 16 0 0 1 20 36" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
            <path d="M 20 36 A 8 8 0 0 1 12 28" stroke="#C6A85A" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="20" cy="20" r="2" fill="#C6A85A"/>
          </svg>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '15px', color: 'white', fontWeight: 600 }}>Room Visualizer</span>
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          Visualize any artwork in your space
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '7px 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer' }}
          >
            ↓ Save image
          </button>
          <button
            onClick={() => navigate('/app/explore')}
            style={{ padding: '7px 16px', background: '#2563EB', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
          >
            Browse lots →
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>

        {/* LEFT PANEL */}
        <div style={{ background: '#111', borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', padding: '20px' }}>

          {/* Artwork upload */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Artwork
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${artworkUrl ? 'rgba(198,168,90,0.4)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '8px', padding: '20px',
                textAlign: 'center', cursor: 'pointer',
                background: artworkUrl ? 'rgba(198,168,90,0.05)' : 'rgba(255,255,255,0.03)',
                transition: 'all 0.2s', marginBottom: '10px',
              }}
            >
              {artworkUrl ? (
                <img src={artworkUrl} alt="" style={{ width: '100%', height: '120px', objectFit: 'contain', borderRadius: '4px' }} />
              ) : (
                <>
                  <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.4 }}>◎</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Upload artwork photo</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>JPG, PNG, WEBP</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            <input
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: 'white', marginBottom: '6px', boxSizing: 'border-box' }}
              placeholder="Artist name"
              value={artworkArtist}
              onChange={e => setArtworkArtist(e.target.value)}
            />
            <input
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: 'white', boxSizing: 'border-box' }}
              placeholder="Artwork title"
              value={artworkTitle}
              onChange={e => setArtworkTitle(e.target.value)}
            />
          </div>

          {/* Dimensions */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Real dimensions (cm)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {([
                { label: 'Width', value: artWidth, set: setArtWidth },
                { label: 'Height', value: artHeight, set: setArtHeight },
              ] as const).map(({ label, value, set }) => (
                <div key={label}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px', fontFamily: 'monospace' }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      value={value}
                      onChange={e => set(Number(e.target.value))}
                      style={{ width: '60px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', color: 'white', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>cm</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(198,168,90,0.08)', borderRadius: '6px', border: '1px solid rgba(198,168,90,0.15)' }}>
              <div style={{ fontSize: '10px', color: 'rgba(198,168,90,0.8)', fontFamily: 'monospace' }}>
                {artWidth} × {artHeight} cm
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                Displayed at real scale in room
              </div>
            </div>
          </div>

          {/* Frame */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Frame
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {([
                { id: 'none',  label: 'None',  color: 'transparent', border: 'rgba(255,255,255,0.2)' },
                { id: 'gold',  label: 'Gold',  color: '#C6A85A',     border: '#C6A85A' },
                { id: 'black', label: 'Black', color: '#111',        border: '#444' },
                { id: 'white', label: 'White', color: '#F8F8F8',     border: '#CCC' },
                { id: 'wood',  label: 'Wood',  color: '#8B6914',     border: '#8B6914' },
              ] as const).map(({ id, label, color, border }) => (
                <button
                  key={id}
                  onClick={() => setFrameStyle(id)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px',
                    border: `1px solid ${frameStyle === id ? border : 'rgba(255,255,255,0.12)'}`,
                    background: frameStyle === id ? `${color}22` : 'rgba(255,255,255,0.04)',
                    color: frameStyle === id ? 'white' : 'rgba(255,255,255,0.5)',
                    fontSize: '11px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  {id !== 'none' && (
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, border: `1px solid ${border}` }} />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Room selection */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px' }}>
              Room
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ROOMS.map(room => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '8px',
                    border: `1px solid ${selectedRoom.id === room.id ? 'rgba(198,168,90,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: selectedRoom.id === room.id ? 'rgba(198,168,90,0.08)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <img
                    src={room.image}
                    alt={room.name}
                    style={{ width: '48px', height: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '12px', color: selectedRoom.id === room.id ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: selectedRoom.id === room.id ? 600 : 400 }}>
                      {room.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                      {room.roomWidth}m × {room.roomHeight}m
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Room preview */}
        <div
          style={{ position: 'relative', overflow: 'hidden', background: '#000' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img
              src={selectedRoom.image}
              alt={selectedRoom.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              draggable={false}
            />

            {/* Artwork on wall */}
            {artworkUrl ? (
              <div
                onMouseDown={handleMouseDown}
                style={{
                  ...getFrameCSS(),
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: `${Math.max(artPx.width, 60)}px`,
                  height: `${Math.max(artPx.height, 40)}px`,
                }}
              >
                <img
                  src={artworkUrl}
                  alt={artworkTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  draggable={false}
                />
              </div>
            ) : (
              /* Placeholder */
              <div style={{
                position: 'absolute',
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `${Math.max(artPx.width, 80)}px`,
                height: `${Math.max(artPx.height, 60)}px`,
                border: '2px dashed rgba(198,168,90,0.6)',
                borderRadius: '2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(198,168,90,0.05)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', color: 'rgba(198,168,90,0.6)' }}>◎</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', fontFamily: 'monospace' }}>
                    Upload artwork
                  </div>
                </div>
              </div>
            )}

            {/* Artwork label */}
            {artworkUrl && (artworkArtist || artworkTitle) && (
              <div style={{
                position: 'absolute',
                left: `${position.x}%`,
                top: `calc(${position.y}% + ${Math.max(artPx.height, 40) / 2 + 16}px)`,
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                borderRadius: '4px', padding: '5px 10px',
                textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                {artworkArtist && (
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {artworkArtist}
                  </div>
                )}
                {artworkTitle && (
                  <div style={{ fontSize: '11px', color: 'white', fontFamily: 'Georgia, serif' }}>
                    {artworkTitle}
                  </div>
                )}
              </div>
            )}

            {/* Size ruler */}
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', borderRadius: '6px', padding: '8px 12px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                <span style={{ color: '#C6A85A', fontWeight: 700 }}>{artWidth} × {artHeight} cm</span>
                {' '}in a {selectedRoom.roomWidth}m room
              </div>
            </div>

            {/* Drag hint */}
            {artworkUrl && (
              <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: '6px', padding: '6px 12px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                  ✦ Drag to reposition
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
