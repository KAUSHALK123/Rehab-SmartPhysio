import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    
    const res = await register(email, password);
    setLoading(false);
    
    if (res.success) {
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
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
        <div className="card">
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
              <p className="login-subtitle">Create Your Account</p>
            </div>

            <div className="login-form-container">

              {error && (
                <div className="login-error-toast" style={{ backgroundColor: '#ffefef', color: '#dc3545', border: '1px solid #dc3545' }}>
                  {error}
                </div>
              )}

              {success && (
                <div className="login-error-toast" style={{ backgroundColor: '#effaf3', color: '#198754', border: '1px solid #198754' }}>
                  {success}
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

                <div className="input-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="login-btn">
                  {loading ? 'Registering...' : 'Register'}
                </button>
              </form>

              <div className="login-footer">
                <p>
                  Already have an account?{' '}
                  <Link to="/login" className="register-link">
                    Login Here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
