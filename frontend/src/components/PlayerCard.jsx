const STATUS_ICONS = { fit: '', injured: '🔴', suspended: '🟡', eliminated: '❌' };

export default function PlayerCard({ player, selected, onSelect, onRemove, showPoints, isCaptain, isViceCaptain, compact }) {
  const posColor = { GK: 'var(--gk)', DEF: 'var(--def)', MID: 'var(--mid)', FWD: 'var(--fwd)' };

  if (compact) {
    return (
      <div onClick={() => onSelect && onSelect(player)} style={{
        background: selected ? 'rgba(245,158,11,0.1)' : 'var(--card)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8, padding: '8px 12px', cursor: onSelect ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 10,
        transition: 'all 0.15s',
      }}>
        {player.photo_url ? (
  <img
    src={player.photo_url}
    alt={player.name}
    style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      objectFit: 'cover',
      flexShrink: 0
    }}
  />
) : (
  <div style={{
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: posColor[player.position],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    color: '#000',
    flexShrink: 0
  }}>
    {player.position}
  </div>
)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {STATUS_ICONS[player.status]} {player.name}
            {isCaptain && <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--accent)' }}>(C)</span>}
            {isViceCaptain && <span style={{ marginLeft: 4, fontSize: 11, color: 'var(--accent2)' }}>(V)</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{player.team}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>£{parseFloat(player.price).toFixed(1)}m</div>
          {showPoints && <div style={{ fontSize: 11, color: 'var(--accent2)' }}>{player.total_points || 0} pts</div>}
        </div>
        {onRemove && (
          <button onClick={e => { e.stopPropagation(); onRemove(player); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, padding: 2 }}>×</button>
        )}
      </div>
    );
  }

  return (
    <div onClick={() => onSelect && onSelect(player)} style={{
      background: selected ? 'rgba(245,158,11,0.08)' : 'var(--card)',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 10, padding: 14, cursor: onSelect ? 'pointer' : 'default',
      transition: 'all 0.15s', position: 'relative',
    }}>
      {(isCaptain || isViceCaptain) && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: isCaptain ? 'var(--accent)' : 'var(--accent2)', color: '#000', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>
          {isCaptain ? 'C' : 'VC'}
        </div>
      )}
      {player.photo_url ? (
        <img src={player.photo_url} alt={player.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 8px' }} />
      ) : (
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: posColor[player.position], display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 11, fontWeight: 700, color: '#000' }}>
          {player.position}
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {STATUS_ICONS[player.status]} {player.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{player.team}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>£{parseFloat(player.price).toFixed(1)}m</span>
          {showPoints && <span style={{ fontSize: 12, color: 'var(--accent2)' }}>{player.total_points || 0}pts</span>}
        </div>
        <span className={`badge badge-${player.position?.toLowerCase()}`} style={{ marginTop: 4 }}>{player.position}</span>
      </div>
    </div>
  );
}
