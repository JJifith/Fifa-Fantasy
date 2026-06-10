import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signup(form.name, form.email, form.password);
      navigate('/team');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>⚽</div>
          <h1 style={{ fontSize: 36, color: 'var(--accent)', marginTop: 8 }}>JOIN THE GAME</h1>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Create your fantasy team for WC 2026</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            {[
              { key: 'name', label: 'Team Name', type: 'text', placeholder: 'My Dream Team' },
              { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
              { key: 'password', label: 'Password', type: 'password', placeholder: '6+ characters' },
            ].map(f => (
              <div key={f.key} className="mb-3">
                <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input className="input" type={f.type} value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder} required />
              </div>
            ))}
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--accent)' }}>💰 Starting budget: <strong>100M</strong></p>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Select 15 players within budget to start</p>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8, padding: 12 }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: 13 }}>
            Already have an account? <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
