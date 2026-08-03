import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lumenActive, setLumenActive] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);
    
    const res = await login(email, password);
    setLoading(false);
    
    if (res.success) {
      navigate('/dashboard');
    } else {
      setError(res.error);
    }
  };

  return (
    <div className="login-page-container">
      {/* Background glowing decorations */}
      <div className="login-bg-glow-1"></div>
      <div className="login-bg-glow-2"></div>
      
      <div className="login-card-wrapper">
        <div className={`card ${lumenActive ? 'active' : ''}`}>
          <div className="light-layer">
            <div className="slit"></div>
            <div className="lumen">
              <div className="min"></div>
              <div className="mid"></div>
              <div className="hi"></div>
            </div>
            <div className="darken">
              <div className="sl"></div>
              <div className="ll"></div>
              <div className="slt"></div>
              <div className="srt"></div>
            </div>
          </div>
          <div className="content">
            <div className="login-brand-header text-center">
              <h2 className="login-title">SmartPhysio</h2>
              <p className="login-subtitle">Intelligent Rehabilitation Portal</p>
            </div>

            <div className="login-form-container">

              {error && (
                <div className="login-error-toast">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-form-fields">
                <div className="input-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    required
                  />
                </div>
                
                <div className="input-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="login-btn">
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <div className="login-footer">
                <p>
                  Don't have an account?{' '}
                  <Link to="/register" className="register-link">
                    Register Here
                  </Link>
                </p>
              </div>
            </div>

            <div className="bottom-toggle-container">
              <div 
                className={`toggle ${lumenActive ? 'active' : ''}`}
                onClick={() => setLumenActive(!lumenActive)}
              >
                <div className="handle"></div>
                <span>Activate Lumen</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
