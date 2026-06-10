import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const BOOSTER_INFO = {
  wildcard: { icon: '🃏', label: 'Wildcard', desc: 'Unlimited transfers for one round (group stage only)' },
  twelfth_man: { icon: '🪑', label: '12th Man', desc: 'Your best bench player also scores points' },
  max_captain: { icon: '👑', label: 'Max Captain', desc: 'Highest scoring player auto gets 2x points' },
  qualification_booster: { icon: '🚀', label: 'Qual Booster', desc: 'Qualified players score 2x (group stage only)' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [round, setRound] = useState(null);
  const [boosters, setBoosters] = useState([]);
  const [roundPoints, setRoundPoints] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boosterMsg, setBoosterMsg] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/leaderboard/rounds/active').catch(() => ({ data: null })),
      api.get('/boosters'),
      api.get('/leaderboard?limit=5'),
    ]).then(([roundRes, boosterRes, lbRes]) => {
      setRound(roundRes.data);
      setBoosters(boosterRes.data);
      setLeaderboard(lbRes.data.slice(0, 5));
      if (roundRes.data) {
        api.get(`/team/points/${roundRes.data.id}`)
          .then(r => setRoundPoints(r.data.totalPoints))
          .catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  const activateBooster = async (type) => {
    try {
      await api.post('/boosters/activate', { booster_type: type });
      setBoosterMsg(`✅ ${BOOSTER_INFO[type].label} activated!`);
      const res = await api.get('/boosters');
      setBoosters(res.data);
    } catch (err) {
      setBoosterMsg(`❌ ${err.response?.data?.error}`);
    }
    setTimeout(() => setBoosterMsg(''), 3000);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, color: 'var(--accent)' }}>WELCOME BACK, {user?.name?.toUpperCase()}</h1>
        <p className="text-muted">FIFA World Cup 2026 Fantasy</p>
      </div>

      {/* Stats row */}
      <div className="grid-3 mb-4">
        {[
          { label: 'Total Points', value: user?.total_points || 0, icon: '⭐', color: 'var(--accent)' },
          { label: 'This Round', value: roundPoints ?? '—', icon: '📊', color: 'var(--accent2)' },
          { label: 'Budget Left', value: `${parseFloat(user?.budget || 0).toFixed(1)}M`, icon: '💰', color: '#60a5fa' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontFamily: 'Bebas Neue', color: s.color, marginTop: 4 }}>{s.value}</div>
            <div className="text-muted" style={{ marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Active round */}
        <div className="card">
          <h2 style={{ marginBottom: 12 }}>ACTIVE ROUND</h2>
          {round ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 20, fontFamily: 'Bebas Neue', color: 'var(--accent)' }}>{round.name}</span>
                <span className={`badge badge-${round.is_locked ? 'suspended' : 'fit'}`}>
                  {round.is_locked ? '🔒 Locked' : '🔓 Open'}
                </span>
              </div>
              <p className="text-muted mt-2">Stage: {round.stage}</p>
              <p className="text-muted">{new Date(round.start_date).toLocaleDateString()} – {new Date(round.end_date).toLocaleDateString()}</p>
              <p className="text-muted">Transfers per round: {round.transfer_limit}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Link to="/team" className="btn btn-primary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>My Team</Link>
                <Link to="/transfers" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>Transfers</Link>
              </div>
            </div>
          ) : (
            <p className="text-muted">No active round. Check back soon!</p>
          )}
        </div>

        {/* Mini leaderboard */}
        <div className="card">
          <div className="flex-between mb-3">
            <h2>TOP 5</h2>
            <Link to="/leaderboard" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>View all →</Link>
          </div>
          {leaderboard.map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--border)',
              background: entry.id === user?.id ? 'rgba(245,158,11,0.05)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 24, textAlign: 'center', fontFamily: 'Bebas Neue', color: i < 3 ? 'var(--accent)' : 'var(--muted)' }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: entry.id === user?.id ? 700 : 400 }}>{entry.name}</span>
                {entry.id === user?.id && <span style={{ fontSize: 10, color: 'var(--accent)' }}>YOU</span>}
              </div>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 18, color: 'var(--accent)' }}>{entry.total_points}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Boosters */}
      <div className="card mt-4">
        <h2 style={{ marginBottom: 16 }}>BOOSTERS</h2>
        {boosterMsg && <div className={boosterMsg.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginBottom: 12 }}>{boosterMsg}</div>}
        <div className="grid-2" style={{ gap: 12 }}>
          {boosters.map(b => {
            const info = BOOSTER_INFO[b.booster_type];
            if (!info) return null;
            return (
              <div key={b.booster_type} style={{
                background: b.used ? 'var(--bg3)' : 'var(--bg2)',
                border: `1px solid ${b.used ? 'var(--border)' : 'rgba(245,158,11,0.3)'}`,
                borderRadius: 10, padding: 16, opacity: b.used ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 24 }}>{info.icon}</span>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 18, marginTop: 4 }}>{info.label}</div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{info.desc}</p>
                    {b.used && b.used_in_round && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Used in: {b.used_in_round}</p>
                    )}
                  </div>
                  {!b.used && round && !round.is_locked && (
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => activateBooster(b.booster_type)}>
                      Use
                    </button>
                  )}
                  {b.used && <span className="badge badge-suspended">USED</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
