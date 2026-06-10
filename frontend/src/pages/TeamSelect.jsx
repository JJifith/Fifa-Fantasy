import { useState, useEffect } from 'react';
import api from '../utils/api';
import PlayerCard from '../components/PlayerCard';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const MAX_FROM_TEAM = 3;

export default function TeamSelect() {
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]); // { ...player, is_playing, bench_order, is_captain, is_vice_captain }
  const [filter, setFilter] = useState({ pos: 'ALL', search: '', sort: 'price' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('pick'); // pick | pitch
  const [existingTeam, setExistingTeam] = useState(null);
  const [round, setRound] = useState(null);

  useEffect(() => {
    api.get('/players?sort=price').then(r => setPlayers(r.data));
    api.get('/team').then(r => {
      if (r.data.team?.length) setExistingTeam(r.data.team);
      setRound(r.data.round);
    });
  }, []);

  const budget = 100;
  const spent = selected.reduce((s, p) => s + parseFloat(p.price), 0);
  const remaining = budget - spent;

  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
selected.forEach(p => counts[p.position]++);

const starters = selected.filter(p => p.is_playing);

const formationText =
  `${starters.filter(p => p.position === 'DEF').length}-` +
  `${starters.filter(p => p.position === 'MID').length}-` +
  `${starters.filter(p => p.position === 'FWD').length}`;

const teamCounts = {};
selected.forEach(p => { teamCounts[p.team] = (teamCounts[p.team] || 0) + 1; });
  const canAdd = (player) => {
    if (selected.length >= 15) return false;
    if (selected.find(p => p.id === player.id)) return false;
    if (parseFloat(player.price) > remaining) return false;
    if ((teamCounts[player.team] || 0) >= MAX_FROM_TEAM) return false;
    if (player.position === 'GK' && counts.GK >= 2) return false;
    if (player.position === 'DEF' && counts.DEF >= 5) return false;
    if (player.position === 'MID' && counts.MID >= 5) return false;
    if (player.position === 'FWD' && counts.FWD >= 3) return false;
    return true;
  };

  const addPlayer = (player) => {
    if (!canAdd(player)) return;
    const isStarting = getDefaultStarting(player);
    const benchOrder = isStarting ? null : getBenchOrder(player.position);
    setSelected(prev => [...prev, { ...player, is_playing: isStarting, bench_order: benchOrder, is_captain: false, is_vice_captain: false }]);
  };

  const getDefaultStarting = (player) => {
    const startingCount = selected.filter(p => p.is_playing).length;
    if (startingCount >= 11) return false;
    return true;
  };

  const getBenchOrder = (position) => {
    const bench = selected.filter(p => !p.is_playing);
    return bench.length + 1;
  };

  const removePlayer = (player) => {
    setSelected(prev => prev.filter(p => p.id !== player.id));
  };

  const setCaptain = (playerId) => {
    setSelected(prev => prev.map(p => ({
      ...p,
      is_captain: p.id === playerId,
      is_vice_captain: p.is_vice_captain && p.id !== playerId
    })));
  };

  const setViceCaptain = (playerId) => {
    setSelected(prev => prev.map(p => ({
      ...p,
      is_vice_captain: p.id === playerId,
      is_captain: p.is_captain && p.id !== playerId
    })));
  };

  const toggleStarting = (playerId) => {
    setSelected(prev => prev.map(p =>
      p.id === playerId ? { ...p, is_playing: !p.is_playing } : p
    ));
  };

  const saveTeam = async () => {
    if (selected.length !== 15) return setMsg('❌ Select exactly 15 players');
    const starting = selected.filter(p => p.is_playing);

    if (starting.length !== 11) return setMsg('❌ Must have exactly 11 starting players');
    const formation = {
  GK: starting.filter(p => p.position === 'GK').length,
  DEF: starting.filter(p => p.position === 'DEF').length,
  MID: starting.filter(p => p.position === 'MID').length,
  FWD: starting.filter(p => p.position === 'FWD').length,
};

if (formation.GK !== 1)
  return setMsg('❌ Must start exactly 1 goalkeeper');

if (formation.DEF < 3)
  return setMsg('❌ Must start at least 3 defenders');

if (formation.MID < 2)
  return setMsg('❌ Must start at least 2 midfielders');

if (formation.FWD < 1)
  return setMsg('❌ Must start at least 1 forward');
    if (!selected.find(p => p.is_captain)) return setMsg('❌ Select a captain');
    if (!selected.find(p => p.is_vice_captain)) return setMsg('❌ Select a vice captain');

    setSaving(true); setMsg('');
    try {
      await api.post('/team/select', {
        players: selected.map(p => ({
          player_id: p.id,
          is_playing: p.is_playing,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          bench_order: p.bench_order,
        }))
      });
      setMsg('✅ Team saved successfully!');
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Failed to save'}`);
    } finally {
      setSaving(false);
    }
  };

  const filtered = players.filter(p => {
    if (filter.pos !== 'ALL' && p.position !== filter.pos) return false;
    if (filter.search && !p.name.toLowerCase().includes(filter.search.toLowerCase()) && !p.team.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => filter.sort === 'price' ? b.price - a.price : b.total_points - a.total_points);

  if (existingTeam) {
    return (
      <div className="page" style={{ paddingTop: 24 }}>
        <h1 style={{ color: 'var(--accent)', marginBottom: 8 }}>MY TEAM</h1>
        {round?.is_locked && <div className="error-msg mb-4">🔒 Round is locked — no changes until transfers open</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {existingTeam.map(p => (
            <PlayerCard key={p.player_id} player={p}
              isCaptain={p.is_captain} isViceCaptain={p.is_vice_captain}
              showPoints />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div className="flex-between mb-4">
        <h1 style={{ color: 'var(--accent)' }}>PICK YOUR SQUAD</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pick', 'pitch'].map(t => (
            <button key={t} className={`btn ${activeTab === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(t)} style={{ textTransform: 'capitalize' }}>
              {t === 'pick' ? '👥 Pick Players' : '⚽ Set Lineup'}
            </button>
          ))}
        </div>
      </div>

      {/* Budget bar */}
      <div className="card mb-4">
        <div className="flex-between" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Budget: <strong style={{ color: remaining < 5 ? 'var(--danger)' : 'var(--accent2)' }}>£{remaining.toFixed(1)}m remaining</strong></span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Players: <strong style={{ color: selected.length === 15 ? 'var(--accent2)' : 'var(--text)' }}>{selected.length}/15</strong></span>
        </div>
        <div style={{ marginBottom: 8 }}>
  <span style={{ fontSize: 13, color: 'var(--accent)' }}>
    Formation: {formationText}
  </span>
</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {POSITIONS.map(pos => (
            <span key={pos} className={`badge badge-${pos.toLowerCase()}`}>
              {pos}: {counts[pos]}
            </span>
          ))}
        </div>
        <div style={{ background: 'var(--border)', borderRadius: 4, height: 4, marginTop: 10 }}>
          <div style={{ background: 'var(--accent)', height: 4, borderRadius: 4, width: `${(spent / budget) * 100}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      

      {activeTab === 'pick' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Player browser */}
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="input" placeholder="Search player or team..." value={filter.search}
                onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} style={{ flex: 1 }} />
              <select className="input" style={{ width: 120 }} value={filter.pos}
                onChange={e => setFilter(f => ({ ...f, pos: e.target.value }))}>
                <option value="ALL">All</option>
                {POSITIONS.map(p => <option key={p}>{p}</option>)}
              </select>
              <select className="input" style={{ width: 120 }} value={filter.sort}
                onChange={e => setFilter(f => ({ ...f, sort: e.target.value }))}>
                <option value="price">By Price</option>
                <option value="total_points">By Points</option>
              </select>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(p => (
                <PlayerCard key={p.id} player={p} compact showPoints
                  selected={!!selected.find(s => s.id === p.id)}
                 onSelect={() => {
                  if (selected.find(s => s.id === p.id)) {
                    removePlayer(p);
                  } else if (canAdd(p)) {
                    addPlayer(p);
                  }
                }} />
              ))}
              {filtered.length === 0 && <p className="text-muted" style={{ padding: 20, textAlign: 'center' }}>No players found</p>}
            </div>
          </div>

          {/* Selected team */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: 12 }}>SELECTED ({selected.length}/15)</h3>
            {POSITIONS.map(pos => (
              <div key={pos} style={{ marginBottom: 12 }}>
                <div className={`badge badge-${pos.toLowerCase()}`} style={{ marginBottom: 6 }}>{pos}</div>
                {selected.filter(p => p.position === pos).map(p => (
                  <PlayerCard key={p.id} player={p} compact
                    isCaptain={p.is_captain} isViceCaptain={p.is_vice_captain}
                    onRemove={removePlayer} />
                ))}
              </div>
            ))}
            {msg && <div className={msg.startsWith('✅') ? 'success-msg' : 'error-msg'}>{msg}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}
              onClick={saveTeam} disabled={saving || selected.length !== 15}>
              {saving ? 'Saving...' : '✅ Save Team'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'pitch' && (
        <div className="grid-2">
          {/* Lineup setter */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>SET STARTING 11</h3>
            <p className="text-muted mb-3" style={{ fontSize: 12 }}>Click to toggle starting/bench. Need exactly 11 starters.</p>
            {POSITIONS.map(pos => (
              <div key={pos} style={{ marginBottom: 12 }}>
                <div className={`badge badge-${pos.toLowerCase()}`} style={{ marginBottom: 6 }}>{pos}</div>
                {selected.filter(p => p.position === pos).map(p => (
                  <div key={p.id} onClick={() => toggleStarting(p.id)} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 6, marginBottom: 4, cursor: 'pointer',
                    background: p.is_playing ? 'rgba(16,185,129,0.1)' : 'var(--bg3)',
                    border: `1px solid ${p.is_playing ? 'var(--accent2)' : 'var(--border)'}`,
                  }}>
                    <span style={{ fontSize: 13 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: p.is_playing ? 'var(--accent2)' : 'var(--muted)' }}>
                      {p.is_playing ? '▶ Starting' : '🪑 Bench'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Captain setter */}
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>SET CAPTAIN</h3>
            <p className="text-muted mb-3" style={{ fontSize: 12 }}>Captain scores 2x, Vice Captain 1.5x</p>
            {selected.filter(p => p.is_playing).map(p => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderRadius: 6, marginBottom: 6,
                background: 'var(--bg3)', border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 13 }}>{p.name} <span className={`badge badge-${p.position.toLowerCase()}`}>{p.position}</span></span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setCaptain(p.id)} className="btn"
                    style={{ padding: '3px 8px', fontSize: 11, background: p.is_captain ? 'var(--accent)' : 'var(--border)', color: p.is_captain ? '#000' : 'var(--text)' }}>
                    C
                  </button>
                  <button onClick={() => setViceCaptain(p.id)} className="btn"
                    style={{ padding: '3px 8px', fontSize: 11, background: p.is_vice_captain ? 'var(--accent2)' : 'var(--border)', color: p.is_vice_captain ? '#000' : 'var(--text)' }}>
                    VC
                  </button>
                </div>
              </div>
            ))}
            {msg && <div className={msg.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginTop: 8 }}>{msg}</div>}
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}
              onClick={saveTeam} disabled={saving}>
              {saving ? 'Saving...' : '✅ Confirm Squad'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
