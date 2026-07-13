import React, { useEffect, useRef, useState } from 'react';
import {
  Play, Download, Users, LogOut, Settings, Upload, Check,
  Moon, Sun, Monitor, ShieldAlert, Plus, X,
  Bell, Lock, Trash2, User, ChevronRight, Save, Eye, EyeOff, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import WatchPartyRoom from '../components/WatchPartyRoom';
import CommentsSection from '../components/CommentsSection';
import Subscription from './Subscription';
import WPLogo from '../components/WPLogo';

// ─── Reusable Section Header ─────────────────────────────────────────────────
function SectionHeading({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
      <Icon className="w-4 h-4 text-brand-500" />
      <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, id }) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Settings Drawer ─────────────────────────────────────────────────────────
function SettingsDrawer({ open, onClose, user, token, updateProfileOptions, uploadAvatar }) {
  const { themePref, updateTheme } = useTheme();
  const drawerRef = useRef(null);

  // ── Local form state ──────────────────────────────────────────────────────
  const [locale, setLocale]             = useState(user?.preferredLocale || 'en');
  const [notifEmail, setNotifEmail]     = useState(user?.notifEmail ?? true);
  const [notifPush, setNotifPush]       = useState(user?.notifPush ?? true);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [settingsMsg, setSettingsMsg]   = useState('');
  const [settingsErr, setSettingsErr]   = useState('');

  // Password change state
  const [showPwSection, setShowPwSection] = useState(false);
  const [currentPw, setCurrentPw]       = useState('');
  const [newPw, setNewPw]               = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [pwMsg, setPwMsg]               = useState('');
  const [pwErr, setPwErr]               = useState('');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput]   = useState('');

  // Sync user data into local state when user object changes
  useEffect(() => {
    if (user) {
      setLocale(user.preferredLocale || 'en');
      setNotifEmail(user.notifEmail ?? true);
      setNotifPush(user.notifPush ?? true);
    }
  }, [user]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setSettingsMsg('');
    setSettingsErr('');
    const data = await updateProfileOptions({
      themePreference: themePref,
      preferredLocale: locale,
      notifEmail,
      notifPush,
    });
    if (data?.success) {
      setSettingsMsg('Settings saved successfully!');
      setTimeout(() => setSettingsMsg(''), 3000);
    } else {
      setSettingsErr(data?.message || 'Failed to save settings.');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarSuccess(false);
    const data = await uploadAvatar(file);
    if (data?.success) {
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } else {
      setSettingsErr(data?.message || 'Avatar upload failed.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (newPw.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
    try {
      const res = await fetch('http://localhost:5000/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (data.success) {
        setPwMsg('Password changed successfully!');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        setShowPwSection(false);
        setTimeout(() => setPwMsg(''), 3000);
      } else {
        setPwErr(data.message || 'Password change failed.');
      }
    } catch {
      setPwErr('Connection error. Please try again.');
    }
  };

  // Overlay click to close
  const handleOverlayClick = (e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={handleOverlayClick}
      />

      {/* Drawer Panel */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-500" />
            <h2 className="font-black text-base tracking-tight">Account Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

          {/* ── Profile Avatar ── */}
          <section>
            <SectionHeading icon={User} label="Profile" />
            <div className="flex items-center gap-4 mb-4">
              {user?.avatarUrl ? (
                <img
                  src={`http://localhost:5000${user.avatarUrl}`}
                  alt="avatar"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500/30"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-luxury-rose flex items-center justify-center text-2xl font-black text-white uppercase shadow-lg">
                  {user?.username?.[0]}
                </div>
              )}
              <div>
                <p className="font-bold text-sm">{user?.username}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
                <label className="mt-2 inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  Change Avatar
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
                {avatarSuccess && (
                  <span className="block text-[10px] text-green-500 font-bold mt-1">✓ Avatar updated!</span>
                )}
              </div>
            </div>
          </section>

          {/* ── General Settings Form ── */}
          <form onSubmit={handleSaveGeneral}>
            {/* Theme */}
            <section className="mb-6">
              <SectionHeading icon={Sun} label="Appearance" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Choose how Watch Party looks to you. Changes apply immediately.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'system', label: 'System', icon: Monitor },
                  { value: 'light',  label: 'Light',  icon: Sun   },
                  { value: 'dark',   label: 'Dark',   icon: Moon  },
                ].map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => updateTheme(t.value)}
                    className={`py-3 px-3 border-2 rounded-xl flex flex-col items-center gap-1.5 text-xs font-bold transition-all ${
                      themePref === t.value
                        ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <t.icon className="w-5 h-5" />
                    {t.label}
                    {themePref === t.value && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 block" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Notifications */}
            <section className="mb-6">
              <SectionHeading icon={Bell} label="Notifications" />
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold">Email Notifications</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Receive updates about your account and parties</p>
                  </div>
                  <Toggle id="notif-email" checked={notifEmail} onChange={setNotifEmail} />
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold">Push Notifications</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Get notified when friends join your watch party</p>
                  </div>
                  <Toggle id="notif-push" checked={notifPush} onChange={setNotifPush} />
                </div>
              </div>
            </section>

            {/* Language */}
            <section className="mb-6">
              <SectionHeading icon={Info} label="Language & Region" />
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Preferred Language</label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                >
                  <option value="en">🇺🇸  English (default)</option>
                  <option value="es">🇪🇸  Español (Spanish)</option>
                  <option value="fr">🇫🇷  Français (French)</option>
                  <option value="hi">🇮🇳  हिन्दी (Hindi)</option>
                  <option value="de">🇩🇪  Deutsch (German)</option>
                  <option value="ja">🇯🇵  日本語 (Japanese)</option>
                </select>
              </div>
            </section>

            {/* Save General */}
            {settingsMsg && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs px-4 py-2.5 rounded-xl mb-3 font-semibold">
                <Check className="w-4 h-4" /> {settingsMsg}
              </div>
            )}
            {settingsErr && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs px-4 py-2.5 rounded-xl mb-3 font-semibold">
                <ShieldAlert className="w-4 h-4" /> {settingsErr}
              </div>
            )}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-600 to-luxury-roseDark hover:from-brand-500 hover:to-luxury-rose text-white font-bold rounded-xl shadow-lg shadow-brand-600/15 active:scale-[0.98] transition-all text-sm"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </form>

          {/* ── Change Password ── */}
          <section>
            <SectionHeading icon={Lock} label="Security" />
            <button
              type="button"
              onClick={() => setShowPwSection(s => !s)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" />
                Change Password
              </span>
              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showPwSection ? 'rotate-90' : ''}`} />
            </button>

            {showPwSection && (
              <form onSubmit={handleChangePassword} className="mt-3 space-y-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl animate-fade-in">
                {['currentPw', 'newPw', 'confirmPw'].map((field, i) => (
                  <div key={field} className="relative">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      {i === 0 ? 'Current Password' : i === 1 ? 'New Password' : 'Confirm New Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={field === 'currentPw' ? currentPw : field === 'newPw' ? newPw : confirmPw}
                        onChange={(e) => {
                          if (field === 'currentPw') setCurrentPw(e.target.value);
                          else if (field === 'newPw') setNewPw(e.target.value);
                          else setConfirmPw(e.target.value);
                        }}
                        placeholder="••••••••"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition"
                      />
                      {i === 2 && (
                        <button type="button" onClick={() => setShowPw(s => !s)}
                          className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {pwErr && <p className="text-xs text-red-500 font-semibold">{pwErr}</p>}
                {pwMsg && <p className="text-xs text-green-500 font-semibold">{pwMsg}</p>}
                <button type="submit"
                  className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-bold rounded-lg transition-colors">
                  Update Password
                </button>
              </form>
            )}
          </section>

          {/* ── About ── */}
          <section>
            <SectionHeading icon={Info} label="About" />
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2 text-xs text-slate-500">
              <div className="flex justify-between"><span>App Version</span><span className="font-mono font-bold text-slate-700 dark:text-slate-300">v1.0.0</span></div>
              <div className="flex justify-between"><span>Plan</span><span className="font-bold text-brand-500">{user?.subscriptionPlan || 'Free'}</span></div>
              <div className="flex justify-between"><span>Member Since</span><span className="font-semibold text-slate-700 dark:text-slate-300">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</span></div>
            </div>
          </section>

          {/* ── Danger Zone ── */}
          <section>
            <SectionHeading icon={Trash2} label="Danger Zone" />
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-red-500/30 text-red-500 hover:bg-red-500/5 font-bold rounded-xl text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete My Account
              </button>
            ) : (
              <div className="p-4 border-2 border-red-500/40 bg-red-500/5 rounded-xl animate-fade-in space-y-3">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">This action is permanent and cannot be undone.</p>
                <p className="text-xs text-slate-500">Type <span className="font-mono font-bold text-red-500">DELETE</span> to confirm.</p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full px-3 py-2 border border-red-500/30 bg-white dark:bg-slate-900 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 font-mono"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                    className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteInput !== 'DELETE'}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-colors"
                    onClick={() => alert('Account deletion request submitted. In a real app this calls DELETE /api/auth/account.')}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </aside>
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, token, logout, updateProfileOptions, uploadAvatar } = useAuth();
  const { theme } = useTheme();

  const [videos, setVideos]               = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [activeRoomId, setActiveRoomId]   = useState(null);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  const API_BASE = 'http://localhost:5000/api';

  useEffect(() => {
    async function fetchVideos() {
      try {
        const res = await fetch(`${API_BASE}/videos`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setVideos(data.videos);
          if (data.videos.length > 0) setSelectedVideo(data.videos[0]);
        }
      } catch (err) {
        console.error('Failed to load videos.', err);
      }
    }
    fetchVideos();
  }, [token]);

  const handleDownloadVideo = async (videoId) => {
    setDownloadError(null);
    setDownloadSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/videos/${videoId}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDownloadSuccess(data.message);
        const a = document.createElement('a');
        a.href = data.videoUrl;
        a.download = `video-${videoId}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setDownloadError(data.message);
      }
    } catch {
      setDownloadError('Could not process download request.');
    }
  };

  const handleStartWatchParty = () => {
    const randomRoomId = `room-${Math.random().toString(36).substring(2, 8)}`;
    setActiveRoomId(randomRoomId);
  };

  const getPlanBadgeClass = (plan) => {
    switch (plan) {
      case 'Gold':   return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30';
      case 'Silver': return 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30';
      case 'Bronze': return 'bg-amber-600/20 text-amber-700 dark:text-amber-500 border border-amber-600/30';
      default:       return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20';
    }
  };

  if (showSubscription) return <Subscription onBack={() => setShowSubscription(false)} />;

  if (activeRoomId && selectedVideo) {
    return (
      <div className="max-w-7xl mx-auto p-4 animate-fade-in">
        <WatchPartyRoom roomId={activeRoomId} video={selectedVideo} onLeave={() => setActiveRoomId(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 transition-colors duration-300 text-slate-100 pb-12">

      {/* Settings Drawer */}
      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        token={token}
        updateProfileOptions={updateProfileOptions}
        uploadAvatar={uploadAvatar}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WPLogo size={36} />
          <span className="font-extrabold text-lg text-gradient">Watch Party</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="Account Settings"
            id="settings-btn"
          >
            <Settings className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>

          <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
            <div className="relative">
              {user?.avatarUrl ? (
                <img
                  src={`http://localhost:5000${user.avatarUrl}`}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover border border-brand-500/30"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm">
                  {user?.username?.[0]}
                </div>
              )}
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold">{user?.username}</span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border self-start mt-0.5 tracking-wider ${getPlanBadgeClass(user?.subscriptionPlan)}`}>
                {user?.subscriptionPlan} Tier
              </span>
            </div>

            <button
              onClick={() => setShowSubscription(true)}
              className="text-xs font-bold text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 bg-brand-500/5 hover:bg-brand-500/10 px-3 py-1.5 rounded-lg border border-brand-500/10 transition-all"
            >
              Upgrade
            </button>

            <button
              onClick={logout}
              className="p-2 text-red-500 hover:bg-red-500/5 rounded-xl transition-all"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 lg:p-6 flex flex-col gap-6">

        {/* Video Player */}
        <div className="flex flex-col gap-6">
          {selectedVideo ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <video
                src={selectedVideo.url}
                controls
                poster={selectedVideo.thumbnail}
                className="w-full aspect-video rounded-xl object-contain bg-black shadow-inner"
              />
              <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleStartWatchParty}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 shadow-md shadow-brand-500/15 hover:shadow-brand-500/25 active:scale-95 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Host Party
                </button>
                <button
                  onClick={() => handleDownloadVideo(selectedVideo.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold active:scale-95 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>

              {downloadError && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 text-xs mt-4 animate-shake">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Download Limit Reached:</span> {downloadError}
                    <button onClick={() => setShowSubscription(true)} className="text-brand-500 dark:text-brand-400 hover:underline font-bold block mt-1">
                      Click here to upgrade your plan.
                    </button>
                  </div>
                </div>
              )}
              {downloadSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl text-green-700 dark:text-green-400 text-xs mt-4">
                  {downloadSuccess}
                </div>
              )}
              <CommentsSection videoId={selectedVideo.id} />
            </div>
          ) : (
            <div className="aspect-video bg-slate-950 rounded-2xl flex items-center justify-center text-slate-500">
              Loading library assets...
            </div>
          )}
        </div>



      </main>
    </div>
  );
}
