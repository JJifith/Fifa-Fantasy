import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const loc = useLocation();

  const links = [
    { to: '/', label: 'Dashboard' },
    { to: '/team', label: 'My Team' },
    { to: '/transfers', label: 'Transfers' },
    { to: '/leaderboard', label: 'Leaderboard' },
    ...(user?.is_admin ? [{ to: '/admin', label: '⚙ Admin' }] : []),
  ];

  return (
    <nav style={{
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 56,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'var(--accent)', letterSpacing: 2 }}>
          ⚽ WC FANTASY
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {links.map(l => (
            <Link key={l.to} to={l.to} style={{
              padding: '6px 14px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              color: loc.pathname === l.to ? 'var(--accent)' : 'var(--muted)',
              background: loc.pathname === l.to ? 'rgba(245,158,11,0.1)' : 'transparent',
              transition: 'all 0.2s',
            }}>{l.label}</Link>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          💰 💰 {Number(user?.budget || 0).toFixed(1)}M
        </span>
        <span style={{ fontSize: 13, color: 'var(--accent)' }}>
          ⭐ {user?.total_points || 0} pts
        </span>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
          {user?.name}
        </span>
        <button onClick={logout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
          Logout
        </button>
      </div>
    </nav>
  );
}
