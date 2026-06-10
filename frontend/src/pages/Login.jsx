import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.is_admin ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>⚽</div>
          <h1 style={{ fontSize: 36, color: 'var(--accent)', marginTop: 8 }}>WC FANTASY 2026</h1>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>Sign in to manage your squad</p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="mb-4">
              <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 16, padding: 12 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: 13 }}>
            No account? <Link to="/signup" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
