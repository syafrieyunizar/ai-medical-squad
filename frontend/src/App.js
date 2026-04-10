import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import "@/App.css";
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Stethoscope, 
  Settings, 
  LogOut, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft,
  Upload,
  X,
  Copy,
  MessageCircle,
  Check,
  AlertTriangle,
  Loader2,
  Key,
  FileText,
  Activity,
  ClipboardList,
  Pill,
  Send,
  UserPlus,
  Trash2,
  Plus,
  Shield,
  Clock,
  Calendar
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEFAULT_STATUS_GENERALIS = `Kepala/Leher :
Konj. pucat (-) Sklera ikterik (-) 

Thorax: 
Paru : 
Retraksi (-)
SDV +/+
Wh    Rh
-/-      -/-
-/-      -/-
-/-      -/-

Jantung: 
S1 dan S2 reguler, murmur (-), gallop (-) 

Abd
I : Distensi (-)
A : BU (+) 
P : Timpani (+)
P : Nyeri tekan 
-/-/-
-/-/-
-/-/- 

Ekstremitas
Akral Hangat 
+/+
+/+
Edema (-)`;

// Whitelist Context
const WhitelistContext = createContext(null);

export const useWhitelist = () => useContext(WhitelistContext);

// Helper function untuk mengubah file gambar ke Base64
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve({
    mimeType: file.type,
    base64: reader.result.split(',')[1]
  });
  reader.onerror = error => reject(error);
});

