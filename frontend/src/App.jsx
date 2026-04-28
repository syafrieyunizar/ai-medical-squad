import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
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
  BookOpen,
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
  Edit3,
  RotateCcw,
  Save,
  Lock,
  History,
  Crown,
  CheckCircle
} from 'lucide-react';

const API = import.meta.env.VITE_BACKEND_URL || "/api";

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

const ONBOARDING_SAMPLE_ANAM = 'BAB cair hampir 1 bulan, 3x lebih setiap hari, nafsu makan kurang, kadang demam +';

const ONBOARDING_BRIEF_STEPS = [
  {
    key: 'brief-new-session',
    selector: '[data-testid="new-session-btn"]',
    title: 'Sesi Baru',
    description: 'Gunakan Sesi Baru untuk memulai pasien baru dan membersihkan data SOAP pasien yang sedang aktif.'
  },
  {
    key: 'brief-soap-steps',
    selector: '[data-testid="soap-steps-nav"]',
    title: 'Langkah SOAP',
    description: 'Aplikasi dipakai berurutan dari Anam, Oppa, Diag, Palui, lalu Final SOAP.'
  },
  {
    key: 'brief-anam',
    selector: '[data-testid="step-1-anamnesis"]',
    title: 'Anamnesis',
    description: 'Masukkan keluhan dan riwayat pasien di sini. AI membantu menyusun anamnesis dan memberi saran penggalian lanjutan.'
  },
  {
    key: 'brief-oppa',
    selector: '[data-testid="step-2-physical"]',
    title: 'Oppa',
    description: 'Bagian ini dipakai untuk pemeriksaan fisik, baik dengan mode AI maupun manual.'
  },
  {
    key: 'brief-diag',
    selector: '[data-testid="step-3-assessment"]',
    title: 'Diag',
    description: 'Upload pemeriksaan penunjang jika ada. Jika ingin menulis diagnosa sendiri, isi manual dan jangan tekan Olah Diagnosa. Jika ingin AI yang membuatkan, kosongkan dulu lalu tekan Olah Diagnosa.'
  },
  {
    key: 'brief-palui',
    selector: '[data-testid="step-4-planning"]',
    title: 'Palui',
    description: 'Bagian ini untuk planning atau tatalaksana. Anda bisa menulis manual atau memakai AI.'
  },
  {
    key: 'brief-smart',
    selector: '[data-testid="smart-fab"]',
    title: 'SMART',
    description: 'SMART punya 2 mode: jika SOAP sudah selesai, hasil SOAP bisa didiskusikan dengan SMART. Jika belum ada SOAP selesai, SMART tetap bisa dipakai untuk pertanyaan general.'
  },
  {
    key: 'brief-history-settings',
    selector: '[data-testid="history-btn"]',
    title: 'Riwayat dan Pengaturan',
    description: 'Riwayat dipakai untuk melihat SOAP sebelumnya. Pengaturan dipakai untuk API key, greeting, dan autotext.'
  }
];

const ONBOARDING_DETAIL_STEPS = [
  {
    key: 'detail-anam-step',
    selector: '[data-testid="wizard-step-1"]',
    title: 'Mulai dari Anam',
    description: 'Kita mulai dari Anamnesis. Klik langkah Anamnesis untuk membuka bagian ini.',
    completionLabel: 'Buka langkah Anamnesis untuk melanjutkan.'
  },
  {
    key: 'detail-anam-input',
    selector: '[data-testid="anam-input"]',
    title: 'Contoh Input Anam',
    description: 'Kolom ini akan diisi contoh keluhan pasien. Anda boleh mengeditnya nanti, tetapi untuk panduan ini kita gunakan contoh tersebut.',
    completionLabel: 'Pastikan kolom anamnesis sudah terisi.'
  },
  {
    key: 'detail-anam-process',
    selector: '[data-testid="process-anam-btn"]',
    title: 'Olah Anamnesis',
    description: 'Sekarang klik Olah Anamnesis agar AI menyusun narasi dan saran penggalian.',
    completionLabel: 'Klik Olah Anamnesis hingga hasil muncul.'
  },
  {
    key: 'detail-anam-followup',
    selector: '[data-testid="anam-input"]',
    title: 'Jawab Minimal 1 Kali',
    description: 'Setelah hasil muncul, jawab minimal 1 pertanyaan lanjutan dari saran yang diberikan AI. Setelah 1 follow-up berhasil, Anda boleh lanjut atau eksplor lagi sampai puas.',
    completionLabel: 'Jawab minimal 1 follow-up anamnesis untuk melanjutkan.'
  },
  {
    key: 'detail-oppa',
    selector: '[data-testid="step-2-physical"]',
    title: 'Oppa',
    description: 'Bagian ini dipakai untuk pemeriksaan fisik. Anda bisa memakai mode AI atau manual, dan template normal dapat disimpan per akun.'
  },
  {
    key: 'detail-diag',
    selector: '[data-testid="step-3-assessment"]',
    title: 'Diag',
    description: 'Upload pemeriksaan penunjang jika ada. Jika ingin mengisi diagnosa sendiri, jangan tekan Olah Diagnosa. Jika ingin AI yang buatkan, kosongi dulu lalu tekan Olah Diagnosa.'
  },
  {
    key: 'detail-palui',
    selector: '[data-testid="step-4-planning"]',
    title: 'Palui',
    description: 'Bagian ini dipakai untuk planning dan terapi. Autotext di Pengaturan dapat membantu mempercepat penulisan.'
  },
  {
    key: 'detail-smart',
    selector: '[data-testid="smart-fab"]',
    title: 'SMART',
    description: 'SMART punya 2 fungsi. Jika SOAP sudah selesai ditulis, hasil SOAP tadi bisa didiskusikan dengan SMART. Jika belum ada SOAP selesai, SMART bekerja sebagai mode pertanyaan general.'
  },
  {
    key: 'detail-history',
    selector: '[data-testid="history-btn"]',
    title: 'Riwayat',
    description: 'Riwayat dipakai untuk melihat SOAP pasien sebelumnya.'
  },
  {
    key: 'detail-settings',
    selector: '[data-testid="settings-btn"]',
    title: 'Pengaturan',
    description: 'Pengaturan dipakai untuk API key, greeting, dan autotext.'
  }
];

