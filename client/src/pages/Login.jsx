import React, { useState } from 'react';
import { Mail, Lock, User, Phone, ShieldAlert, ArrowRight, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WPLogo from '../components/WPLogo';

// ── Premium floating orb background ──────────────────────────────────────────
function Orbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* Top-left — violet */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/25 blur-3xl animate-orb" />
      {/* Top-right — cyan */}
      <div className="absolute -top-20 right-0 w-80 h-80 rounded-full bg-cyan-500/20 blur-3xl animate-orb" style={{ animationDelay: '2s' }} />
      {/* Bottom-left — rose */}
      <div className="absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-rose-500/15 blur-3xl animate-orb" style={{ animationDelay: '4s' }} />
      {/* Bottom-right — amber */}
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl animate-orb" style={{ animationDelay: '1s' }} />
      {/* Center streak */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-1 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent rotate-12 blur-sm" />
    </div>
  );
}



// ── Styled input with leading icon ────────────────────────────────────────────
function PremiumInput({ icon: Icon, placeholder, type = 'text', value, onChange, disabled, rightEl, accentColor = 'violet' }) {
  const ringColor = accentColor === 'cyan'
    ? 'focus-within:ring-cyan-500/50 focus-within:border-cyan-500'
    : accentColor === 'rose'
    ? 'focus-within:ring-rose-500/50 focus-within:border-rose-500'
    : 'focus-within:ring-violet-500/50 focus-within:border-violet-500';

  return (
    <div className={`relative flex items-center bg-slate-900/80 border border-slate-700 rounded-xl transition-all duration-200 ring-1 ring-transparent ${ringColor}`}>
      <div className="pl-3.5 text-slate-500 flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="flex-1 bg-transparent py-3 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
      />
      {rightEl && (
        <div className="pr-3 flex-shrink-0">{rightEl}</div>
      )}
    </div>
  );
}

export default function Login() {
  const { login, signup, verifyOtp } = useAuth();

  const [mode, setMode]             = useState('login');
  const [otpRequired, setOtpRequired] = useState(false);
  const [userIdForOtp, setUserIdForOtp] = useState('');
  const [otpCode, setOtpCode]       = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [signupEmail, setSignupEmail]       = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPhone, setSignupPhone]       = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleModeSwitch = (m) => { setMode(m); setError(''); setSuccess(''); };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!emailOrUsername || !password) { setError('Please fill in all credentials.'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const data = await login(emailOrUsername, password);
      if (data.success) {
        if (data.otpRequired) { setOtpRequired(true); setUserIdForOtp(data.userId); setOtpMessage(data.message || 'OTP sent to your email.'); }
        else { setSuccess('Login successful! Welcome back.'); }
      } else { setError(data.message || 'Invalid credentials.'); }
    } catch { setError('Connection error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!signupEmail || !signupUsername || !signupPassword) { setError('Please fill in all required fields.'); return; }
    if (signupPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const data = await signup(signupEmail, signupPhone || undefined, signupUsername, signupPassword);
      if (data.success) { setSuccess('Account created! Redirecting...'); }
      else { setError(data.message || 'Registration failed. Username or email may already be taken.'); }
    } catch { setError('Failed to connect to the registration server.'); }
    finally { setLoading(false); }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) { setError('Please enter a valid 6-digit OTP.'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const data = await verifyOtp(userIdForOtp, otpCode);
      if (data.success) { setSuccess('Identity verified! Redirecting...'); }
      else { setError(data.message || 'Invalid OTP. Please try again.'); }
    } catch { setError('Connection timeout. Please retry.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <Orbs />

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Glowing card border */}
        <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-violet-500/40 via-cyan-500/20 to-rose-500/30 blur-sm" />
        <div className="relative bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-8">

          {/* ── Logo ── */}
          <div className="flex flex-col items-center mb-8">
            <div className="animate-float">
            <WPLogo size={72} />
          </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-gradient-primary">
              Watch Party
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 font-medium tracking-wider uppercase">
              {otpRequired ? '🔐 Security Verification' : '✦ Synchronized entertainment'}
            </p>
          </div>

          {/* ── Alerts ── */}
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs px-4 py-3 rounded-2xl animate-shake">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs px-4 py-3 rounded-2xl text-center font-semibold">
              {success}
            </div>
          )}

          {/* ── OTP Screen ── */}
          {otpRequired ? (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm text-slate-300">{otpMessage}</p>
                <p className="text-[11px] text-slate-500 italic">(Check server console for OTP in dev mode)</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">Verification Code</label>
                <PremiumInput
                  icon={KeyRound}
                  placeholder="Enter 6-digit OTP"
                  type="text"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  accentColor="cyan"
                />
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><span>Verify Identity</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <button type="button" onClick={() => { setOtpRequired(false); setError(''); }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
                ← Back to Login
              </button>
            </form>
          ) : (
            <>
              {/* ── Tab Switcher ── */}
              <div className="flex gap-1 bg-slate-950/80 p-1 rounded-2xl mb-6 border border-slate-800">
                {['login', 'signup'].map(tab => (
                  <button key={tab} type="button" onClick={() => handleModeSwitch(tab)}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all capitalize ${
                      mode === tab
                        ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {tab === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>

              {mode === 'login' ? (
                /* ── Login Form ── */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-violet-400 uppercase tracking-widest">Email or Username</label>
                    <PremiumInput icon={User} placeholder="alex@domain.com or alex_dev" value={emailOrUsername}
                      onChange={e => setEmailOrUsername(e.target.value)} disabled={loading} accentColor="violet" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Password</label>
                    <PremiumInput icon={Lock} placeholder="••••••••" type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} disabled={loading} accentColor="cyan"
                      rightEl={
                        <button type="button" onClick={() => setShowPassword(s => !s)} className="text-slate-500 hover:text-slate-300 transition-colors">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-600 animate-gradient hover:opacity-90 shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-all disabled:opacity-50 mt-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><span>Enter Lobby</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                /* ── Signup Form ── */
                <form onSubmit={handleSignupSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-violet-400 uppercase tracking-widest">Username <span className="text-rose-400">*</span></label>
                    <PremiumInput icon={User} placeholder="alphanumeric e.g. watch_pro" value={signupUsername}
                      onChange={e => setSignupUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} disabled={loading} accentColor="violet" />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-cyan-400 uppercase tracking-widest">Email Address <span className="text-rose-400">*</span></label>
                    <PremiumInput icon={Mail} placeholder="you@example.com" type="email" value={signupEmail}
                      onChange={e => setSignupEmail(e.target.value)} disabled={loading} accentColor="cyan" />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                      Phone <span className="text-slate-600 font-normal normal-case">(optional)</span>
                    </label>
                    <PremiumInput icon={Phone} placeholder="+919876543210" type="tel" value={signupPhone}
                      onChange={e => setSignupPhone(e.target.value)} disabled={loading} accentColor="rose" />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-rose-400 uppercase tracking-widest">Password <span className="text-rose-400">*</span></label>
                    <PremiumInput icon={Lock} placeholder="Min 8 characters" type={showPassword ? 'text' : 'password'} value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)} disabled={loading} accentColor="rose"
                      rightEl={
                        <button type="button" onClick={() => setShowPassword(s => !s)} className="text-slate-500 hover:text-slate-300 transition-colors">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-rose-600 via-violet-600 to-cyan-600 animate-gradient hover:opacity-90 shadow-lg shadow-rose-500/20 active:scale-[0.98] transition-all disabled:opacity-50 mt-2">
                    {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-600 mt-6">
            🔒 Your session is end-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
