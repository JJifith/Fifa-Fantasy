import { useState, useEffect } from 'react';
import api from '../utils/api';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];
const STATUSES = ['fit', 'injured', 'suspended', 'eliminated'];

const WC_TEAMS = [
  'Mexico','South Africa','Korea Republic','Czechia','Canada','Bosnia and Herzegovina',
  'Qatar','Switzerland','USA','Paraguay','Australia','Türkiye','Haiti','Scotland',
  'Brazil','Morocco','Côte d\'Ivoire','Ecuador','Germany','Curaçao','Netherlands',
  'Japan','Sweden','Tunisia','Saudi Arabia','Uruguay','Spain','Cabo Verde',
  'IR Iran','New Zealand','Belgium','Egypt','France','Senegal','Iraq','Norway',
  'Argentina','Algeria','Austria','Jordan','Ghana','Panama','England','Croatia',
  'Portugal','Congo DR','Uzbekistan','Colombia'
];

export default function AdminPanel() {
  const [tab, setTab] = useState('players');
  const [players, setPlayers] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Player form
  const [pForm, setPForm] = useState({ name: '', position: 'GK', team: '', price: '', photo_url: '', jersey_number: '', club: '', age: '', status: 'fit' });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerFilter, setPlayerFilter] = useState({ pos: 'ALL', team: 'ALL', search: '' });

  // Round form
  const [rForm, setRForm] = useState({ name: '', stage: 'group', start_date: '', end_date: '', transfer_limit: 3 });

  // Score entry
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState([]);
  const [statsForm, setStatsForm] = useState({});

  // Import
  const [importTeam, setImportTeam] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [pr, rr] = await Promise.all([
      api.get('/players?sort=name'),
      api.get('/leaderboard/rounds'),
    ]);
    setPlayers(pr.data);
    setRounds(rr.data);
  };

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  // --- PLAYER MANAGEMENT ---
  const savePlayer = async () => {
    setLoading(true);
    try {
      if (editingPlayer) {
        await api.put(`/players/${editingPlayer.id}`, pForm);
        showMsg('✅ Player updated');
      } else {
        await api.post('/players', pForm);
        showMsg('✅ Player added');
      }
      setPForm({ name: '', position: 'GK', team: '', price: '', photo_url: '', jersey_number: '', club: '', age: '', status: 'fit' });
      setEditingPlayer(null);
      loadData();
    } catch (err) {
      showMsg(`❌ ${err.response?.data?.error}`);
    } finally {
      setLoading(false);
    }
  };

  const editPlayer = (p) => {
    setEditingPlayer(p);
    setPForm({ name: p.name, position: p.position, team: p.team, price: p.price, photo_url: p.photo_url || '', jersey_number: p.jersey_number || '', club: p.club || '', age: p.age || '', status: p.status });
    setTab('players');
    window.scrollTo(0, 0);
  };

  const deletePlayer = async (id) => {
    if (!window.confirm('Delete this player?')) return;
    await api.delete(`/players/${id}`);
    loadData();
  };

  const importSquad = async () => {
    if (!importTeam) return;
    setImporting(true);
    try {
      const res = await api.post(`/players/import/${encodeURIComponent(importTeam)}`);
      showMsg(`✅ Imported ${res.data.imported} players from ${importTeam}`);
      loadData();
    } catch (err) {
      showMsg(`❌ Import failed: ${err.response?.data?.error}`);
    } finally {
      setImporting(false);
    }
  };

  // --- ROUNDS ---
  const saveRound = async () => {
    try {
      await api.post('/leaderboard/rounds', rForm);
      showMsg('✅ Round created');
      setRForm({ name: '', stage: 'group', start_date: '', end_date: '', transfer_limit: 3 });
      loadData();
    } catch (err) {
      showMsg(`❌ ${err.response?.data?.error}`);
    }
  };

  const activateRound = async (id) => {
    await api.put(`/leaderboard/rounds/${id}/activate`);
    showMsg('✅ Round activated');
    loadData();
  };

  const lockRound = async (id, locked) => {
    await api.put(`/leaderboard/rounds/${id}/lock`, { locked });
    showMsg(`✅ Round ${locked ? 'locked' : 'unlocked'}`);
    loadData();
  };

  // --- SCORE ENTRY ---
  const loadMatchPlayers = async (match) => {
    setSelectedMatch(match);
    const homePlayers = players.filter(p => p.team === match.home_team);
    const awayPlayers = players.filter(p => p.team === match.away_team);
    const all = [...homePlayers, ...awayPlayers];
    setMatchPlayers(all);
    const initial = {};
    all.forEach(p => {
      initial[p.id] = { minutes_played: 0, goals: 0, assists: 0, saves: 0, clean_sheet: false, yellow_cards: 0, red_cards: 0, penalties_saved: 0, penalties_conceded: 0, own_goals: 0 };
    });
    setStatsForm(initial);
  };

  const updateStat = (playerId, field, value) => {
    setStatsForm(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: field === 'clean_sheet' ? value : parseInt(value) || 0 }
    }));
  };

  const saveStats = async () => {
    if (!selectedMatch) return;
    const stats = matchPlayers.map(p => ({ player_id: p.id, ...statsForm[p.id] }));
    try {
      await api.post('/admin/stats', {
        match_id: selectedMatch.id,
        round_id: selectedMatch.round_id,
        stats
      });
      showMsg('✅ Stats saved and points updated!');
    } catch (err) {
      showMsg(`❌ ${err.response?.data?.error}`);
    }
  };

  const syncMatches = async () => {
    try {
      const res = await api.post('/admin/matches/sync');
      showMsg(`✅ Synced ${res.data.synced} matches from Zafronix`);
      const mr = await api.get('/admin/matches');
      setMatches(mr.data);
    } catch (err) {
      showMsg(`❌ Sync failed`);
    }
  };

  const filteredPlayers = players.filter(p => {
    if (playerFilter.pos !== 'ALL' && p.position !== playerFilter.pos) return false;
    if (playerFilter.team !== 'ALL' && p.team !== playerFilter.team) return false;
    if (playerFilter.search && !p.name.toLowerCase().includes(playerFilter.search.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { key: 'players', label: '👥 Players' },
    { key: 'rounds', label: '📅 Rounds' },
    { key: 'scores', label: '⚽ Score Entry' },
  ];

  return (
    <div className="page" style={{ paddingTop: 24 }}>
      <div className="flex-between mb-4">
        <h1 style={{ color: 'var(--accent)' }}>⚙ ADMIN PANEL</h1>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{players.length} players in database</div>
      </div>

      {msg && <div className={msg.startsWith('✅') ? 'success-msg' : 'error-msg'} style={{ marginBottom: 16 }}>{msg}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PLAYERS TAB */}
      {tab === 'players' && (
        <div>
          {/* Import from Zafronix */}
          <div className="card mb-4">
            <h3 style={{ marginBottom: 12 }}>IMPORT SQUAD FROM ZAFRONIX</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" value={importTeam} onChange={e => setImportTeam(e.target.value)} style={{ flex: 1 }}>
                <option value="">Select team...</option>
                {WC_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button className="btn btn-success" onClick={importSquad} disabled={!importTeam || importing} style={{ whiteSpace: 'nowrap' }}>
                {importing ? 'Importing...' : '⬇ Import Squad'}
              </button>
            </div>
            <p className="text-muted mt-2" style={{ fontSize: 12 }}>Imports name, position, club, age. You'll need to set prices manually after.</p>
          </div>

          {/* Add/Edit player form */}
          <div className="card mb-4">
            <h3 style={{ marginBottom: 12 }}>{editingPlayer ? `✏ EDIT: ${editingPlayer.name}` : '➕ ADD PLAYER'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { key: 'name', label: 'Full Name', type: 'text', placeholder: 'Vinícius Júnior' },
                { key: 'price', label: 'Price (M)', type: 'number', placeholder: '9.5' },
                { key: 'jersey_number', label: 'Jersey #', type: 'number', placeholder: '7' },
                { key: 'club', label: 'Club', type: 'text', placeholder: 'Real Madrid' },
                { key: 'age', label: 'Age', type: 'number', placeholder: '24' },
                { key: 'photo_url', label: 'Photo URL', type: 'text', placeholder: 'https://...' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input className="input" type={f.type} placeholder={f.placeholder}
                    value={pForm[f.key]} onChange={e => setPForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Position</label>
                <select className="input" value={pForm.position} onChange={e => setPForm(p => ({ ...p, position: e.target.value }))}>
                  {POSITIONS.map(pos => <option key={pos}>{pos}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Team (National)</label>
                <select className="input" value={pForm.team} onChange={e => setPForm(p => ({ ...p, team: e.target.value }))}>
                  <option value="">Select team...</option>
                  {WC_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Status</label>
                <select className="input" value={pForm.status} onChange={e => setPForm(p => ({ ...p, status: e.target.value }))}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={savePlayer} disabled={loading}>
                {loading ? 'Saving...' : editingPlayer ? '✅ Update Player' : '➕ Add Player'}
              </button>
              {editingPlayer && (
                <button className="btn btn-secondary" onClick={() => { setEditingPlayer(null); setPForm({ name: '', position: 'GK', team: '', price: '', photo_url: '', jersey_number: '', club: '', age: '', status: 'fit' }); }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Player list */}
          <div className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input className="input" placeholder="Search..." value={playerFilter.search}
                onChange={e => setPlayerFilter(f => ({ ...f, search: e.target.value }))} style={{ flex: 1 }} />
              <select className="input" style={{ width: 100 }} value={playerFilter.pos}
                onChange={e => setPlayerFilter(f => ({ ...f, pos: e.target.value }))}>
                <option value="ALL">All Pos</option>
                {POSITIONS.map(p => <option key={p}>{p}</option>)}
              </select>
              <select className="input" style={{ width: 160 }} value={playerFilter.team}
                onChange={e => setPlayerFilter(f => ({ ...f, team: e.target.value }))}>
                <option value="ALL">All Teams</option>
                {WC_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                    {['#', 'Name', 'Pos', 'Team', 'Price', 'Club', 'Status', 'Pts', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', color: 'var(--muted)' }}>{i + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>
                        {p.photo_url && <img src={p.photo_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle', objectFit: 'cover' }} />}
                        {p.name}
                      </td>
                      <td style={{ padding: '8px' }}><span className={`badge badge-${p.position.toLowerCase()}`}>{p.position}</span></td>
                      <td style={{ padding: '8px', color: 'var(--muted)' }}>{p.team}</td>
                      <td style={{ padding: '8px', color: 'var(--accent)', fontWeight: 700 }}>£{p.price}m</td>
                      <td style={{ padding: '8px', color: 'var(--muted)' }}>{p.club || '—'}</td>
                      <td style={{ padding: '8px' }}><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                      <td style={{ padding: '8px', color: 'var(--accent2)' }}>{p.total_points}</td>
                      <td style={{ padding: '8px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => editPlayer(p)} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}>Edit</button>
                          <button onClick={() => deletePlayer(p.id)} className="btn btn-danger" style={{ padding: '3px 8px', fontSize: 11 }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ROUNDS TAB */}
      {tab === 'rounds' && (
        <div>
          <div className="card mb-4">
            <h3 style={{ marginBottom: 12 }}>CREATE ROUND</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Round Name</label>
                <input className="input" placeholder="e.g. Group Stage Round 1" value={rForm.name} onChange={e => setRForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Stage</label>
                <select className="input" value={rForm.stage} onChange={e => setRForm(f => ({ ...f, stage: e.target.value }))}>
                  {['group', 'r32', 'r16', 'qf', 'sf', 'final'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Transfers/Round</label>
                <input className="input" type="number" value={rForm.transfer_limit} onChange={e => setRForm(f => ({ ...f, transfer_limit: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Start Date</label>
                <input className="input" type="date" value={rForm.start_date} onChange={e => setRForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>End Date</label>
                <input className="input" type="date" value={rForm.end_date} onChange={e => setRForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary mt-3" onClick={saveRound}>➕ Create Round</button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>ALL ROUNDS</h3>
            {rounds.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span style={{ marginLeft: 8 }} className={`badge badge-${r.stage === 'group' ? 'mid' : 'fwd'}`}>{r.stage}</span>
                  {r.is_active && <span className="badge badge-fit" style={{ marginLeft: 6 }}>ACTIVE</span>}
                  {r.is_locked && <span className="badge badge-suspended" style={{ marginLeft: 6 }}>LOCKED</span>}
                  <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {new Date(r.start_date).toLocaleDateString()} – {new Date(r.end_date).toLocaleDateString()} · {r.transfer_limit} transfers
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!r.is_active && <button className="btn btn-success" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => activateRound(r.id)}>Activate</button>}
                  <button className={`btn ${r.is_locked ? 'btn-secondary' : 'btn-danger'}`} style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => lockRound(r.id, !r.is_locked)}>
                    {r.is_locked ? '🔓 Unlock' : '🔒 Lock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SCORE ENTRY TAB */}
      {tab === 'scores' && (
        <div>
          <div className="card mb-4">
            <div className="flex-between">
              <h3>MATCH MANAGEMENT</h3>
              <button className="btn btn-primary" onClick={syncMatches}>🔄 Sync from Zafronix</button>
            </div>
            <p className="text-muted mt-2" style={{ fontSize: 12 }}>Sync pulls all 104 matches. Assign each match to a round, then enter stats after it finishes.</p>
          </div>

          {matches.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p className="text-muted">No matches loaded. Click "Sync from Zafronix" to import all 2026 matches.</p>
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>SELECT MATCH TO ENTER STATS</h3>
              <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {matches.map(m => (
                  <div key={m.id} onClick={() => loadMatchPlayers(m)} style={{
                    padding: '10px', marginBottom: 6, borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${selectedMatch?.id === m.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedMatch?.id === m.id ? 'rgba(245,158,11,0.08)' : 'var(--bg3)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.home_team} vs {m.away_team}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {new Date(m.kickoff_utc).toLocaleDateString()} · {m.round_name || 'No round'} · {m.status}
                    </div>
                    {m.home_score !== null && (
                      <div style={{ color: 'var(--accent)', fontFamily: 'Bebas Neue', fontSize: 18 }}>
                        {m.home_score} - {m.away_score}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedMatch && (
              <div className="card">
                <h3 style={{ marginBottom: 4 }}>ENTER STATS</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{selectedMatch.home_team} vs {selectedMatch.away_team}</p>
                <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                  {matchPlayers.map(p => (
                    <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                        <span className={`badge badge-${p.position.toLowerCase()}`}>{p.position} · {p.team}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                        {[
                          { key: 'minutes_played', label: 'Mins', max: 120 },
                          { key: 'goals', label: 'Goals', max: 10 },
                          { key: 'assists', label: 'Assists', max: 10 },
                          { key: 'saves', label: 'Saves', max: 20 },
                          { key: 'yellow_cards', label: 'Yellow', max: 2 },
                          { key: 'red_cards', label: 'Red', max: 1 },
                          { key: 'penalties_saved', label: 'Pen Saved', max: 3 },
                          { key: 'penalties_conceded', label: 'Pen Conc', max: 3 },
                          { key: 'own_goals', label: 'OG', max: 3 },
                        ].map(f => (
                          <div key={f.key}>
                            <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block' }}>{f.label}</label>
                            <input type="number" min="0" max={f.max}
                              className="input" style={{ padding: '4px 6px', fontSize: 12 }}
                              value={statsForm[p.id]?.[f.key] || 0}
                              onChange={e => updateStat(p.id, f.key, e.target.value)} />
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                          <label style={{ fontSize: 10, color: 'var(--muted)' }}>
                            <input type="checkbox" checked={statsForm[p.id]?.clean_sheet || false}
                              onChange={e => updateStat(p.id, 'clean_sheet', e.target.checked)}
                              style={{ marginRight: 4 }} />
                            Clean Sheet
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={saveStats}>
                  ✅ Save Stats & Update Points
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