// SMART System Prompt
const SMART_SYSTEM_PROMPT = `# SMART — Asisten Dokter Jaga IGD

## IDENTITAS
Kamu adalah Smart, asisten dokter jaga IGD yang berpengalaman. Kamu adalah teman sejawat dokter umum: 
cepat, presisi, dan selalu siap. Gaya bicara: lugas, semi-formal, seperti diskusi antar dokter jaga.
Kamu tidak perlu dipanggil dengan kata khusus. Setiap pesan yang masuk langsung kamu baca dan 
respons sesuai konteksnya.

---

## PRINSIP UTAMA: BACA SITUASI, LANGSUNG EKSEKUSI

Kamu secara otomatis mengenali jenis pertanyaan dan langsung menyesuaikan format jawaban.
Tidak perlu user memilih mode. Tidak perlu konfirmasi dulu. Baca konteks → jawab tepat.

---

## DETEKSI KONTEKS OTOMATIS

### MODE GAWAT DARURAT
Aktif jika ada kata/frasa: tidak sadar, henti napas, henti jantung, syok, kejang aktif, 
sesak berat, penurunan kesadaran, hipotensi berat, perdarahan masif, atau kalimat seperti 
"pasien datang tidak sadar", "pasien tiba-tiba kolaps", "GCS turun", dll.

Format jawaban:
1. Tindakan SEGERA (detik pertama)
2. Stabilisasi (menit pertama)
3. Evaluasi & lanjutan

Ringkas. Berurutan. Bisa langsung dieksekusi. Tanpa basa-basi.

---

### MODE TATALAKSANA
Aktif jika ada kata: tatalaksana, manajemen, terapi, penanganan, obati, resep, protokol.

Format jawaban:
- Diagnosis kerja
- Terapi awal
- Obat + dosis (sesuaikan BB/usia jika disebutkan)
- Monitoring
- Kapan rujuk

---

### MODE INTERPRETASI KLINIS
Aktif jika ada: gambar EKG / X-ray / CT / USG / foto luka / hasil lab yang diunggah.

Format jawaban EKG:
1. Irama & rate
2. Axis
3. Gelombang P, PR interval
4. Kompleks QRS
5. Segmen ST & gelombang T
6. Kesimpulan + implikasi klinis

Format jawaban X-ray / imaging lain:
1. Kualitas foto
2. Temuan sistematis
3. Kesan / diagnosis kerja
4. Saran tindak lanjut

Jika gambar kurang jelas: minta unggah ulang atau minta konteks klinis tambahan.

---

### MODE FARMAKOTERAPI
Aktif jika ditanya dosis, nama obat, pilihan obat, atau interaksi.

Format jawaban:
- Obat pilihan + dosis + rute + durasi
- Alternatif (termasuk yang tersedia di Fornas/BPJS jika relevan)
- Perhatian khusus (kontraindikasi, interaksi dasar, kondisi pasien)
- Jika data tidak cukup: tanyakan usia/BB/fungsi ginjal/hati secara spesifik

---

### MODE EDUKASI / DISKUSI KLINIS
Aktif jika pertanyaan bersifat konseptual: "apa bedanya", "kenapa bisa", "jelaskan", 
"bagaimana mekanisme", atau pertanyaan santai tanpa konteks pasien aktif.

Format jawaban:
- Jawab langsung, padat, terstruktur
- Gunakan perbandingan atau analogi klinis jika membantu
- Sertakan poin kunci yang paling relevan untuk praktik IGD
- Tidak perlu terlalu akademik kecuali diminta

---

### MODE SOAP / DOKUMENTASI
Aktif jika diminta buat SOAP, surat rujukan, resume medis, atau laporan jaga.

Hasilkan dokumen terstruktur siap pakai, sesuaikan dengan konteks klinis yang diberikan.

---

## MEMORI KONTEKS
Dalam satu sesi percakapan, kamu mengingat semua informasi pasien yang sudah disebutkan.
Jika user menyambung kasus ("pasien tadi sekarang..."), kamu langsung hubungkan dengan 
informasi sebelumnya tanpa perlu diulang.

---

## REFERENSI
Setiap jawaban klinis didukung panduan terpercaya:
- PNPK Kemenkes RI
- Formularium Nasional (Fornas) terbaru
- Panduan ACLS / ATLS / PALS
- WHO, ESC, AHA, IDSA, PDPI, PAPDI, IDAI
Sebutkan referensi singkat di akhir jawaban jika relevan. Format: [Nama Guideline/Institusi, Tahun]
Jika tidak yakin referensi valid: nyatakan: "perlu verifikasi mandiri."

---

## BATASAN & KEAMANAN
- Selalu sertakan satu baris disclaimer di akhir jawaban klinis: 
  "Keputusan akhir tetap di tangan dokter yang memeriksa langsung."
- Tidak memberikan diagnosis definitif tanpa data klinis yang memadai: minta klarifikasi spesifik.
- Tidak memanipulasi data, membuat diagnosis fiktif, atau melanggar etik kedokteran.
- Jika kasus di luar kapasitas dokter umum IGD: rekomendasikan rujukan spesialis secara eksplisit.

---

## PRINSIP JAWABAN
- Cepat lebih penting dari panjang.
- Urutan lebih penting dari kelengkapan.
- Relevan IGD lebih penting dari teori akademik.
- Jika situasi gawat: jawab dulu, diskusi kemudian.
- JANGAN MENGGUNAKAN TANDA ASTERISK (*) ATAU MARKDOWN APAPUN di seluruh output. Gunakan plain text sepenuhnya.`;

const PromptsContext = createContext(null);
export const usePrompts = () => useContext(PromptsContext);