// Generate dengan Gemini API
const generateWithGemini = async (apiKey, systemInstruction, userText, images = []) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  let parts = [{ text: userText }];
  
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({
        inlineData: { mimeType: img.mimeType, data: img.base64 }
      });
    });
  }

  const payload = {
    contents: [{ parts: parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  let retries = 3;
  let delay = 1000;
  while (retries > 0) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error('API Key tidak valid atau tidak memiliki akses. Silakan periksa API Key di Settings.');
        }
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

// Access Denied Page
function AccessDeniedPage({ onSignOut }) {
  return (
    <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center p-8" data-testid="access-denied-page">
      <div className="text-center space-y-8 max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 mb-4">
          <Shield className="w-10 h-10" strokeWidth={1.5} />
        </div>
        <h1 className="font-heading text-3xl font-medium text-[#1A2E26]">
          Akses Ditolak
        </h1>
        <p className="text-[#5C6B64] text-lg leading-relaxed">
          Anda tidak terdaftar sebagai pengguna. Harap hubungi admin untuk mendapatkan akses.
        </p>
        <Button
          data-testid="access-denied-signout-btn"
          onClick={onSignOut}
          className="h-14 px-12 bg-red-600 hover:bg-red-700 text-white font-bold text-lg"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

// Whitelist Management Modal
function WhitelistModal({ open, onClose }) {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [bypass, setBypass] = useState({ is_active: false, expiry_datetime: null });
  const [showDurationDialog, setShowDurationDialog] = useState(false);
  const [showBypassDurationDialog, setShowBypassDurationDialog] = useState(false);
  const [durationType, setDurationType] = useState('lifetime');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [emailsRes, bypassRes] = await Promise.all([
        fetch(`${API}/whitelist/emails`),
        fetch(`${API}/whitelist/bypass`)
      ]);
      if (emailsRes.ok) setEmails(await emailsRes.json());
      if (bypassRes.ok) setBypass(await bypassRes.json());
    } catch (err) {
      console.error('Error fetching whitelist data:', err);
    }
  }, []);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const handleAddEmail = () => {
    if (!newEmail.trim() || !newEmail.includes('@')) return;
    setPendingEmail(newEmail.trim());
    setShowDurationDialog(true);
  };

  const confirmAddEmail = async () => {
    setLoading(true);
    try {
      let expiryDatetime = null;
      if (durationType === 'custom' && customDate && customTime) {
        expiryDatetime = new Date(`${customDate}T${customTime}`).toISOString();
      }
      
      await fetch(`${API}/whitelist/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, expiry_datetime: expiryDatetime })
      });
      
      setNewEmail('');
      setPendingEmail('');
      setShowDurationDialog(false);
      setDurationType('lifetime');
      setCustomDate('');
      setCustomTime('');
      fetchData();
    } catch (err) {
      console.error('Error adding email:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmail = async (email) => {
    if (!window.confirm(`Hapus ${email} dari whitelist?`)) return;
    try {
      await fetch(`${API}/whitelist/emails/${encodeURIComponent(email)}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error('Error deleting email:', err);
    }
  };

  const handleBypassToggle = (checked) => {
    if (checked) {
      setShowBypassDurationDialog(true);
    } else {
      updateBypass(false, null);
    }
  };

  const confirmBypassEnable = async () => {
    let expiryDatetime = null;
    if (durationType === 'custom' && customDate && customTime) {
      expiryDatetime = new Date(`${customDate}T${customTime}`).toISOString();
    }
    await updateBypass(true, expiryDatetime);
    setShowBypassDurationDialog(false);
    setDurationType('lifetime');
    setCustomDate('');
    setCustomTime('');
  };

  const updateBypass = async (isActive, expiryDatetime) => {
    try {
      await fetch(`${API}/whitelist/bypass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive, expiry_datetime: expiryDatetime })
      });
      fetchData();
    } catch (err) {
      console.error('Error updating bypass:', err);
    }
  };

  const formatExpiry = (expiry) => {
    if (!expiry) return 'Lifetime';
    const date = new Date(expiry);
    return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#2C4A3B]" />
            Whitelist Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Bypass Toggle */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Bypass Mode
                </Label>
                <p className="text-xs text-amber-700">
                  {bypass.is_active 
                    ? `Aktif - Semua user dapat mengakses${bypass.expiry_datetime ? ` (sampai ${formatExpiry(bypass.expiry_datetime)})` : ' (Lifetime)'}`
                    : 'Nonaktif - Hanya whitelist yang dapat akses'}
                </p>
              </div>
              <Switch
                data-testid="bypass-toggle"
                checked={bypass.is_active}
                onCheckedChange={handleBypassToggle}
              />
            </div>
          </div>

          {/* Add Email */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[#1A2E26]">Tambah Email ke Whitelist</Label>
            <div className="flex gap-2">
              <Input
                data-testid="whitelist-email-input"
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1 bg-[#F8F7F3] border-[#E3E0D8]"
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
              />
              <Button
                data-testid="add-whitelist-btn"
                onClick={handleAddEmail}
                disabled={!newEmail.includes('@')}
                className="bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Email List */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[#1A2E26]">Email Terdaftar ({emails.length})</Label>
            <div className="max-h-60 overflow-y-auto border border-[#E3E0D8] rounded-lg bg-[#F8F7F3]">
              {emails.length === 0 ? (
                <p className="p-4 text-center text-[#5C6B64] text-sm">Belum ada email terdaftar</p>
              ) : (
                emails.map((item, idx) => (
                  <div key={idx} className={`flex items-center justify-between p-3 ${idx !== emails.length - 1 ? 'border-b border-[#E3E0D8]' : ''}`}>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${item.is_active ? 'text-[#1A2E26]' : 'text-[#5C6B64] line-through'}`}>
                        {item.email}
                      </p>
                      <p className="text-xs text-[#5C6B64] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatExpiry(item.expiry_datetime)}
                        {!item.is_active && <span className="text-red-500 ml-2">(Expired)</span>}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteEmail(item.email)}
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Duration Dialog for Email */}
        <Dialog open={showDurationDialog} onOpenChange={setShowDurationDialog}>
          <DialogContent className="max-w-sm bg-white">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Durasi Akses</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-[#5C6B64]">Pilih durasi akses untuk <strong>{pendingEmail}</strong></p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[#F8F7F3]">
                  <input
                    type="radio"
                    name="duration"
                    value="lifetime"
                    checked={durationType === 'lifetime'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="w-4 h-4 text-[#2C4A3B]"
                  />
                  <span className="text-sm font-medium">Lifetime (Sampai dihapus manual)</span>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[#F8F7F3]">
                  <input
                    type="radio"
                    name="duration"
                    value="custom"
                    checked={durationType === 'custom'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="w-4 h-4 text-[#2C4A3B]"
                  />
                  <span className="text-sm font-medium">Custom (Pilih tanggal & waktu)</span>
                </label>
              </div>

              {durationType === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-[#5C6B64]">Tanggal</Label>
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="bg-[#F8F7F3] border-[#E3E0D8]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#5C6B64]">Waktu</Label>
                    <Input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="bg-[#F8F7F3] border-[#E3E0D8]"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowDurationDialog(false)} className="flex-1">
                  Batal
                </Button>
                <Button 
                  onClick={confirmAddEmail} 
                  disabled={loading || (durationType === 'custom' && (!customDate || !customTime))}
                  className="flex-1 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tambah'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Duration Dialog for Bypass */}
        <Dialog open={showBypassDurationDialog} onOpenChange={setShowBypassDurationDialog}>
          <DialogContent className="max-w-sm bg-white">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Durasi Bypass</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-[#5C6B64]">Pilih durasi untuk bypass mode</p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[#F8F7F3]">
                  <input
                    type="radio"
                    name="bypassDuration"
                    value="lifetime"
                    checked={durationType === 'lifetime'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="w-4 h-4 text-[#2C4A3B]"
                  />
                  <span className="text-sm font-medium">Lifetime (Sampai dimatikan manual)</span>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-[#F8F7F3]">
                  <input
                    type="radio"
                    name="bypassDuration"
                    value="custom"
                    checked={durationType === 'custom'}
                    onChange={(e) => setDurationType(e.target.value)}
                    className="w-4 h-4 text-[#2C4A3B]"
                  />
                  <span className="text-sm font-medium">Custom (Pilih tanggal & waktu)</span>
                </label>
              </div>

              {durationType === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-[#5C6B64]">Tanggal</Label>
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="bg-[#F8F7F3] border-[#E3E0D8]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-[#5C6B64]">Waktu</Label>
                    <Input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="bg-[#F8F7F3] border-[#E3E0D8]"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowBypassDurationDialog(false)} className="flex-1">
                  Batal
                </Button>
                <Button 
                  onClick={confirmBypassEnable}
                  disabled={durationType === 'custom' && (!customDate || !customTime)}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  Aktifkan Bypass
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// Login Component
function LoginPage({ onLogin, onSignOut }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const redirectUrl = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl }
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Gagal login dengan Google');
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setPasswordLoading(true);
    setPasswordError('');
    try {
      const res = await fetch(`${API}/whitelist/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (!res.ok) {
        throw new Error('Password tidak valid');
      }
      
      setShowPasswordModal(false);
      setPassword('');
      setShowWhitelistModal(true);
    } catch (err) {
      setPasswordError(err.message || 'Password tidak valid');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img 
          src="https://images.unsplash.com/photo-1636089944703-24d36e540e63?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwc3RldGhvc2NvcGUlMjBtaW5pbWFsfGVufDB8fHx8MTc3NTc1MzU4OHww&ixlib=rb-4.1.0&q=85"
          alt="Medical stethoscope"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#F8F7F3]/30"></div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#F8F7F3]">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2C4A3B] text-white mb-4">
              <Stethoscope className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h1 className="font-heading text-4xl font-medium tracking-tight text-[#1A2E26]">
              AI Medical Squad
            </h1>
            <p className="text-[#5C6B64] text-lg">
              Asisten Dokumentasi SOAP untuk Dokter
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-4 bg-white p-8 rounded-2xl border border-[#E3E0D8] shadow-sm">
            <div className="text-center space-y-1">
              <h2 className="font-heading text-xl font-medium text-[#1A2E26]">Selamat Datang</h2>
              <p className="text-sm text-[#5C6B64]">Masuk untuk melanjutkan ke aplikasi</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              data-testid="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-gray-50 text-[#1A2E26] border border-[#E3E0D8] font-medium text-base gap-3"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Masuk dengan Google
            </Button>

            <Button
              data-testid="add-whitelist-login-btn"
              onClick={() => setShowPasswordModal(true)}
              variant="outline"
              className="w-full h-10 border-[#E3E0D8] text-[#5C6B64] hover:bg-[#F8F7F3] font-medium text-sm gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Add Whitelist
            </Button>

            <p className="text-xs text-center text-[#5C6B64]">
              Dengan masuk, Anda menyetujui penggunaan data untuk keperluan aplikasi medis.
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-[#5C6B64]">
            Powered by Gemini AI
          </p>
        </div>
      </div>

      {/* Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2C4A3B]" />
              Admin Access
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm text-[#1A2E26]">Password Admin</Label>
              <Input
                data-testid="admin-password-input"
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className="bg-[#F8F7F3] border-[#E3E0D8]"
              />
            </div>
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPasswordModal(false)} className="flex-1">
                Batal
              </Button>
              <Button 
                data-testid="verify-password-btn"
                onClick={handlePasswordSubmit}
                disabled={passwordLoading || !password}
                className="flex-1 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"
              >
                {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verifikasi'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Whitelist Modal */}
      <WhitelistModal open={showWhitelistModal} onClose={() => setShowWhitelistModal(false)} />
    </div>
  );
}

// API Key Setup Component
function ApiKeySetup({ user, onComplete, onSignOut }) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError('API Key tidak boleh kosong');
      return;
    }
    
    localStorage.setItem(`gemini_api_key_${user.id}`, apiKey);
    onComplete(apiKey);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#F8F7F3]" data-testid="api-key-setup">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#2C4A3B] text-white mb-4">
            <Key className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-[#1A2E26]">
            Setup API Key
          </h1>
          <p className="text-[#5C6B64]">
            Masukkan Gemini API Key Anda untuk melanjutkan
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-2xl border border-[#E3E0D8] shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-[#1A2E26] font-medium">Gemini API Key</Label>
            <Input
              id="apiKey"
              data-testid="gemini-api-key-input"
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-12 bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30"
            />
            <p className="text-xs text-[#5C6B64]">
              Dapatkan API Key dari{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[#2C4A3B] underline">
                Google AI Studio
              </a>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            data-testid="submit-api-key-btn"
            type="submit"
            className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white font-medium"
          >
            Simpan & Lanjutkan
          </Button>
        </form>

        <div className="text-center space-y-3">
          <p className="text-xs text-[#5C6B64]">
            API Key disimpan secara lokal dan tidak dikirim ke server kami.
          </p>
          <Button
            data-testid="signout-apikey-btn"
            variant="ghost"
            onClick={onSignOut}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function MainApp({ user, apiKey, onLogout, onChangeApiKey, checkWhitelist }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Patient Identity
  const [patientIdentity, setPatientIdentity] = useState('');
  
  // Anam State
  const [anamInput, setAnamInput] = useState('');
  const [anamNarrative, setAnamNarrative] = useState('');
  const [anamSaran, setAnamSaran] = useState('');
  const [anamAlert, setAnamAlert] = useState('');
  const [isAnamLoading, setIsAnamLoading] = useState(false);
  const [isAnamFollowUp, setIsAnamFollowUp] = useState(false);

  // Oppa State
  const [oppaMode, setOppaMode] = useState('AI');
  const [vitals, setVitals] = useState({
    kes: 'CM', gcs: 'E4V5M6', td: '120/80', n: '80', rr: '20', t: '36.5', spo2: '98% RA'
  });
  const [abnormalFinding, setAbnormalFinding] = useState('');
  const [oppaImages, setOppaImages] = useState([]);
  const [oppaOutput, setOppaOutput] = useState('');
  const [isOppaLoading, setIsOppaLoading] = useState(false);
  const [manualStatusGeneralis, setManualStatusGeneralis] = useState(DEFAULT_STATUS_GENERALIS);

  // Diag State
  const [diagText, setDiagText] = useState('');
  const [diagInterpretation, setDiagInterpretation] = useState('');
  const [diagImages, setDiagImages] = useState([]);
  const [isDiagGenerated, setIsDiagGenerated] = useState(false);
  const [isDiagLoading, setIsDiagLoading] = useState(false);

  // Palui State
  const [paluiMode, setPaluiMode] = useState('AI');
  const [paluiInput, setPaluiInput] = useState('');
  const [paluiOutput, setPaluiOutput] = useState('');
  const [isPaluiLoading, setIsPaluiLoading] = useState(false);
  const [manualPalui, setManualPalui] = useState('');
  
  // Settings State
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [greetingTemplate, setGreetingTemplate] = useState('Assalamualaikum wr.wb.\nSelamat {waktu} dokter\nSaya dr. [Nama]\nMohon maaf mengganggu waktunya dok.\nIzin lapor pasien IGD :');
  const [autotexts, setAutotexts] = useState([
    { short: 'panto', long: 'Inj. Pantoprazole 40mg' },
    { short: 'cpg 4', long: 'PO. Clopidogrel 300mg (4 tab)' },
    { short: 'aspilet 4', long: 'PO. Aspilet 320mg (4 tab)' },
    { short: 'ns', long: 'IVFD. NaCl 0.9%' }
  ]);
  const [newAutoShort, setNewAutoShort] = useState('');
  const [newAutoLong, setNewAutoLong] = useState('');

  // Final SOAP State
  const [finalSoap, setFinalSoap] = useState('');
  const [ezzyError, setEzzyError] = useState('');

  // Load/Save localStorage
  useEffect(() => {
    const savedAuto = localStorage.getItem('aiSquad_autotexts');
    const savedGreeting = localStorage.getItem('aiSquad_greeting');
    const savedWa = localStorage.getItem('aiSquad_wa');
    if (savedAuto) setAutotexts(JSON.parse(savedAuto));
    if (savedGreeting) setGreetingTemplate(savedGreeting);
    if (savedWa) setWhatsappNumber(savedWa);
  }, []);

  useEffect(() => {
    localStorage.setItem('aiSquad_autotexts', JSON.stringify(autotexts));
    localStorage.setItem('aiSquad_greeting', greetingTemplate);
    localStorage.setItem('aiSquad_wa', whatsappNumber);
  }, [autotexts, greetingTemplate, whatsappNumber]);

  // Whitelist check on actions
  const withWhitelistCheck = async (action) => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    action();
  };

  // New Session Handler
  const handleNewSession = () => {
    withWhitelistCheck(() => {
      if(window.confirm("Yakin ingin memulai sesi pasien baru? Semua data saat ini akan dihapus.")) {
        setCurrentStep(1);
        setPatientIdentity('');
        setAnamInput('');
        setAnamNarrative('');
        setAnamSaran('');
        setAnamAlert('');
        setIsAnamFollowUp(false);
        setOppaMode('AI');
        setVitals({ kes: 'CM', gcs: 'E4V5M6', td: '120/80', n: '80', rr: '20', t: '36.5', spo2: '98% RA' });
        setAbnormalFinding('');
        setOppaImages([]);
        setOppaOutput('');
        setManualStatusGeneralis(DEFAULT_STATUS_GENERALIS);
        setDiagText('');
        setDiagInterpretation('');
        setDiagImages([]);
        setIsDiagGenerated(false);
        setPaluiMode('AI');
        setPaluiInput('');
        setPaluiOutput('');
        setManualPalui('');
        setFinalSoap('');
        setEzzyError('');
      }
    });
  };

  // ANAM Handler
  const handleAnamProcess = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    if (!anamInput.trim()) return;
    setIsAnamLoading(true);
    setAnamAlert('');
    
    let warnings = [];
    const lowerInput = anamInput.toLowerCase();
    const fullContext = (anamNarrative + " " + lowerInput).toLowerCase();
    if (!fullContext.includes('rpd') && !fullContext.match(/riwayat.*dahulu/)) warnings.push("RPD belum ditanyakan.");
    if (!fullContext.includes('rpk') && !fullContext.match(/riwayat.*keluarga/)) warnings.push("RPK belum ditanyakan.");
    if (!fullContext.includes('alergi')) warnings.push("Riwayat Alergi belum dipastikan!");

    if (warnings.length > 0) {
      setAnamAlert(warnings.join(' '));
    }

    const systemPrompt = `Anggota pertama yaitu Anam
Peran Kamu:
Kamu adalah seorang dokter umum yang sangat terampil dalam mengolah data anamnesis pasien dan menyusunnya ke dalam format SOAP, khususnya pada bagian Subjective (S). Kamu juga ahli dalam mengidentifikasi potensi kekurangan atau area yang perlu digali lebih dalam pada anamnesis, demi tercapainya ketepatan diagnosis.

Input saya:
Saya akan memberikan serangkaian keluhan atau poin-poin hasil anamnesis awal dari pasien. Poin-poin ini bisa dalam bentuk daftar (bullet points) atau kalimat tunggal yang bersambung.

Tugas Kamu :

1. Menarasikan anamnesis
Susun kembali poin-poin yang saya berikan menjadi sebuah narasi anamnesis yang singkat, padat, jelas, terstruktur dan kronologis. Gunakan bahasa professional yang layak masuk dalam rekam medis.

2. Memberikan Analisis & Saran Perbaikan Anamnesis.
Setelah menyajikan bagian Subjective (S) yang terstruktur, buatlah sebuah bagian baru dengan judul:
"Analisis & Saran Penggalian Anamnesis Lebih Lanjut:"
    - Di bagian ini, berdasarkan keluhan awal yang saya berikan, identifikasi dan sebutkan poin-poin informasi penting atau pertanyaan spesifik yang sebaiknya saya tanyakan lebih lanjut kepada pasien untuk mendapatkan anamnesis yang lebih komprehensif, mendalam, dan mendukung penegakan diagnosis banding.
    - Berikan saran pertanyaan yang relevan untuk menggali aspek-aspek penting dari keluhan utama yang mungkin terlewat (misalnya, jika saya hanya sebut "batuk", kamu sarankan untuk tanya durasi, dahak (warna, konsistensi, volume, darah), pemicu, riwayat alergi, dll.).
    - Berikan saran pertanyaan yang relevan juga untuk menggali aspek-aspek penting untuk penegakan diagnosis banding (misalnya, jika saya hanya menyebutkan "demam", kamu sarankan untuk menanyakan apakah ada manifestasi perdarahan, gejala gastrointestinal, infeksi sistem saluran kemih, disertai dada berdebar apa tidak). Jika ada pernyataan user yang kurang lengkap, arahkan menuju ke 1 diagnosis utama.
    - Buat format saran menjadi mudah dibaca, terpisah dengan enter yang jelas, dan dikelompokkan per topik. Judul topik tidak perlu diberi asterisk (*), cukup diakhiri tanda titik dua (:), lalu gunakan strip (-) untuk poin pertanyaannya.

Contoh format saran:
Kualitas dan Kuantitas Muntah:
- Tanyakan frekuensi muntah dalam sehari.
- Tanyakan isi muntahan, apakah berisi sisa makanan, cairan berwarna kuning kehijauan (empedu), atau ada darah (hematemesis).
- Tanyakan apakah muntah menyemprot (proyektil) yang bisa mengarah pada peningkatan tekanan intrakranial.

3. Membuat narasi revisi
Saya akan memberikan input ulang anamnesis tambahan sesuai dengan analisis pada nomor 2. (dan mungkin akan saya tambahkan hasil pemeriksaan fisik, dan hasil penunjang).
Kamu harus :
    - Menyusun kembali anamnesis seperti poin-poin yang saya berikan sebelumnya pada "anamnesis awal", digabungkan dengan "anamnesis lanjutan"
    - Buatlah dengan rapi, agar saya bisa menyalin dan tempel pada bagian S di SOAP saya nantinya

Kriteria penulisan anamnesis :

1. Anamnesis mudah dibaca adalah yang singkat, padat, namun tetap dengan narasi yang jelas dan sesuai alur.
2. Jangan sebutkan disangkal. Gunakan (-). Misal: Pasien tidak muntah, kamu harus tulis Muntah (-)
3. Jangan gunakan "yang lalu", tapi "SMRS" (Sebelum masuk rumah sakit)
4. Jangan jabarkan singkatan, misal BAB, BAK, SMRS, RPD, RPK, dll. Kamu harus tulis BAB saja, tidak perlu menuliskan Buang Air Besar (BAB) 
5. Saya mungkin saja menggunakan bahasa daerah seperti bahasa Jawa atau bahasa Banjar. Mohon diterjemahkan ke dalam bahasa Indonesia dahulu sebelum memberikan output.
6. Gunakan tanda - disetiap poin anamnesis. Dipisahkan sesuai sistem
7. Wajib menuliskan RPD atau RPK.
8. Saya mungkin tidak akan menjawab semua pertanyaan lanjutan yang kamu berikan.
9. JANGAN MENGGUNAKAN TANDA ASTERISK (*) ATAU MARKDOWN APAPUN di seluruh output, baik pada bagian narasi maupun pada bagian saran. Gunakan plain text sepenuhnya.
10. Kriteria-kriteria ini bisa saja saya update atau ubah sewaktu waktu.

Format anamnesis awal atau anamnesis lanjutannya adalah sebagai berikut :

- Pasien datang dengan keluhan [keluhan utama]...
- [Kualitas BAB dan BAK]
- Keluhan disertai [keluhan penyerta]
- [keluhan penyerta lain sesuaikan dengan sistem organ]
- [Riwayat penting lain (pekerjaan/ aktifitas lain) yang berguna untuk menegakkan diagnosis]

RPD : [Riwayat penyakit dahulu pasien]
RPK : [Riwayat penyakit keluarga (Hanya ditulis jika ada, jika tidak ada data, tidak perlu dituliskan sama sekali)(Jika ada konfirmasi bahwa tidak ada alergi, maka tuliskan Tidak ada)]
Riw. Alergi : [Riwayat alergi, (Hanya ditulis jika ada, jika tidak ada data, tidak perlu dituliskan sama sekali)(Jika ada konfirmasi bahwa tidak ada alergi, maka tuliskan Tidak ada)]

Contoh keluaran:
- Pasien datang dengan keluhan demam 3 hari SMRS. Muncul mendadak, terus menerus. Demam dominan pada malam hari.
- BAB dan BAK dalam batas normal
- Keluhan disertai mual (+) muntah (+) 2x, berisi makanan yang dimakan sejak hari ini
- Batuk (+) pilek (-)
- Nyeri pada pinggang sejak ±1 minggu
- Pasien bekerja sebagai petani, dan sering minum air mentah saat di sawah.

RPD :
HT (+) terkontrol, amlodipin 1x5mg. DM (-)

Riw. Alergi :
Udang (+), gatal gatal

**Catatan khusus**
- Karena tidak ada data RPK, maka RPK tidak ditulis sama sekali
- Tidak ada kalimat pembuka apapun, langsung saya tuliskan sesuai dengan format keluaran/output`;

    let userPromptText = `Keluhan awal pasien: ${anamInput}`;
    if (isAnamFollowUp) {
      userPromptText = `Narasi Anamnesis saat ini:\n${anamNarrative}\n\nTambahan informasi / Jawaban dokter atas analisa sebelumnya:\n${anamInput}\n\nTUGAS: Integrasikan informasi tambahan ini ke dalam narasi anamnesis di atas. Buat narasi yang baru dan utuh sesuai format. Setelah itu, pastikan untuk menuliskan bagian "Analisis & Saran Penggalian Anamnesis Lebih Lanjut:" seperti yang diinstruksikan.`;
    }

    try {
      const result = await generateWithGemini(apiKey, systemPrompt, userPromptText);
      
      const splitRegex = /(?:\*\*|")?Analisis & Saran Penggalian Anamnesis Lebih Lanjut:?(?:\*\*|")?/i;
      const parts = result.split(splitRegex);
      
      setAnamNarrative(parts[0].trim());
      
      if (parts.length > 1) {
        setAnamSaran(parts[1].replace(/^[:*\s]+/, '').trim());
      } else {
        setAnamSaran('');
      }

      setAnamInput('');
      setIsAnamFollowUp(true);

    } catch (err) {
      setAnamNarrative("Gagal menghubungi AI Anam.\nError: " + err.message);
    } finally {
      setIsAnamLoading(false);
    }
  };

  // OPPA Handlers
  const handleOppaImageUpload = async (e) => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    const files = Array.from(e.target.files);
    const newImages = await Promise.all(files.map(async file => {
      const base64Data = await fileToBase64(file);
      return {
        preview: URL.createObjectURL(file),
        ...base64Data
      };
    }));
    setOppaImages([...oppaImages, ...newImages]);
  };

  const handleOppaProcessAI = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    setIsOppaLoading(true);
    const baseTemplate = `Kepala/Leher:\nKonj. pucat (-), Sklera ikterik (-)\n\nThorax:\nParu:\nRetraksi (-)\nSDV +/+\nWh -/-\nRh -/-\n\nJantung: S1 S2 reguler, murmur (-), gallop (-)\n\nAbd:\nI: Distensi (-)\nA: BU (+)\nP: Timpani (+)\nP: Nyeri tekan (-)\n\nEkstremitas:\nAkral Hangat +/+\nEdema -/-`;

    const systemPrompt = `Anda adalah Oppa, AI Medical Squad pemeriksa fisik.
Tugas utama Anda:
1. Modifikasi Template Pemeriksaan Fisik Normal berikut berdasarkan input "Abnormal finding".
2. Jangan gunakan markdown (**). Kembalikan hanya template yang dimodifikasi.
Template Normal:\n${baseTemplate}`;

    let userPromptText = `Abnormal finding: ${abnormalFinding}`;

    if (oppaImages.length > 0) {
      userPromptText += `\n\nIni adalah foto klinis pasien, identifikasi bagian tubuh, lalu berikan keterangan klinis sesuai format medis berikut di bagian bawah hasil fisik Anda (setelah Ekstremitas).
      
      Format jika kasus luka/trauma:
      Status Lokalis :
      (Part tubuh)
      Look : (apa yang diliat)
      Feel : (Apa yang diraba)
      Move : Limited / Normal
      
      Atau jika berupa ujud kelainan kulit (UKK):
      Status Dermatologis :
      Pada regio X terdapat krusta multiple, diatas makula eritema, dan seterusnya.`;
    }

    try {
      const result = await generateWithGemini(apiKey, systemPrompt, userPromptText, oppaImages);
      setOppaOutput(result.replace(/\*/g, '').trim());
    } catch (err) {
      setOppaOutput("Gagal menghubungi AI Oppa.\nError: " + err.message);
    } finally {
      setIsOppaLoading(false);
    }
  };

  // DIAG Handlers
  const handleDiagImageUpload = async (e) => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    const files = Array.from(e.target.files);
    const newImages = await Promise.all(files.map(async file => {
      const base64Data = await fileToBase64(file);
      return {
        preview: URL.createObjectURL(file),
        ...base64Data
      };
    }));
    setDiagImages([...diagImages, ...newImages]);
  };

  const handleDiagProcess = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    setIsDiagLoading(true);
    setDiagInterpretation('');
    
    const currentOppaData = oppaMode === 'AI' ? (oppaOutput || abnormalFinding) : manualStatusGeneralis;

    let userPromptText = `Data Anamnesis:\n${anamNarrative || anamInput}\n\nData Pemeriksaan Fisik:\n${currentOppaData}`;
    
    if (diagImages.length > 0) {
      userPromptText += `\n\nSaya juga melampirkan foto penunjang medis (EKG/Radiologi/Lab). Berikan interpretasi singkat dari penunjang tersebut, dan formulasikan ke dalam diagnosis.`;
    }

    const systemPrompt = `Anda adalah Diag, AI penentu diagnosis.
Berdasarkan Anamnesis, Fisik, dan Penunjang (jika ada), berikan interpretasi klinis dan diagnosis.

ATURAN KETAT:
1. Anda WAJIB memisahkan Interpretasi dan Diagnosis dengan pembatas yang tegas yaitu: ===DIAGNOSIS===
2. Format output harus persis seperti ini:
Interpretasi: [Tuliskan interpretasi temuan klinis dan penunjang secara padat di sini]
===DIAGNOSIS===
[Diagnosis Utama] dd [Diagnosis Banding] + [Diagnosis Simtomatik] ec [Etiologi]

3. Bagian diagnosis (setelah pembatas) HARUS SATU BARIS, tanpa asterisk/markdown, dan tanpa nomor.
Contoh diagnosis yang benar: NSTEACS dd Dispepsia Sindrom + Obs. Dispneu ec Edema paru dd PPOK Eksaserbasi akut`;

    try {
      const result = await generateWithGemini(apiKey, systemPrompt, userPromptText, diagImages);
      
      const parts = result.replace(/\*/g, '').split('===DIAGNOSIS===');
      if (parts.length > 1) {
        setDiagInterpretation(parts[0].trim());
        setDiagText(parts[1].trim());
      } else {
        setDiagInterpretation('');
        setDiagText(parts[0].trim());
      }
      
      setIsDiagGenerated(true);
    } catch (err) {
      setDiagText("Gagal generate diagnosis.\nError: " + err.message);
    } finally {
      setIsDiagLoading(false);
    }
  };

  // PALUI Handler
  const handlePaluiProcess = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    if (!paluiInput.trim()) return;
    setIsPaluiLoading(true);
    
    let processedText = paluiInput.toLowerCase();
    autotexts.forEach(auto => {
      const regex = new RegExp(`\\b${auto.short.toLowerCase()}\\b`, 'gi');
      processedText = processedText.replace(regex, auto.long);
    });

    const systemPrompt = `Anda adalah Palui, AI Planning.
Rapikan instruksi terapi ini menjadi format baku.
ATURAN KETAT:
1. Jangan tulis infus, tulis IVFD. 
2. Jangan tulis injeksi, Tulis Inj.
3. Urutan penulisan HARUS: IVFD, Injeksi, Obat oral (PO), baru diikuti Terapi non farmakologi (seperti KIE, Observasi, dsb).
4. JANGAN gunakan header kategori (seperti TERAPI FARMAKOLOGI atau TERAPI NON-FARMAKOLOGI).
5. JANGAN gunakan penomoran angka (1. 2. 3.).
6. JANGAN gunakan format markdown (** atau *).
7. Hanya kembalikan teks hasil format terapi per baris (di-enter), tanpa kalimat pembuka atau penutup.

Contoh output yang BENAR:
IVFD. RL 20 tpm
Inj. Pantoprazole 40mg
Inj. Ondancetron 4mg
Inj. Ketorolac 30mg
PO. Sucralfate syr 3x1C
KIE Istirahat
Observasi TTV dan KU`;

    try {
      const result = await generateWithGemini(apiKey, systemPrompt, processedText);
      setPaluiOutput(result.replace(/\*/g, '').trim());
    } catch (err) {
      setPaluiOutput("Gagal merapikan format Planning.");
    } finally {
      setIsPaluiLoading(false);
    }
  };

  // EZZY Handler
  const handleEzzyGenerate = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    setEzzyError('');
    setFinalSoap('');

    if (!patientIdentity.trim()) {
      setEzzyError("Identitas pasien tidak boleh kosong.");
      return;
    }

    const ageMatch = patientIdentity.match(/(\d+)\s*(thn|tahun|th|bln|bulan)/i);
    let isChild = false;
    
    if (ageMatch) {
      const num = parseInt(ageMatch[1]);
      const unit = ageMatch[2].toLowerCase();
      if ((unit.includes('th') && num < 17) || unit.includes('bln')) {
        isChild = true;
      }
    }

    if (isChild && !patientIdentity.toLowerCase().match(/bb|kg|berat/)) {
      setEzzyError("Pasien terdeteksi berusia di bawah 17 tahun. Anda WAJIB mencantumkan Berat Badan (BB) / (kg) pada identitas pasien untuk perhitungan dosis!");
      return;
    }

    const hour = new Date().getHours();
    let timeGreeting = 'malam';
    if (hour >= 4 && hour < 11) timeGreeting = 'pagi';
    else if (hour >= 11 && hour < 15) timeGreeting = 'siang';
    else if (hour >= 15 && hour < 18) timeGreeting = 'sore';

    const finalGreeting = greetingTemplate.replace('{waktu}', timeGreeting);
    
    const vitalsStr = `Kes: ${vitals.kes},\nGCS: ${vitals.gcs}, \nTD: ${vitals.td} mmHg, \nN: ${vitals.n} x/m, \nRR: ${vitals.rr} x/m, \nT: ${vitals.t}°C, \nSpO2: ${vitals.spo2}`;

    let safeAnamOutput = anamNarrative || anamInput || '(Belum ada data anamnesis)';
    const anamLines = safeAnamOutput.split('\n');
    if (anamLines.length > 0 && anamLines[0].toLowerCase().match(/tahun|thn|bulan|bln/)) {
        anamLines.shift(); 
        safeAnamOutput = anamLines.join('\n').trim();
    }

    let statusGeneralisStr = oppaMode === 'AI' 
      ? (oppaOutput || '(Belum ada data fisik)') 
      : (manualStatusGeneralis || '(Belum ada data fisik)');

    let planningStr = paluiMode === 'AI'
      ? (paluiOutput || paluiInput || '(Belum ada terapi)')
      : (manualPalui || '(Belum ada terapi)');

    const compiled = `${finalGreeting}\n\n*${patientIdentity}*\n\nS)\n${safeAnamOutput}\n\nO)\nTTV: \n${vitalsStr}\n\nStatus Generalis:\n${statusGeneralisStr}\n\nA)\n${diagText || '(Belum ada diagnosis)'}\n\nP)\n${planningStr}`;

    setFinalSoap(compiled);
  };

  // Copy & WA Handlers
  const handleCopyClipboard = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    if (!finalSoap) return;
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(finalSoap)
        .then(() => alert("Berhasil disalin ke clipboard!"))
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }

    function fallbackCopy() {
      const textArea = document.createElement("textarea");
      textArea.value = finalSoap;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        alert("Berhasil disalin ke clipboard!");
      } catch (err) {
        alert("Gagal otomatis menyalin. Silakan block dan copy teks secara manual.");
      }
      textArea.remove();
    }
  };

  const handleSendWA = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    if (!finalSoap) return;
    
    const text = encodeURIComponent(finalSoap);
    let waUrl = `https://wa.me/?text=${text}`;
    
    if (whatsappNumber) {
      let formattedNum = whatsappNumber.replace(/\D/g, '');
      if (formattedNum.startsWith('0')) {
        formattedNum = '62' + formattedNum.substring(1);
      }
      waUrl = `https://wa.me/${formattedNum}?text=${text}`;
    }
    
    window.open(waUrl, '_blank');
  };

  // Navigation with whitelist check
  const handleStepChange = async (step) => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    setCurrentStep(step);
  };

  // Wizard Steps
  const steps = [
    { id: 1, label: 'Anamnesis', sublabel: 'Subjective', icon: FileText },
    { id: 2, label: 'Pemeriksaan Fisik', sublabel: 'Objective', icon: Activity },
    { id: 3, label: 'Assessment', sublabel: 'Diagnosis', icon: ClipboardList },
    { id: 4, label: 'Planning', sublabel: 'Terapi', icon: Pill },
    { id: 5, label: 'Final SOAP', sublabel: 'Identitas & Kirim', icon: Send },
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F3]" data-testid="main-app">
      {/* Header */}
      <header className="bg-white border-b border-[#E3E0D8] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2C4A3B] text-white flex items-center justify-center">
                <Stethoscope className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading text-lg font-medium text-[#1A2E26]">AI Medical Squad</h1>
                <p className="text-xs text-[#5C6B64]">SOAP Documentation</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                data-testid="new-session-btn"
                variant="outline"
                size="sm"
                onClick={handleNewSession}
                className="border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3] gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Sesi Baru</span>
              </Button>

              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="settings-btn"
                    variant="outline"
                    size="icon"
                    className="border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3]"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl bg-white">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-xl">Pengaturan</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 mt-4">
                    {/* Greeting Template */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#1A2E26]">Salam Pembuka</Label>
                      <Textarea
                        data-testid="greeting-template-input"
                        value={greetingTemplate}
                        onChange={(e) => setGreetingTemplate(e.target.value)}
                        className="min-h-[100px] bg-[#F8F7F3] border-[#E3E0D8]"
                      />
                    </div>

                    {/* WhatsApp Number */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#1A2E26]">Nomor WhatsApp Tujuan</Label>
                      <Input
                        data-testid="whatsapp-number-input"
                        placeholder="08123456789"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        className="bg-[#F8F7F3] border-[#E3E0D8]"
                      />
                      <p className="text-xs text-[#5C6B64]">Kosongkan jika ingin memilih kontak manual.</p>
                    </div>

                    {/* Autotext */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-[#1A2E26]">Kamus Autotext (Planning)</Label>
                      <div className="max-h-40 overflow-y-auto border border-[#E3E0D8] rounded-lg bg-[#F8F7F3] p-2 space-y-1">
                        {autotexts.map((auto, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white rounded border border-[#E3E0D8]">
                            <span className="font-mono text-[#2C4A3B] font-bold">{auto.short}</span>
                            <span className="text-[#5C6B64] truncate mx-2 flex-1">{auto.long}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setAutotexts(autotexts.filter((_, i) => i !== idx))}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Singkatan"
                          value={newAutoShort}
                          onChange={(e) => setNewAutoShort(e.target.value)}
                          className="w-1/3 bg-[#F8F7F3] border-[#E3E0D8]"
                        />
                        <Input
                          placeholder="Teks lengkap"
                          value={newAutoLong}
                          onChange={(e) => setNewAutoLong(e.target.value)}
                          className="flex-1 bg-[#F8F7F3] border-[#E3E0D8]"
                        />
                        <Button
                          onClick={() => {
                            if (newAutoShort && newAutoLong) {
                              setAutotexts([...autotexts, { short: newAutoShort, long: newAutoLong }]);
                              setNewAutoShort('');
                              setNewAutoLong('');
                            }
                          }}
                          className="bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2 pt-4 border-t border-[#E3E0D8]">
                      <Label className="text-sm font-medium text-[#1A2E26]">Gemini API Key</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={apiKey}
                          disabled
                          className="bg-[#F8F7F3] border-[#E3E0D8]"
                        />
                        <Button
                          data-testid="change-api-key-btn"
                          variant="outline"
                          onClick={onChangeApiKey}
                          className="border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3]"
                        >
                          Ganti
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* User Menu */}
              <div className="flex items-center gap-2 pl-2 border-l border-[#E3E0D8]">
                <div className="w-8 h-8 rounded-full bg-[#2C4A3B] text-white flex items-center justify-center text-sm font-medium">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <Button
                  data-testid="logout-btn"
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="text-[#5C6B64] hover:text-[#1A2E26] hover:bg-[#F8F7F3]"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - Wizard Steps */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="sticky top-24 bg-white rounded-2xl border border-[#E3E0D8] overflow-hidden">
              <div className="p-4 border-b border-[#E3E0D8]">
                <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64]">Langkah SOAP</h2>
              </div>
              <div className="py-2">
                {steps.map((step) => {
                  const Icon = step.icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = currentStep > step.id;
                  
                  return (
                    <button
                      key={step.id}
                      data-testid={`wizard-step-${step.id}`}
                      onClick={() => handleStepChange(step.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 ${
                        isActive
                          ? 'wizard-step-active'
                          : isCompleted
                          ? 'wizard-step-completed'
                          : 'wizard-step-inactive'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isActive
                          ? 'bg-[#2C4A3B] text-white'
                          : isCompleted
                          ? 'bg-[#3B6051] text-white'
                          : 'bg-[#E3E0D8] text-[#5C6B64]'
                      }`}>
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Icon className="w-4 h-4" strokeWidth={1.5} />
                        )}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isActive ? 'text-[#2C4A3B]' : ''}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-[#5C6B64]">{step.sublabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {/* Step 1: Anamnesis */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-1-anamnesis">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Anamnesis</h2>
                      <p className="text-sm text-[#5C6B64] mt-1">Subjective - Keluhan dan riwayat pasien</p>
                    </div>
                    {isAnamFollowUp && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNewSession}
                        className="border-[#C56F5D] text-[#C56F5D] hover:bg-[#C56F5D]/10"
                      >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Current Narrative */}
                  {anamNarrative && (
                    <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-[#3B6051]"></div>
                        <span className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64]">Narasi Saat Ini</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap text-[#1A2E26] font-mono leading-relaxed">
                        {anamNarrative}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {anamSaran && (
                    <div className="p-4 bg-[#2C4A3B]/5 rounded-xl border-l-4 border-[#2C4A3B]">
                      <h3 className="text-sm font-bold text-[#2C4A3B] mb-3">Analisis & Saran Penggalian:</h3>
                      <div className="text-sm leading-relaxed text-[#1A2E26]">
                        {anamSaran.split('\n').map((line, idx) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={idx} className="h-2"></div>;
                          if (trimmed.startsWith('-')) {
                            return <div key={idx} className="ml-4 mb-1 text-[#5C6B64]">{trimmed}</div>;
                          }
                          return <div key={idx} className="font-bold text-[#2C4A3B] mt-4 mb-1">{trimmed.replace(/\*/g, '')}</div>;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input Area */}
                  <div className="space-y-4">
                    <Textarea
                      data-testid="anam-input"
                      placeholder={isAnamFollowUp 
                        ? "Ketik tambahan info / jawaban dari analisis di atas..." 
                        : "Ketik keluhan pasien disini.. Contoh: Nyeri kepala mendadak, mual muntah 2 hari yll, dan seterusnya"
                      }
                      value={anamInput}
                      onChange={(e) => setAnamInput(e.target.value)}
                      className="min-h-[120px] bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30 resize-none"
                    />

                    {anamAlert && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{anamAlert}</span>
                      </div>
                    )}

                    <Button
                      data-testid="process-anam-btn"
                      onClick={handleAnamProcess}
                      disabled={isAnamLoading || !anamInput.trim()}
                      className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white font-medium"
                    >
                      {isAnamLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Memproses Anamnesis...
                        </>
                      ) : (
                        isAnamFollowUp ? 'Lanjutkan Analisa' : 'Olah Anamnesis'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Physical Exam */}
            {currentStep === 2 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-2-physical">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Pemeriksaan Fisik</h2>
                      <p className="text-sm text-[#5C6B64] mt-1">Objective - Status vitalis dan generalis</p>
                    </div>
                    <Tabs value={oppaMode} onValueChange={setOppaMode} className="w-auto">
                      <TabsList className="bg-[#E3E0D8]">
                        <TabsTrigger value="AI" data-testid="oppa-mode-ai" className="data-[state=active]:bg-white">AI Mode</TabsTrigger>
                        <TabsTrigger value="Manual" data-testid="oppa-mode-manual" className="data-[state=active]:bg-white">Manual</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Vitals Grid */}
                  <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
                    <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64] mb-4">Tanda Vital (TTV)</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Kes', key: 'kes' },
                        { label: 'GCS', key: 'gcs' },
                        { label: 'TD (mmHg)', key: 'td' },
                        { label: 'N (x/m)', key: 'n' },
                        { label: 'RR (x/m)', key: 'rr' },
                        { label: 'T (°C)', key: 't' },
                        { label: 'SpO2', key: 'spo2' }
                      ].map(item => (
                        <div key={item.key} className="space-y-1">
                          <Label className="text-xs text-[#5C6B64]">{item.label}</Label>
                          <Input
                            data-testid={`vital-${item.key}`}
                            value={vitals[item.key]}
                            onChange={(e) => setVitals({ ...vitals, [item.key]: e.target.value })}
                            className="bg-white border-[#E3E0D8] focus:ring-[#2C4A3B]/30"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {oppaMode === 'AI' ? (
                    <div className="space-y-4">
                      {/* Image Upload */}
                      <div>
                        <Label className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8F7F3] border border-dashed border-[#E3E0D8] rounded-lg cursor-pointer hover:bg-[#E3E0D8]/50 transition-colors">
                          <Upload className="w-4 h-4 text-[#5C6B64]" />
                          <span className="text-sm text-[#5C6B64]">Upload Foto Klinis (Luka/UKK)</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleOppaImageUpload}
                            className="hidden"
                          />
                        </Label>
                        
                        {oppaImages.length > 0 && (
                          <div className="flex gap-3 flex-wrap mt-3">
                            {oppaImages.map((img, idx) => (
                              <div key={idx} className="relative w-16 h-16 rounded-lg border border-[#E3E0D8] overflow-hidden group">
                                <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                                <button
                                  onClick={() => setOppaImages(oppaImages.filter((_, i) => i !== idx))}
                                  className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Textarea
                        data-testid="abnormal-finding-input"
                        placeholder="Abnormal finding (Contoh: rh paru kiri, nyeri tekan epigastrium)"
                        value={abnormalFinding}
                        onChange={(e) => setAbnormalFinding(e.target.value)}
                        className="min-h-[80px] bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30"
                      />

                      <Button
                        data-testid="process-oppa-btn"
                        onClick={handleOppaProcessAI}
                        disabled={isOppaLoading}
                        className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white font-medium"
                      >
                        {isOppaLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Menyusun Fisik...
                          </>
                        ) : (
                          'Sesuaikan Format Fisik (AI)'
                        )}
                      </Button>

                      {oppaOutput && (
                        <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
                          <pre className="text-sm whitespace-pre-wrap font-mono text-[#1A2E26] leading-relaxed">
                            {oppaOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64]">Status Generalis</Label>
                      <Textarea
                        data-testid="manual-status-generalis"
                        value={manualStatusGeneralis}
                        onChange={(e) => setManualStatusGeneralis(e.target.value)}
                        className="min-h-[400px] bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30 font-mono text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Assessment */}
            {currentStep === 3 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-3-assessment">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Assessment</h2>
                  <p className="text-sm text-[#5C6B64] mt-1">Diagnosis berdasarkan anamnesis dan pemeriksaan</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Image Upload */}
                  <div>
                    <Label className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8F7F3] border border-dashed border-[#E3E0D8] rounded-lg cursor-pointer hover:bg-[#E3E0D8]/50 transition-colors">
                      <Upload className="w-4 h-4 text-[#5C6B64]" />
                      <span className="text-sm text-[#5C6B64]">Upload Penunjang (EKG/Lab/Rontgen)</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleDiagImageUpload}
                        className="hidden"
                      />
                    </Label>
                    
                    {diagImages.length > 0 && (
                      <div className="flex gap-3 flex-wrap mt-3">
                        {diagImages.map((img, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-lg border border-[#E3E0D8] overflow-hidden group">
                            <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setDiagImages(diagImages.filter((_, i) => i !== idx))}
                              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Interpretation */}
                  {diagInterpretation && (
                    <div className="p-4 bg-[#2C4A3B]/5 rounded-xl border border-[#2C4A3B]/20">
                      <h3 className="text-sm font-bold text-[#2C4A3B] mb-2">Interpretasi Penunjang & Klinis:</h3>
                      <p className="text-sm text-[#1A2E26] leading-relaxed">{diagInterpretation}</p>
                    </div>
                  )}

                  {/* Diagnosis Input */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64]">Diagnosis</Label>
                    <Textarea
                      data-testid="diagnosis-input"
                      placeholder="Diagnosis Kerja dd DDx... (Bisa diedit manual)"
                      value={diagText}
                      onChange={(e) => setDiagText(e.target.value)}
                      className="min-h-[100px] bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30 font-medium"
                    />
                  </div>

                  <Button
                    data-testid="process-diag-btn"
                    onClick={handleDiagProcess}
                    disabled={isDiagLoading}
                    className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white font-medium"
                  >
                    {isDiagLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menganalisa...
                      </>
                    ) : (
                      isDiagGenerated ? 'Olah Ulang Diagnosa' : 'Olah Diagnosa'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Planning */}
            {currentStep === 4 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-4-planning">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Planning</h2>
                      <p className="text-sm text-[#5C6B64] mt-1">Rencana terapi dan tindakan</p>
                    </div>
                    <Tabs value={paluiMode} onValueChange={setPaluiMode} className="w-auto">
                      <TabsList className="bg-[#E3E0D8]">
                        <TabsTrigger value="AI" data-testid="palui-mode-ai" className="data-[state=active]:bg-white">AI Mode</TabsTrigger>
                        <TabsTrigger value="Manual" data-testid="palui-mode-manual" className="data-[state=active]:bg-white">Manual</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {paluiMode === 'AI' ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <Textarea
                          data-testid="palui-input"
                          placeholder="[Monitoring]&#10;[Terapi Cairan/Obat - Ketik shorthand disini...]&#10;[KIE / Edukasi]&#10;[Disposisi]"
                          value={paluiInput}
                          onChange={(e) => setPaluiInput(e.target.value)}
                          className="min-h-[160px] bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30 font-mono"
                        />
                      </div>

                      <Button
                        data-testid="process-palui-btn"
                        onClick={handlePaluiProcess}
                        disabled={isPaluiLoading || !paluiInput.trim()}
                        className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white font-medium"
                      >
                        {isPaluiLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Merapikan Terapi...
                          </>
                        ) : (
                          'Olah Planning'
                        )}
                      </Button>

                      {paluiOutput && (
                        <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
                          <pre className="text-sm whitespace-pre-wrap font-mono text-[#1A2E26] leading-relaxed">
                            {paluiOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64]">Planning Manual</Label>
                      <Textarea
                        data-testid="manual-palui"
                        value={manualPalui}
                        onChange={(e) => setManualPalui(e.target.value)}
                        placeholder="Ketik planning secara manual di sini..."
                        className="min-h-[250px] bg-[#F8F7F3] border-[#E3E0D8] focus:ring-[#2C4A3B]/30 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Final SOAP */}
            {currentStep === 5 && (
              <div className="bg-[#1A2E26] rounded-2xl overflow-hidden animate-fade-in" data-testid="step-5-final">
                <div className="p-6 border-b border-white/10">
                  <h2 className="font-heading text-2xl font-medium text-white">Final SOAP</h2>
                  <p className="text-sm text-white/60 mt-1">Identitas pasien dan hasil akhir</p>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold tracking-[0.2em] uppercase text-white/60">Identitas Pasien</Label>
                    <Input
                      data-testid="patient-identity-input"
                      placeholder="Contoh: An. Syafrie / 13 tahun / BB 40kg / BPJS PBI"
                      value={patientIdentity}
                      onChange={(e) => setPatientIdentity(e.target.value)}
                      className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-white/30"
                    />
                  </div>

                  {ezzyError && (
                    <div className="flex items-start gap-2 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{ezzyError}</span>
                    </div>
                  )}

                  <Button
                    data-testid="generate-soap-btn"
                    onClick={handleEzzyGenerate}
                    className="w-full h-14 bg-[#C56F5D] hover:bg-[#A65B4C] text-white font-bold text-lg"
                  >
                    GENERATE SOAP KONSUL
                  </Button>

                  {finalSoap && (
                    <div className="space-y-4 pt-6 border-t border-white/10">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          data-testid="new-session-final-btn"
                          onClick={handleNewSession}
                          variant="outline"
                          className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sesi Baru
                        </Button>
                        <Button
                          data-testid="send-wa-btn"
                          onClick={handleSendWA}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <MessageCircle className="w-4 h-4 mr-2" />
                          Kirim WhatsApp
                        </Button>
                        <Button
                          data-testid="copy-clipboard-btn"
                          onClick={handleCopyClipboard}
                          variant="outline"
                          className="flex-1 border-white/20 text-white hover:bg-white/10"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Text
                        </Button>
                      </div>

                      <Textarea
                        readOnly
                        value={finalSoap}
                        className="min-h-[400px] bg-white text-[#1A2E26] border-0 font-mono text-sm resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-6">
              <Button
                data-testid="prev-step-btn"
                onClick={() => handleStepChange(Math.max(1, currentStep - 1))}
                variant="outline"
                className={`border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3] ${currentStep === 1 ? 'opacity-0 pointer-events-none' : ''}`}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Kembali
              </Button>
              
              <Button
                data-testid="next-step-btn"
                onClick={() => handleStepChange(Math.min(5, currentStep + 1))}
                className={`bg-[#2C4A3B] hover:bg-[#1A2E26] text-white ${currentStep === 5 ? 'opacity-0 pointer-events-none' : ''}`}
              >
                Langkah Selanjutnya
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// Root App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check whitelist function
  const checkWhitelist = useCallback(async () => {
    if (!user?.email) return true;
    
    try {
      const res = await fetch(`${API}/whitelist/check/${encodeURIComponent(user.email)}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.is_whitelisted) {
          setAccessDenied(true);
          return false;
        }
        return true;
      }
    } catch (err) {
      console.error('Whitelist check error:', err);
    }
    return true;
  }, [user?.email]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
        }
        
        if (session?.user) {
          setUser(session.user);
          
          // Check whitelist
          const res = await fetch(`${API}/whitelist/check/${encodeURIComponent(session.user.email)}`);
          if (res.ok) {
            const data = await res.json();
            if (!data.is_whitelisted) {
              setAccessDenied(true);
              setLoading(false);
              return;
            }
          }
          
          const storedKey = localStorage.getItem(`gemini_api_key_${session.user.id}`);
          if (storedKey) {
            setApiKey(storedKey);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        
        // Check whitelist on sign in
        try {
          const res = await fetch(`${API}/whitelist/check/${encodeURIComponent(session.user.email)}`);
          if (res.ok) {
            const data = await res.json();
            if (!data.is_whitelisted) {
              setAccessDenied(true);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error('Whitelist check error:', err);
        }
        
        const storedKey = localStorage.getItem(`gemini_api_key_${session.user.id}`);
        if (storedKey) {
          setApiKey(storedKey);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setApiKey(null);
        setAccessDenied(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        setUser(session.user);
        const storedKey = localStorage.getItem(`gemini_api_key_${session.user.id}`);
        if (storedKey) {
          setApiKey(storedKey);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setApiKey(null);
    setAccessDenied(false);
  };

  const handleApiKeyComplete = (key) => {
    setApiKey(key);
  };

  const handleChangeApiKey = () => {
    if (user) {
      localStorage.removeItem(`gemini_api_key_${user.id}`);
    }
    setApiKey(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#2C4A3B]" />
          <p className="text-[#5C6B64]">Memuat...</p>
        </div>
      </div>
    );
  }

  // Access Denied
  if (accessDenied && user) {
    return <AccessDeniedPage onSignOut={handleLogout} />;
  }

  // Not logged in
  if (!user) {
    return <LoginPage onLogin={setUser} onSignOut={handleLogout} />;
  }

  // Logged in but no API key
  if (!apiKey) {
    return <ApiKeySetup user={user} onComplete={handleApiKeyComplete} onSignOut={handleLogout} />;
  }

  // Fully authenticated
  return (
    <MainApp 
      user={user} 
      apiKey={apiKey} 
      onLogout={handleLogout}
      onChangeApiKey={handleChangeApiKey}
      checkWhitelist={checkWhitelist}
    />
  );
}
