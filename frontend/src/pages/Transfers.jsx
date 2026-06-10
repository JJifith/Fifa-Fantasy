import { useState, useEffect } from 'react';
import api from '../utils/api';
import PlayerCard from '../components/PlayerCard';

export default function Transfers() {
  const [myTeam, setMyTeam] = useState([]);
  const [players, setPlayers] = useState([]);
  const [bank, setBank] = useState(0);
  const [round, setRound] = useState(null);
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);
  const [filter, setFilter] = useState({ pos: 'ALL', search: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/team'),
      api.get('/players?sort=price'),
      api.get('/transfers/bank'),
      api.get('/transfers/history'),
    ]).then(([teamRes, playersRes, bankRes, histRes]) => {
      setMyTeam(teamRes.data.team || []);
      setRound(teamRes.data.round);
      setPlayers(playersRes.data);
      setBank(bankRes.data.available || 0);
      setHistory(histRes.data);
    });
  }, []);

  const makeTransfer = async () => {
    if (!playerOut || !playerIn) return;
    setLoading(true); setMsg('');
    try {
      const res = await api.post('/transfers', {
        player_out_id: playerOut.player_id || playerOut.id,
        player_in_id: playerIn.id,
      });
      setMsg(`✅ Transfer complete! ${res.data.transfersLeft} transfers remaining`);
      setBank(typeof res.data.transfersLeft === 'number' ? res.data.transfersLeft : bank - 1);
      setPlayerOut(null); setPlayerIn(null);
      const teamRes = await api.get('/team');
      setMyTeam(teamRes.data.team || []);
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Transfer failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const filtered = players.filter(p => {
    const pos = playerOut?.position;
    if (pos && p.position !== pos) return false;
    if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase()) &&
      !p.team.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (myTeam.find(t => t.player_id === p.id)) return false;
    return true;
  });

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div className="flex-between mb-4">
        <h1 style={{ color: 'var(--accent)' }}>TRANSFERS</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 24, color: bank > 0 ? 'var(--accent2)' : 'var(--danger)' }}>{bank}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Transfers Left</div>
          </div>
        </div>
      </div>

      {round?.is_locked && <div className="error-msg mb-4">🔒 Round is locked. Transfers will open after the round ends.</div>}

      {msg && <div className={msg.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginBottom: 16 }}>{msg}</div>}

      {/* Transfer UI */}
      <div className="grid-2 mb-4">
        {/* Player OUT */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>1. SELECT PLAYER OUT</h3>
          <p className="text-muted mb-3" style={{ fontSize: 12 }}>Click a player from your squad to transfer out</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {myTeam.map(p => (
              <PlayerCard key={p.player_id || p.id} player={{ ...p, id: p.player_id || p.id }} compact showPoints
                selected={playerOut?.player_id === p.player_id}
                onSelect={() => setPlayerOut(p)} />
            ))}
          </div>
        </div>

        {/* Player IN */}
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>2. SELECT PLAYER IN {playerOut && <span className="text-muted" style={{ fontSize: 13 }}>({playerOut.position} only)</span>}</h3>
          {!playerOut ? (
            <p className="text-muted">Select a player to transfer out first</p>
          ) : (
            <>
              <input className="input mb-3" placeholder="Search replacement..."
                value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
              <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filtered.map(p => (
                  <PlayerCard key={p.id} player={p} compact showPoints
                    selected={playerIn?.id === p.id}
                    onSelect={() => setPlayerIn(p)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm transfer */}
      {playerOut && playerIn && (
        <div className="card mb-4" style={{ border: '1px solid var(--accent)', background: 'rgba(245,158,11,0.05)' }}>
          <h3 style={{ marginBottom: 12, color: 'var(--accent)' }}>CONFIRM TRANSFER</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>OUT ↑</div>
              <PlayerCard player={{ ...playerOut, id: playerOut.player_id || playerOut.id }} compact />
            </div>
            <div style={{ fontSize: 28 }}>⇄</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: 'var(--accent2)', marginBottom: 4 }}>IN ↓</div>
              <PlayerCard player={playerIn} compact />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Price diff</div>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: (playerIn.price - playerOut.price) > 0 ? 'var(--danger)' : 'var(--accent2)' }}>
                {(playerIn.price - playerOut.price) > 0 ? '+' : ''}{(playerIn.price - playerOut.price).toFixed(1)}M
              </div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }}
            onClick={makeTransfer} disabled={loading || round?.is_locked || bank <= 0}>
            {loading ? 'Processing...' : '✅ Confirm Transfer'}
          </button>
        </div>
      )}

      {/* Transfer history */}
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>TRANSFER HISTORY</h3>
        {history.length === 0 ? (
          <p className="text-muted">No transfers yet</p>
        ) : (
          history.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--danger)' }}>↑ {t.player_out_name}</span>
                <span style={{ color: 'var(--muted)', margin: '0 8px' }}>→</span>
                <span style={{ color: 'var(--accent2)' }}>↓ {t.player_in_name}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--muted)', fontSize: 11 }}>{t.round_name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.transfer_type === 'wildcard' ? '🃏 Wildcard' : 'Normal'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