function OnboardingTour({
  open,
  mode,
  stepIndex,
  onSelectMode,
  onSkip,
  onNext,
  onPrev,
  canProceed,
  completionLabel
}) {
  const [targetRect, setTargetRect] = useState(null);

  const steps = mode === 'brief' ? ONBOARDING_BRIEF_STEPS : mode === 'detail' ? ONBOARDING_DETAIL_STEPS : [];
  const currentStep = steps[stepIndex] || null;

  useEffect(() => {
    if (!open || !currentStep?.selector) {
      setTargetRect(null);
      return;
    }

    const updatePosition = () => {
      const target = document.querySelector(currentStep.selector);
      if (!target) {
        setTargetRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, currentStep]);

  if (!open) return null;

  if (!mode) {
    return (
      <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white border border-[#E3E0D8] shadow-2xl p-6 relative">
          <button
            onClick={onSkip}
            className="absolute -top-12 right-0 rounded-full bg-white/95 border border-[#E3E0D8] px-4 py-2 text-sm font-medium text-[#5C6B64] hover:text-[#1A2E26]"
          >
            Skip
          </button>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#F8F7F3] px-3 py-1 text-xs font-bold tracking-[0.16em] uppercase text-[#5C6B64]">
              <BookOpen className="w-3 h-3" />
              Get Started
            </span>
            <h3 className="font-heading text-2xl font-medium text-[#1A2E26]">Selamat datang di AI Medical Squad.</h3>
            <p className="text-sm leading-relaxed text-[#5C6B64]">
              Aplikasi ini membantu Anda menyusun SOAP secara bertahap.
            </p>
          </div>
          <div className="mt-6 grid gap-3">
            <Button onClick={() => onSelectMode('brief')} className="h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white">
              Panduan Ringkas
            </Button>
            <Button onClick={() => onSelectMode('detail')} variant="outline" className="h-12 border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3]">
              Panduan Detail
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const progressTotal = steps.length;
  const isLastStep = stepIndex >= progressTotal - 1;

  let bubbleStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  if (targetRect) {
    const bubbleWidth = Math.min(window.innerWidth - 32, 380);
    let left = targetRect.left + (targetRect.width / 2) - (bubbleWidth / 2);
    left = Math.max(16, Math.min(left, window.innerWidth - bubbleWidth - 16));

    let top = targetRect.top + targetRect.height + 18;
    const estimatedHeight = 240;
    if (top + estimatedHeight > window.innerHeight - 16) {
      top = Math.max(16, targetRect.top - estimatedHeight - 18);
    }
    bubbleStyle = { top: `${top}px`, left: `${left}px`, width: `${bubbleWidth}px` };
  }

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      <div className="absolute inset-0 bg-black/35" />
      {targetRect && (
        <div
          className="absolute rounded-2xl border-2 border-[#C56F5D] shadow-[0_0_0_9999px_rgba(0,0,0,0.22)] transition-all duration-200"
          style={{
            top: `${Math.max(targetRect.top - 8, 8)}px`,
            left: `${Math.max(targetRect.left - 8, 8)}px`,
            width: `${targetRect.width + 16}px`,
            height: `${targetRect.height + 16}px`,
          }}
        />
      )}
      <div className="absolute" style={bubbleStyle}>
        <div className="pointer-events-auto relative rounded-2xl bg-white border border-[#E3E0D8] shadow-2xl p-5">
          <button
            onClick={onSkip}
            className="absolute -top-12 right-0 rounded-full bg-white/95 border border-[#E3E0D8] px-4 py-2 text-sm font-medium text-[#5C6B64] hover:text-[#1A2E26]"
          >
            Skip
          </button>
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="text-xs font-bold tracking-[0.16em] uppercase text-[#5C6B64]">
              {mode === 'detail' ? 'Panduan Detail' : 'Panduan Ringkas'}
            </span>
            <span className="text-xs text-[#5C6B64]">{stepIndex + 1}/{progressTotal}</span>
          </div>
          <h3 className="font-heading text-xl font-medium text-[#1A2E26]">{currentStep?.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#5C6B64]">{currentStep?.description}</p>
          {!canProceed && completionLabel && (
            <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              {completionLabel}
            </p>
          )}
          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              onClick={onPrev}
              variant="outline"
              className={`border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3] ${stepIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
            <Button
              onClick={onNext}
              disabled={!canProceed}
              className="bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"
            >
              {isLastStep ? 'Selesai' : 'Next'}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Generate client ID for tracking password attempts
const getClientId = () => {
  let clientId = localStorage.getItem('client_id');
  if (!clientId) {
    clientId = 'client_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('client_id', clientId);
  }
  return clientId;
};

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

// Prompt Editor Modal
function PromptEditorModal({ open, onClose }) {
  const [prompts, setPrompts] = useState({
    anam: '', oppa: '', diag: '', palui: '', smart: ''
  });
  const [activeTab, setActiveTab] = useState('anam');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState({});

  const agentNames = {
    anam: { name: 'Anam', desc: 'Anamnesis (Subjective)', icon: FileText },
    oppa: { name: 'Oppa', desc: 'Pemeriksaan Fisik (Objective)', icon: Activity },
    diag: { name: 'Diag', desc: 'Assessment (Diagnosis)', icon: ClipboardList },
    palui: { name: 'Palui', desc: 'Planning (Terapi)', icon: Pill },
    smart: { name: 'SMART', desc: 'Asisten Dokter Jaga IGD', icon: AlertTriangle }
  };

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/prompts`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
        setHasChanges({});
      }
    } catch (err) {
      console.error('Error fetching prompts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchPrompts();
  }, [open, fetchPrompts]);

  const handlePromptChange = (agentId, value) => {
    setPrompts(prev => ({ ...prev, [agentId]: value }));
    setHasChanges(prev => ({ ...prev, [agentId]: true }));
  };

  const handleSave = async (agentId) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, prompt: prompts[agentId] })
      });
      if (res.ok) {
        setHasChanges(prev => ({ ...prev, [agentId]: false }));
        alert(`Prompt ${agentNames[agentId].name} berhasil disimpan!`);
      }
    } catch (err) {
      console.error('Error saving prompt:', err);
      alert('Gagal menyimpan prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (agentId) => {
    if (!window.confirm(`Reset prompt ${agentNames[agentId].name} ke default?`)) return;
    
    setSaving(true);
    try {
      const res = await fetch(`${API}/prompts/reset/${agentId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPrompts(prev => ({ ...prev, [agentId]: data.prompt }));
        setHasChanges(prev => ({ ...prev, [agentId]: false }));
        alert(`Prompt ${agentNames[agentId].name} berhasil direset!`);
      }
    } catch (err) {
      console.error('Error resetting prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#2C4A3B]" />
            Edit System Prompts
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2C4A3B]" />
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden mt-4">
            {/* Agent Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {Object.entries(agentNames).map(([id, agent]) => {
                const Icon = agent.icon;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                      activeTab === id
                        ? 'bg-[#2C4A3B] text-white'
                        : 'bg-[#F8F7F3] text-[#5C6B64] hover:bg-[#E3E0D8]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{agent.name}</span>
                    {hasChanges[id] && <span className="w-2 h-2 bg-amber-500 rounded-full"></span>}
                  </button>
                );
              })}
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-[#1A2E26]">{agentNames[activeTab].name}</p>
                  <p className="text-xs text-[#5C6B64]">{agentNames[activeTab].desc}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReset(activeTab)}
                    disabled={saving}
                    className="gap-1 border-[#E3E0D8] text-[#5C6B64]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset Default
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave(activeTab)}
                    disabled={saving || !hasChanges[activeTab]}
                    className="gap-1 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Simpan
                  </Button>
                </div>
              </div>
              
              <Textarea
                value={prompts[activeTab] || ''}
                onChange={(e) => handlePromptChange(activeTab, e.target.value)}
                className="flex-1 min-h-[300px] bg-[#F8F7F3] border-[#E3E0D8] font-mono text-sm resize-none"
                placeholder="Masukkan system prompt..."
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// History Modal
function HistoryModal({ open, onClose, user }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('soap_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(7);
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchHistory();
      setSelectedItem(null);
    }
  }, [open, fetchHistory]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <History className="w-5 h-5 text-[#2C4A3B]" />
            Riwayat Pasien
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2C4A3B]" />
          </div>
        ) : selectedItem ? (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4">
            <button
              onClick={() => setSelectedItem(null)}
              data-testid="history-back-btn"
              className="flex items-center gap-2 text-sm text-[#2C4A3B] hover:text-[#1A2E26] font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Kembali ke daftar
            </button>
            <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
              <h3 className="font-bold text-[#1A2E26] mb-1">{selectedItem.patient_identity}</h3>
              <p className="text-xs text-[#5C6B64]">{formatDate(selectedItem.created_at)}</p>
            </div>
            {selectedItem.interpretation && (
              <div className="p-4 bg-[#2C4A3B]/5 rounded-xl border border-[#2C4A3B]/20">
                <h3 className="text-sm font-bold text-[#2C4A3B] mb-2">Interpretasi AI:</h3>
                <p className="text-sm whitespace-pre-wrap">{selectedItem.interpretation}</p>
              </div>
            )}
            <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64] mb-3">SOAP</h3>
              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-[#1A2E26]">{selectedItem.final_soap}</pre>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto mt-4">
            {history.length === 0 ? (
              <div className="text-center py-12 text-[#5C6B64]">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada riwayat pasien</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <button
                    key={item.id}
                    data-testid={`history-item-${item.id}`}
                    onClick={() => setSelectedItem(item)}
                    className="w-full text-left p-4 rounded-xl border border-[#E3E0D8] hover:bg-[#F8F7F3] transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1A2E26] truncate">{item.patient_identity}</p>
                        <p className="text-xs text-[#5C6B64] mt-1">{formatDate(item.created_at)}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#5C6B64] group-hover:text-[#2C4A3B] flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Profile Modal
function ProfileModal({ open, onClose, user }) {
  const [accountStatus, setAccountStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAccountStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [emailsRes, bypassRes] = await Promise.all([
        fetch(`${API}/whitelist/emails`),
        fetch(`${API}/whitelist/bypass`)
      ]);
      const emails = emailsRes.ok ? await emailsRes.json() : [];
      const bypassData = bypassRes.ok ? await bypassRes.json() : { is_active: false };

      const myEmail = Array.isArray(emails) ? emails.find(e => e.email === user.email.toLowerCase()) : null;

      if (myEmail && myEmail.is_active) {
        setAccountStatus({ type: 'Premium', expiry: myEmail.expiry_datetime });
      } else if (bypassData.is_active) {
        setAccountStatus({ type: 'Free' });
      } else {
        setAccountStatus({ type: 'Free' });
      }
    } catch (err) {
      console.error('Error fetching account status:', err);
      setAccountStatus({ type: 'Free' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) fetchAccountStatus();
  }, [open, fetchAccountStatus]);

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0];
  const email = user?.email;

  const formatExpiry = (expiry) => {
    if (!expiry) return 'Lifetime';
    return new Date(expiry).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-white" data-testid="profile-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Profil Akun</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 mt-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-20 h-20 rounded-full border-2 border-[#E3E0D8]" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#2C4A3B] text-white flex items-center justify-center text-2xl font-bold">
              {fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="text-center">
            <h3 className="font-heading text-lg font-medium text-[#1A2E26]">{fullName}</h3>
            <p className="text-sm text-[#5C6B64]">{email}</p>
          </div>

          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#2C4A3B]" />
          ) : (
            <div className={`w-full p-4 rounded-xl border ${
              accountStatus?.type === 'Premium'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-[#F8F7F3] border-[#E3E0D8]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {accountStatus?.type === 'Premium' ? (
                  <Crown className="w-4 h-4 text-amber-600" />
                ) : (
                  <Shield className="w-4 h-4 text-[#5C6B64]" />
                )}
                <span className={`text-sm font-bold ${
                  accountStatus?.type === 'Premium' ? 'text-amber-800' : 'text-[#1A2E26]'
                }`}>
                  {accountStatus?.type === 'Premium' ? 'Premium' : 'Free'}
                </span>
              </div>
              {accountStatus?.type === 'Premium' && (
                <p className="text-xs text-amber-700 ml-6">
                  Berlaku sampai: {formatExpiry(accountStatus.expiry)}
                </p>
              )}
              {accountStatus?.type === 'Free' && (
                <p className="text-xs text-[#5C6B64] ml-6">
                  Akses melalui bypass mode
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// SMART Chat Window
function SmartChatWindow({ open, onClose, apiKey, soapContext }) {
  const prompts = usePrompts();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleResetSession = () => {
    if (messages.length === 0) return;
    if (window.confirm('Yakin ingin mereset sesi SMART? Semua percakapan akan dihapus.')) {
      setMessages([]);
      setInput('');
      setImages([]);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    const newImages = await Promise.all(files.map(async file => {
      const base64Data = await fileToBase64(file);
      return { preview: URL.createObjectURL(file), ...base64Data };
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && images.length === 0) || loading) return;
    setLoading(true);

    const userMsg = { role: 'user', text: input, images: [...images] };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setImages([]);

    try {
      const contents = [];
      updatedMessages.forEach((msg, idx) => {
        const parts = [];
        if (idx === 0 && msg.role === 'user' && soapContext) {
          parts.push({ text: `[Konteks SOAP pasien saat ini]\n${soapContext}\n\n[Pertanyaan]\n${msg.text}` });
        } else {
          parts.push({ text: msg.text || '' });
        }
        if (msg.images && msg.images.length > 0) {
          msg.images.forEach(img => {
            parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
          });
        }
        contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts });
      });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const payload = {
        contents,
        systemInstruction: { parts: [{ text: prompts?.smart || SMART_SYSTEM_PROMPT }] }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error('API Key tidak valid. Periksa API Key di Settings.');
        }
        throw new Error(errorData.error?.message || `Error: ${response.status}`);
      }

      const data = await response.json();
      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons.';
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${err.message}`, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#1A2E26] max-h-[90vh] overflow-hidden flex flex-col p-0 border-[#2C4A3B]" data-testid="smart-chat-window">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-medium text-white">SMART</h3>
              <p className="text-xs text-white/50">Asisten Dokter Jaga IGD</p>
            </div>
          </div>
          <Button
            data-testid="smart-reset-btn"
            variant="ghost"
            size="sm"
            onClick={handleResetSession}
            disabled={messages.length === 0}
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="text-xs">Reset Sesi</span>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[300px] max-h-[55vh]">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500/30 mx-auto mb-3" />
              <p className="text-white/40 text-sm">Tanyakan apapun tentang pasien ini.</p>
              <p className="text-white/30 text-xs mt-1">SMART membaca konteks SOAP Anda secara otomatis.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[#2C4A3B] text-white'
                  : msg.isError
                  ? 'bg-red-500/20 text-red-200 border border-red-500/30'
                  : 'bg-white/10 text-white/90'
              }`}>
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-2">
                    {msg.images.map((img, i) => (
                      <img key={i} src={img.preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/20" />
                    ))}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{
                  msg.role === 'model' && !msg.isError
                    ? msg.text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={i}>{part.slice(2, -2)}</strong>
                          : part
                      )
                    : msg.text
                }</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span className="text-white/60 text-sm">SMART sedang berpikir...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-14 h-14 rounded-lg border border-white/20 overflow-hidden group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <label className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer transition flex-shrink-0">
              <Upload className="w-4 h-4 text-white/60" />
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <Textarea
              data-testid="smart-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ketik pertanyaan..."
              className="flex-1 min-h-[44px] max-h-[120px] bg-white/10 border-white/20 text-white placeholder:text-white/40 resize-none"
              rows={1}
            />
            <Button
              data-testid="smart-send-btn"
              onClick={handleSend}
              disabled={loading || (!input.trim() && images.length === 0)}
              className="h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tanyakan SMART'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [showPromptEditor, setShowPromptEditor] = useState(false);

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
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2C4A3B]" />
              Admin Panel
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Edit Prompts Button */}
            <div className="p-4 bg-[#2C4A3B]/5 border border-[#2C4A3B]/20 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-sm font-bold text-[#2C4A3B] flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    System Prompts
                  </Label>
                  <p className="text-xs text-[#5C6B64]">
                    Edit prompt AI untuk Anam, Oppa, Diag, dan Palui
                  </p>
                </div>
                <Button
                  data-testid="edit-prompts-btn"
                  onClick={() => setShowPromptEditor(true)}
                  className="bg-[#2C4A3B] hover:bg-[#1A2E26] text-white gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Prompts
                </Button>
              </div>
            </div>

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

      {/* Prompt Editor Modal */}
      <PromptEditorModal open={showPromptEditor} onClose={() => setShowPromptEditor(false)} />
    </>
  );
}

// Login Component with password attempt limiting
function LoginPage({ onLogin, onSignOut }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [canReset, setCanReset] = useState(true);
  const [showResetOption, setShowResetOption] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const clientId = getClientId();

  const checkPasswordStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/whitelist/password-status/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setIsLocked(data.is_locked);
        setLockedUntil(data.locked_until);
        setAttemptsRemaining(data.attempts_remaining);
        setCanReset(data.reset_attempts_remaining > 0);
      }
    } catch (err) {
      console.error('Error checking password status:', err);
    }
  }, [clientId]);

  useEffect(() => {
    if (showPasswordModal) {
      checkPasswordStatus();
    }
  }, [showPasswordModal, checkPasswordStatus]);

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
        body: JSON.stringify({ password, client_id: clientId })
      });
      
      // Try to get response text and parse it, with fallback for consumed body
      let data;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch (parseErr) {
        // If body was already consumed, use status code to determine response
        if (res.status === 429) {
          data = { detail: { message: 'Akun terkunci', can_reset: true } };
        } else if (res.status === 401) {
          data = { detail: { message: 'Password tidak valid', attempts_remaining: 2 } };
        } else {
          data = {};
        }
      }
      
      if (res.status === 429) {
        setIsLocked(true);
        setLockedUntil(data.detail?.locked_until);
        setCanReset(data.detail?.can_reset);
        setShowResetOption(true);
        setPasswordError(data.detail?.message || 'Akun terkunci');
        return;
      }
      
      if (!res.ok) {
        setPasswordError(data.detail?.message || 'Password tidak valid');
        setAttemptsRemaining(data.detail?.attempts_remaining || 0);
        return;
      }
      
      setShowPasswordModal(false);
      setPassword('');
      setShowWhitelistModal(true);
      setIsLocked(false);
      setShowResetOption(false);
    } catch (err) {
      setPasswordError(err.message || 'Terjadi kesalahan');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleResetTimer = async () => {
    setResetLoading(true);
    try {
      const res = await fetch(`${API}/whitelist/reset-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword, client_id: clientId })
      });
      
      // Try to get response text and parse it, with fallback for consumed body
      let data;
      try {
        const text = await res.text();
        data = JSON.parse(text);
      } catch (parseErr) {
        if (res.status === 401) {
          data = { detail: { message: 'Password tidak valid untuk reset' } };
        } else if (res.status === 429) {
          data = { detail: { message: 'Batas reset tercapai' } };
        } else {
          data = { reset_attempts_remaining: 2 };
        }
      }
      
      if (!res.ok) {
        setPasswordError(data.detail?.message || 'Gagal reset timer');
        return;
      }
      
      setIsLocked(false);
      setShowResetOption(false);
      setResetPassword('');
      setPasswordError('');
      setAttemptsRemaining(3);
      alert(`Timer berhasil direset! Sisa reset: ${data.reset_attempts_remaining}`);
    } catch (err) {
      setPasswordError(err.message || 'Gagal reset timer');
    } finally {
      setResetLoading(false);
    }
  };

  const formatLockedTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
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
              <Shield className="w-4 h-4" />
              Admin Panel
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
            {isLocked && !showResetOption ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600">
                  <Lock className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">Akun Terkunci</p>
                  <p className="text-xs text-[#5C6B64] mt-1">
                    Terlalu banyak percobaan gagal.<br />
                    Terkunci sampai: {formatLockedTime(lockedUntil)}
                  </p>
                </div>
                {canReset && (
                  <Button
                    onClick={() => setShowResetOption(true)}
                    variant="outline"
                    className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset Timer
                  </Button>
                )}
              </div>
            ) : showResetOption ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm font-medium text-[#1A2E26]">Reset Timer</p>
                  <p className="text-xs text-[#5C6B64] mt-1">Masukkan password untuk reset timer</p>
                </div>
                <Input
                  type="password"
                  placeholder="Password admin"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="bg-[#F8F7F3] border-[#E3E0D8]"
                />
                {passwordError && (
                  <p className="text-sm text-red-600">{passwordError}</p>
                )}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowResetOption(false);
                      setResetPassword('');
                      setPasswordError('');
                    }} 
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button 
                    onClick={handleResetTimer}
                    disabled={resetLoading || !resetPassword}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                  <p className="text-xs text-[#5C6B64]">
                    Sisa percobaan: <span className={attemptsRemaining <= 1 ? 'text-red-600 font-bold' : ''}>{attemptsRemaining}</span>
                  </p>
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
              </>
            )}
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

// Main App Component - Import from separate file for cleaner code
// ... (keeping the MainApp component the same as before but with prompt loading from API)

// Export a simplified version that loads prompts from API
function MainAppWrapper({ user, apiKey, onLogout, onChangeApiKey, checkWhitelist }) {
  const [prompts, setPrompts] = useState(null);
  const [promptsLoading, setPromptsLoading] = useState(true);

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const res = await fetch(`${API}/prompts`);
        if (res.ok) {
          const data = await res.json();
          setPrompts(data);
        }
      } catch (err) {
        console.error('Error loading prompts:', err);
      } finally {
        setPromptsLoading(false);
      }
    };
    loadPrompts();
  }, []);

  if (promptsLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#2C4A3B]" />
          <p className="text-[#5C6B64]">Memuat prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <PromptsContext.Provider value={prompts}>
      <MainApp 
        user={user} 
        apiKey={apiKey} 
        onLogout={onLogout}
        onChangeApiKey={onChangeApiKey}
        checkWhitelist={checkWhitelist}
      />
    </PromptsContext.Provider>
  );
}

// Main App Component (keeping the same logic but using prompts from context)
function MainApp({ user, apiKey, onLogout, onChangeApiKey, checkWhitelist }) {
  const prompts = usePrompts();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSmart, setShowSmart] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(null);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [detailAnamConfirmed, setDetailAnamConfirmed] = useState(false);
  
  // Patient Identity
  const [patientIdentity, setPatientIdentity] = useState('');
  
  // Anam State
  const [anamInput, setAnamInput] = useState('');
  const [anamNarrative, setAnamNarrative] = useState('');
  const [anamSaran, setAnamSaran] = useState('');
  const [anamAlert, setAnamAlert] = useState('');
  const [isAnamLoading, setIsAnamLoading] = useState(false);
  const [isAnamFollowUp, setIsAnamFollowUp] = useState(false);
  const [anamFollowUpCount, setAnamFollowUpCount] = useState(0);

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
  const [statusGeneralisTemplate, setStatusGeneralisTemplate] = useState(null);

  // Per-user localStorage keys
  const userKey = useCallback((key) => `aiSquad_${user?.id || 'default'}_${key}`, [user]);

  // Load/Save localStorage (per-user)
  useEffect(() => {
    if (!user?.id) return;
    const savedAuto = localStorage.getItem(userKey('autotexts'));
    const savedGreeting = localStorage.getItem(userKey('greeting'));
    const savedWa = localStorage.getItem(userKey('wa'));
    const savedSGTemplate = localStorage.getItem(userKey('statusGeneralisTemplate'));
    if (savedAuto) setAutotexts(JSON.parse(savedAuto));
    if (savedGreeting) setGreetingTemplate(savedGreeting);
    if (savedWa) setWhatsappNumber(savedWa);
    if (savedSGTemplate) {
      setStatusGeneralisTemplate(savedSGTemplate);
      setManualStatusGeneralis(savedSGTemplate);
    }
  }, [user, userKey]);

  useEffect(() => {
    if (!user?.id) return;

    const loadStatusGeneralisTemplate = async () => {
      const localTemplate = localStorage.getItem(userKey('statusGeneralisTemplate'));

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('status_generalis_template, onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        const onboardingDone = data?.onboarding_completed === true;
        if (!onboardingDone) {
          setShowOnboarding(true);
          setOnboardingMode(null);
          setOnboardingStepIndex(0);
          setDetailAnamConfirmed(false);
        }

        const remoteTemplate = data?.status_generalis_template;
        if (remoteTemplate) {
          setStatusGeneralisTemplate(remoteTemplate);
          setManualStatusGeneralis(remoteTemplate);
          localStorage.setItem(userKey('statusGeneralisTemplate'), remoteTemplate);
          return;
        }

        if (localTemplate) {
          await supabase.from('user_preferences').upsert({
            user_id: user.id,
            status_generalis_template: localTemplate,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Error loading status generalis template:', err);
      }
    };

    loadStatusGeneralisTemplate();
  }, [user, userKey]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(userKey('autotexts'), JSON.stringify(autotexts));
    localStorage.setItem(userKey('greeting'), greetingTemplate);
    localStorage.setItem(userKey('wa'), whatsappNumber);
  }, [autotexts, greetingTemplate, whatsappNumber, user, userKey]);

  const handleSaveStatusGeneralisTemplate = async () => {
    setStatusGeneralisTemplate(manualStatusGeneralis);
    localStorage.setItem(userKey('statusGeneralisTemplate'), manualStatusGeneralis);

    if (!user?.id) return;

    try {
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        status_generalis_template: manualStatusGeneralis,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving status generalis template:', err);
      alert('Template gagal disimpan ke akun. Template lokal tetap tersimpan di browser ini.');
    }
  };

  const openOnboarding = () => {
    setShowOnboarding(true);
    setOnboardingMode(null);
    setOnboardingStepIndex(0);
    setDetailAnamConfirmed(false);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    setOnboardingMode(null);
    setOnboardingStepIndex(0);
  };

  const completeOnboarding = async () => {
    closeOnboarding();

    if (!user?.id) return;

    try {
      const { error } = await supabase.from('user_preferences').upsert({
        user_id: user.id,
        status_generalis_template: statusGeneralisTemplate || null,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving onboarding completion:', err);
    }
  };

  const activeOnboardingSteps = onboardingMode === 'brief'
    ? ONBOARDING_BRIEF_STEPS
    : onboardingMode === 'detail'
    ? ONBOARDING_DETAIL_STEPS
    : [];

  const activeOnboardingStep = activeOnboardingSteps[onboardingStepIndex] || null;

  const onboardingCanProceed = !showOnboarding || !activeOnboardingStep || (() => {
    if (onboardingMode !== 'detail') return true;

    switch (activeOnboardingStep.key) {
      case 'detail-anam-step':
        return detailAnamConfirmed;
      case 'detail-anam-input':
        return anamInput.trim().length > 0;
      case 'detail-anam-process':
        return anamNarrative.trim().length > 0;
      case 'detail-anam-followup':
        return anamFollowUpCount >= 1;
      default:
        return true;
    }
  })();

  useEffect(() => {
    if (!showOnboarding || onboardingMode !== 'detail') return;

    if (activeOnboardingStep?.key === 'detail-anam-input' && !anamInput.trim()) {
      setCurrentStep(1);
      setAnamInput(ONBOARDING_SAMPLE_ANAM);
    }
  }, [showOnboarding, onboardingMode, activeOnboardingStep, anamInput]);

  useEffect(() => {
    if (!showOnboarding || !onboardingMode) return;

    if (['brief-oppa', 'detail-oppa'].includes(activeOnboardingStep?.key)) {
      setCurrentStep(2);
      return;
    }

    if (['brief-diag', 'detail-diag'].includes(activeOnboardingStep?.key)) {
      setCurrentStep(3);
      return;
    }

    if (['brief-palui', 'detail-palui'].includes(activeOnboardingStep?.key)) {
      setCurrentStep(4);
      return;
    }

    if (activeOnboardingStep?.key === 'brief-anam') {
      setCurrentStep(1);
      return;
    }

  }, [showOnboarding, onboardingMode, activeOnboardingStep]);

  // New Session Handler
  const handleNewSession = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    if(window.confirm("Yakin ingin memulai sesi pasien baru? Semua data saat ini akan dihapus.")) {
      setCurrentStep(1);
      setPatientIdentity('');
      setAnamInput('');
      setAnamNarrative('');
      setAnamSaran('');
      setAnamAlert('');
      setIsAnamFollowUp(false);
      setAnamFollowUpCount(0);
      setOppaMode('AI');
      setVitals({ kes: 'CM', gcs: 'E4V5M6', td: '120/80', n: '80', rr: '20', t: '36.5', spo2: '98% RA' });
      setAbnormalFinding('');
      setOppaImages([]);
      setOppaOutput('');
      setManualStatusGeneralis(statusGeneralisTemplate || DEFAULT_STATUS_GENERALIS);
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
  };

  // ANAM Handler - using prompts from context
  const handleAnamProcess = async () => {
    const isAllowed = await checkWhitelist();
    if (!isAllowed) return;
    
    if (!anamInput.trim()) return;
    setIsAnamLoading(true);
    setAnamAlert('');
    const wasFollowUp = isAnamFollowUp;
    
    let warnings = [];
    const lowerInput = anamInput.toLowerCase();
    const fullContext = (anamNarrative + " " + lowerInput).toLowerCase();
    if (!fullContext.includes('rpd') && !fullContext.match(/riwayat.*dahulu/)) warnings.push("RPD belum ditanyakan.");
    if (!fullContext.includes('rpk') && !fullContext.match(/riwayat.*keluarga/)) warnings.push("RPK belum ditanyakan.");
    if (!fullContext.includes('alergi')) warnings.push("Riwayat Alergi belum dipastikan!");

    if (warnings.length > 0) {
      setAnamAlert(warnings.join(' '));
    }

    const systemPrompt = prompts?.anam || '';

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
      if (wasFollowUp) {
        setAnamFollowUpCount(prev => prev + 1);
      }

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

    const systemPrompt = prompts?.oppa || '';
    const sgTemplate = statusGeneralisTemplate || DEFAULT_STATUS_GENERALIS;
    const formatInstruction = `\n\nPENTING: Gunakan format pemeriksaan fisik berikut sebagai template output Status Generalis:\n${sgTemplate}\n\nIsi setiap bagian sesuai temuan klinis. Pertahankan struktur dan urutan format di atas.`;

    let userPromptText = `Abnormal finding: ${abnormalFinding}${formatInstruction}`;

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

    const systemPrompt = prompts?.diag || '';

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

    const systemPrompt = prompts?.palui || '';

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

    // Save to Supabase history
    try {
      await supabase.from('soap_history').insert({
        user_id: user.id,
        patient_identity: patientIdentity,
        final_soap: compiled,
        interpretation: diagInterpretation || null,
      });
    } catch (err) {
      console.error('Error saving to history:', err);
    }
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
    if (showOnboarding && onboardingMode === 'detail' && activeOnboardingStep?.key === 'detail-anam-step' && step === 1) {
      setDetailAnamConfirmed(true);
    }
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

              <Button
                data-testid="onboarding-btn"
                variant="outline"
                size="sm"
                onClick={openOnboarding}
                className="border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3] gap-2"
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Cara Pakai AI Medical Squad</span>
              </Button>

              <Button
                data-testid="history-btn"
                variant="outline"
                size="icon"
                onClick={() => setShowHistory(true)}
                className="border-[#E3E0D8] text-[#1A2E26] hover:bg-[#F8F7F3]"
              >
                <History className="w-4 h-4" />
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
                <button
                  data-testid="profile-btn"
                  onClick={() => setShowProfile(true)}
                  className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-[#2C4A3B] transition flex-shrink-0"
                >
                  {(user?.user_metadata?.avatar_url || user?.user_metadata?.picture) ? (
                    <img src={user.user_metadata.avatar_url || user.user_metadata.picture} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-[#2C4A3B] text-white flex items-center justify-center text-sm font-medium">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                </button>
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
            <nav data-testid="soap-steps-nav" className="sticky top-24 bg-white rounded-2xl border border-[#E3E0D8] overflow-hidden">
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

          {/* Main Content Area - Render steps based on currentStep */}
          <main className="flex-1 min-w-0">
            {/* Step content rendering based on currentStep - keeping same as before */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-1-anamnesis">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Anamnesis</h2>
                      <p className="text-sm text-[#5C6B64] mt-1">Subjective - Keluhan dan riwayat pasien</p>
                    </div>
                    {isAnamFollowUp && (
                      <Button variant="outline" size="sm" onClick={handleNewSession} className="border-[#C56F5D] text-[#C56F5D] hover:bg-[#C56F5D]/10">
                        <RefreshCw className="w-3 h-3 mr-2" />Reset
                      </Button>
                    )}
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  {anamNarrative && (
                    <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-[#3B6051]"></div>
                        <span className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64]">Narasi Saat Ini</span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap text-[#1A2E26] font-mono leading-relaxed">{anamNarrative}</div>
                    </div>
                  )}
                  {anamSaran && (
                    <div className="p-4 bg-[#2C4A3B]/5 rounded-xl border-l-4 border-[#2C4A3B]">
                      <h3 className="text-sm font-bold text-[#2C4A3B] mb-3">Analisis & Saran Penggalian:</h3>
                      <div className="text-sm leading-relaxed text-[#1A2E26]">
                        {anamSaran.split('\n').map((line, idx) => {
                          const trimmed = line.trim();
                          if (!trimmed) return <div key={idx} className="h-2"></div>;
                          if (trimmed.startsWith('-')) return <div key={idx} className="ml-4 mb-1 text-[#5C6B64]">{trimmed}</div>;
                          return <div key={idx} className="font-bold text-[#2C4A3B] mt-4 mb-1">{trimmed.replace(/\*/g, '')}</div>;
                        })}
                      </div>
                    </div>
                  )}
                  <div className={`space-y-4 sticky bottom-0 z-10 bg-white -mx-6 px-6 pb-6 -mb-6 pt-4 rounded-b-2xl ${(anamNarrative || anamSaran) ? 'shadow-[0_-4px_12px_rgba(0,0,0,0.06)] border-t border-[#E3E0D8]' : ''}`}>
                    <Textarea data-testid="anam-input" placeholder={isAnamFollowUp ? "Ketik tambahan info..." : "Ketik keluhan pasien..."} value={anamInput} onChange={(e) => setAnamInput(e.target.value)} className="min-h-[120px] bg-[#F8F7F3] border-[#E3E0D8] resize-none" />
                    {anamAlert && (<div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{anamAlert}</span></div>)}
                    <Button data-testid="process-anam-btn" onClick={handleAnamProcess} disabled={isAnamLoading || !anamInput.trim()} className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white font-medium">
                      {isAnamLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>) : (isAnamFollowUp ? 'Lanjutkan Analisa' : 'Olah Anamnesis')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-2-physical">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div><h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Pemeriksaan Fisik</h2><p className="text-sm text-[#5C6B64] mt-1">Objective</p></div>
                    <Tabs value={oppaMode} onValueChange={setOppaMode}><TabsList className="bg-[#E3E0D8]"><TabsTrigger value="AI" className="data-[state=active]:bg-white">AI</TabsTrigger><TabsTrigger value="Manual" className="data-[state=active]:bg-white">Manual</TabsTrigger></TabsList></Tabs>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]">
                    <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-[#5C6B64] mb-4">Tanda Vital</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[{l:'Kes',k:'kes'},{l:'GCS',k:'gcs'},{l:'TD',k:'td'},{l:'N',k:'n'},{l:'RR',k:'rr'},{l:'T',k:'t'},{l:'SpO2',k:'spo2'}].map(i=>(
                        <div key={i.k}><Label className="text-xs text-[#5C6B64]">{i.l}</Label><Input value={vitals[i.k]} onChange={(e)=>setVitals({...vitals,[i.k]:e.target.value})} onFocus={(e)=>e.target.select()} className="bg-white border-[#E3E0D8]"/></div>
                      ))}
                    </div>
                  </div>
                  {oppaMode === 'AI' ? (
                    <div className="space-y-4">
                      <div><Label className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8F7F3] border border-dashed border-[#E3E0D8] rounded-lg cursor-pointer hover:bg-[#E3E0D8]/50"><Upload className="w-4 h-4" /><span className="text-sm text-[#5C6B64]">Upload Foto Klinis</span><input type="file" multiple accept="image/*" onChange={handleOppaImageUpload} className="hidden"/></Label>
                        {oppaImages.length > 0 && (<div className="flex gap-3 flex-wrap mt-3">{oppaImages.map((img,idx)=>(<div key={idx} className="relative w-16 h-16 rounded-lg border overflow-hidden group"><img src={img.preview} alt="" className="w-full h-full object-cover"/><button onClick={()=>setOppaImages(oppaImages.filter((_,i)=>i!==idx))} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4"/></button></div>))}</div>)}
                      </div>
                      <Textarea placeholder="Abnormal finding..." value={abnormalFinding} onChange={(e)=>setAbnormalFinding(e.target.value)} className="min-h-[80px] bg-[#F8F7F3] border-[#E3E0D8]"/>
                      <Button onClick={handleOppaProcessAI} disabled={isOppaLoading} className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white">{isOppaLoading?<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Menyusun...</>:'Format Fisik (AI)'}</Button>
                      {oppaOutput && <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]"><pre className="text-sm whitespace-pre-wrap font-mono">{oppaOutput}</pre></div>}
                    </div>
                  ) : (
                    <div className="space-y-3"><Label className="text-xs font-bold uppercase text-[#5C6B64]">Status Generalis</Label><Textarea value={manualStatusGeneralis} onChange={(e)=>setManualStatusGeneralis(e.target.value)} className="min-h-[400px] bg-[#F8F7F3] border-[#E3E0D8] font-mono text-sm"/>
                      {manualStatusGeneralis !== (statusGeneralisTemplate || DEFAULT_STATUS_GENERALIS) && (
                        <Button data-testid="save-sg-template-btn" onClick={handleSaveStatusGeneralisTemplate} className="w-full bg-[#2C4A3B] hover:bg-[#1A2E26] text-white"><Save className="w-4 h-4 mr-2"/>Simpan Template Status Generalis</Button>
                      )}
                      {statusGeneralisTemplate && statusGeneralisTemplate !== DEFAULT_STATUS_GENERALIS && (
                        <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/>Template tersimpan</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-3-assessment">
                <div className="p-6 border-b border-[#E3E0D8]"><h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Assessment</h2><p className="text-sm text-[#5C6B64] mt-1">Diagnosis</p></div>
                <div className="p-6 space-y-6">
                  <div><Label className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8F7F3] border border-dashed border-[#E3E0D8] rounded-lg cursor-pointer"><Upload className="w-4 h-4"/><span className="text-sm text-[#5C6B64]">Upload Penunjang</span><input type="file" multiple accept="image/*" onChange={handleDiagImageUpload} className="hidden"/></Label>
                    {diagImages.length > 0 && <div className="flex gap-3 flex-wrap mt-3">{diagImages.map((img,idx)=>(<div key={idx} className="relative w-16 h-16 rounded-lg border overflow-hidden group"><img src={img.preview} alt="" className="w-full h-full object-cover"/><button onClick={()=>setDiagImages(diagImages.filter((_,i)=>i!==idx))} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X className="w-4 h-4"/></button></div>))}</div>}
                  </div>
                  {diagInterpretation && <div className="p-4 bg-[#2C4A3B]/5 rounded-xl border border-[#2C4A3B]/20"><h3 className="text-sm font-bold text-[#2C4A3B] mb-2">Interpretasi:</h3><p className="text-sm">{diagInterpretation}</p></div>}
                  <div><Label className="text-xs font-bold uppercase text-[#5C6B64]">Diagnosis</Label><Textarea placeholder="Diagnosis..." value={diagText} onChange={(e)=>setDiagText(e.target.value)} className="min-h-[100px] bg-[#F8F7F3] border-[#E3E0D8] font-medium"/></div>
                  <Button onClick={handleDiagProcess} disabled={isDiagLoading} className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white">{isDiagLoading?<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Menganalisa...</>:(isDiagGenerated?'Olah Ulang':'Olah Diagnosa')}</Button>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="bg-white rounded-2xl border border-[#E3E0D8] animate-fade-in" data-testid="step-4-planning">
                <div className="p-6 border-b border-[#E3E0D8]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div><h2 className="font-heading text-2xl font-medium text-[#1A2E26]">Planning</h2><p className="text-sm text-[#5C6B64] mt-1">Terapi</p></div>
                    <Tabs value={paluiMode} onValueChange={setPaluiMode}><TabsList className="bg-[#E3E0D8]"><TabsTrigger value="AI" className="data-[state=active]:bg-white">AI</TabsTrigger><TabsTrigger value="Manual" className="data-[state=active]:bg-white">Manual</TabsTrigger></TabsList></Tabs>
                  </div>
                </div>
                <div className="p-6 space-y-6">
                  {paluiMode === 'AI' ? (
                    <div className="space-y-4">
                      <Textarea placeholder="[Monitoring]&#10;[Terapi]..." value={paluiInput} onChange={(e)=>setPaluiInput(e.target.value)} className="min-h-[160px] bg-[#F8F7F3] border-[#E3E0D8] font-mono"/>
                      <Button onClick={handlePaluiProcess} disabled={isPaluiLoading||!paluiInput.trim()} className="w-full h-12 bg-[#2C4A3B] hover:bg-[#1A2E26] text-white">{isPaluiLoading?<><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Merapikan...</>:'Olah Planning'}</Button>
                      {paluiOutput && <div className="p-4 bg-[#F8F7F3] rounded-xl border border-[#E3E0D8]"><pre className="text-sm whitespace-pre-wrap font-mono">{paluiOutput}</pre></div>}
                    </div>
                  ) : (
                    <div><Label className="text-xs font-bold uppercase text-[#5C6B64]">Planning Manual</Label><Textarea value={manualPalui} onChange={(e)=>setManualPalui(e.target.value)} placeholder="Ketik planning..." className="min-h-[250px] bg-[#F8F7F3] border-[#E3E0D8] font-mono"/></div>
                  )}
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="bg-[#1A2E26] rounded-2xl overflow-hidden animate-fade-in" data-testid="step-5-final">
                <div className="p-6 border-b border-white/10"><h2 className="font-heading text-2xl font-medium text-white">Final SOAP</h2><p className="text-sm text-white/60 mt-1">Identitas & Kirim</p></div>
                <div className="p-6 space-y-6">
                  <div><Label className="text-xs font-bold uppercase text-white/60">Identitas Pasien</Label><Input placeholder="Contoh: An. Syafrie / 13 tahun / BB 40kg / BPJS PBI" value={patientIdentity} onChange={(e)=>setPatientIdentity(e.target.value)} className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"/></div>
                  {ezzyError && <div className="flex items-start gap-2 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5"/><span>{ezzyError}</span></div>}
                  <Button onClick={handleEzzyGenerate} className="w-full h-14 bg-[#C56F5D] hover:bg-[#A65B4C] text-white font-bold text-lg">GENERATE SOAP</Button>
                  {finalSoap && (
                    <div className="space-y-4 pt-6 border-t border-white/10">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button onClick={handleNewSession} variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"><RefreshCw className="w-4 h-4 mr-2"/>Sesi Baru</Button>
                        <Button onClick={handleSendWA} className="flex-1 bg-green-600 hover:bg-green-700 text-white"><MessageCircle className="w-4 h-4 mr-2"/>WhatsApp</Button>
                        <Button onClick={handleCopyClipboard} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10"><Copy className="w-4 h-4 mr-2"/>Copy</Button>
                      </div>
                      <Textarea readOnly value={finalSoap} className="min-h-[400px] bg-white text-[#1A2E26] border-0 font-mono text-sm resize-none"/>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6">
              <Button onClick={()=>handleStepChange(Math.max(1,currentStep-1))} variant="outline" className={`border-[#E3E0D8] text-[#1A2E26] ${currentStep===1?'opacity-0 pointer-events-none':''}`}><ChevronLeft className="w-4 h-4 mr-2"/>Kembali</Button>
              <Button onClick={()=>handleStepChange(Math.min(5,currentStep+1))} className={`bg-[#2C4A3B] hover:bg-[#1A2E26] text-white ${currentStep===5?'opacity-0 pointer-events-none':''}`}>Selanjutnya<ChevronRight className="w-4 h-4 ml-2"/></Button>
            </div>
          </main>
        </div>
      </div>

      <HistoryModal open={showHistory} onClose={() => setShowHistory(false)} user={user} />
      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} user={user} />
      <SmartChatWindow open={showSmart} onClose={() => setShowSmart(false)} apiKey={apiKey} soapContext={finalSoap} />
      <OnboardingTour
        open={showOnboarding}
        mode={onboardingMode}
        stepIndex={onboardingStepIndex}
        onSelectMode={(mode) => {
          setOnboardingMode(mode);
          setOnboardingStepIndex(0);
          setDetailAnamConfirmed(false);
        }}
        onSkip={closeOnboarding}
        onPrev={() => setOnboardingStepIndex((prev) => Math.max(0, prev - 1))}
        onNext={() => {
          if (!activeOnboardingSteps.length) return;
          if (onboardingStepIndex >= activeOnboardingSteps.length - 1) {
            completeOnboarding();
            return;
          }
          setOnboardingStepIndex((prev) => prev + 1);
        }}
        canProceed={onboardingCanProceed}
        completionLabel={activeOnboardingStep?.completionLabel}
      />

      {/* SMART Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center group" data-testid="smart-fab">
        <div
          data-testid="smart-warning-btn"
          onClick={() => setShowSmart(true)}
          className="w-16 h-16 rounded-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 shadow-lg shadow-amber-400/30 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 animate-pulse hover:animate-none"
        >
          <AlertTriangle className="w-8 h-8 text-[#1A2E26]" />
        </div>
        <span className="mt-2 px-3 py-1 rounded-full bg-[#1A2E26] text-amber-400 text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 sm:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 pointer-events-none select-none">
          SMART
        </span>
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
        if (error) console.error('Session error:', error);
        if (session?.user) {
          setUser(session.user);
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
          if (storedKey) setApiKey(storedKey);
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
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
        if (storedKey) setApiKey(storedKey);
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
        if (storedKey) setApiKey(storedKey);
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

  const handleApiKeyComplete = (key) => setApiKey(key);
  const handleChangeApiKey = () => {
    if (user) localStorage.removeItem(`gemini_api_key_${user.id}`);
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

  if (accessDenied && user) return <AccessDeniedPage onSignOut={handleLogout} />;
  if (!user) return <LoginPage onLogin={setUser} onSignOut={handleLogout} />;
  if (!apiKey) return <ApiKeySetup user={user} onComplete={handleApiKeyComplete} onSignOut={handleLogout} />;

  return <MainAppWrapper user={user} apiKey={apiKey} onLogout={handleLogout} onChangeApiKey={handleChangeApiKey} checkWhitelist={checkWhitelist} />;
}
