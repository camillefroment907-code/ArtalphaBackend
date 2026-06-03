import { NavLink, Outlet } from 'react-router';

const TABS = [
  { label: 'Opportunités',       to: '/app/market/opportunities'      },
  { label: 'Artistes',           to: '/app/market/artists'            },
  { label: 'Artistes à suivre',  to: '/app/market/artists-following'  },
];

export default function MarketContainer() {
  return (
    <>
      {/* Sub-nav */}
      <div style={{
        position: 'sticky', top: '56px', zIndex: 90,
        background: 'rgba(250,250,250,0.96)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            style={({ isActive }) => ({
              padding: '13px 18px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--navy)' : 'var(--text-2)',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid var(--electric)' : '2px solid transparent',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
              letterSpacing: '0.01em',
              fontFamily: 'var(--font-sans)',
            })}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Page content */}
      <Outlet />
    </>
  );
}
