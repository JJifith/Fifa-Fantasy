import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Leaderboard() {
  const { user } = useAuth();
  const [global, setGlobal] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [roundBoard, setRoundBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/leaderboard'),
      api.get('/leaderboard/rounds'),
    ]).then(([lb, rds]) => {
      setGlobal(lb.data);
      setRounds(rds.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRound) {
      api.get(`/leaderboard/round/${selectedRound}`).then(r => setRoundBoard(r.data));
    }
  }, [selectedRound]);

  const renderTable = (data, label) => (
    <div className="card">
      <h2 style={{ marginBottom: 16 }}>{label}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px', gap: 0 }}>
        {/* Header */}
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>#</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>Manager</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 8px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>Points</div>

        {data.map((entry, i) => {
          const isMe = entry.id === user?.id;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return [
            <div key={`r${entry.id}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', background: isMe ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 16, color: i < 3 ? 'var(--accent)' : 'var(--muted)' }}>
                {medal || entry.rank}
              </span>
            </div>,
            <div key={`n${entry.id}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: isMe ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${(entry.id * 37) % 360}, 60%, 40%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {entry.name[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: isMe ? 700 : 400 }}>{entry.name}</span>
              {isMe && <span style={{ fontSize: 10, background: 'var(--accent)', color: '#000', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>YOU</span>}
            </div>,
            <div key={`p${entry.id}`} style={{ padding: '10px 8px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', background: isMe ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                {entry.total_points || entry.points || 0}
              </span>
            </div>
          ];
        })}
      </div>
      {data.length === 0 && <p className="text-muted" style={{ padding: '20px 0', textAlign: 'center' }}>No data yet</p>}
    </div>
  );

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  // Find user's rank
  const myRank = global.find(e => e.id === user?.id);

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <h1 style={{ color: 'var(--accent)', marginBottom: 24 }}>LEADERBOARD</h1>

      {myRank && (
        <div className="card mb-4" style={{ border: '1px solid var(--accent)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Your ranking</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: 'var(--accent)' }}>#{myRank.rank}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Total points</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: 'var(--accent2)' }}>{myRank.total_points}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {renderTable(global, 'OVERALL STANDINGS')}

        <div>
          <div className="card mb-4">
            <h2 style={{ marginBottom: 12 }}>ROUND LEADERBOARD</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rounds.map(r => (
                <button key={r.id} className={`btn ${selectedRound === r.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={() => setSelectedRound(r.id)}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
          {selectedRound && renderTable(roundBoard, rounds.find(r => r.id === selectedRound)?.name || 'Round')}
        </div>
      </div>
    </div>
  );
}
