
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const API = "https://legal-ai-production-2548.up.railway.app";
const supabase = createClient(
  "https://taodusjrsoxpnyirbneu.supabase.co",
  "sb_publishable_T_TinfVHGYCsNgl59KuUBg_CPYF8NPV"
);

const TABS = [
  { id: "draft", label: "صياغة المرافعات", icon: "⚖️" },
  { id: "translate", label: "الترجمة", icon: "🌐" },
  { id: "pricing", label: "الباقات", icon: "◆" },
];

const DOC_TYPES = [
  { id: "claim", label: "صحيفة دعوى", sub: "Statement of Claim" },
  { id: "appeal", label: "لائحة اعتراضية", sub: "Appeal" },
  { id: "response", label: "مذكرة جوابية", sub: "Response" },
  { id: "enforcement", label: "طلب تنفيذ", sub: "Enforcement" },
  { id: "supplementary", label: "مذكرة تكميلية", sub: "Supplementary" },
  { id: "reconsideration", label: "التماس إعادة نظر", sub: "Reconsideration" },
];

const TRANS_DIR = [
  { id: "en_to_ar", label: "EN → عربي" },
  { id: "ar_to_en", label: "عربي → EN" },
];

const PLANS = {
  free: { ar: "تجريبي", en: "Free", mo: 0, yr: 0, lim: { d: 3, t: 5 }, color: "#9ca3af", feat: ["3 صياغات شهرياً", "5 ترجمات شهرياً", "جميع أنواع الوثائق"] },
  individual: { ar: "فردي", en: "Individual", mo: 149, yr: 1490, lim: { d: 30, t: 50 }, color: "#1e3a5f", feat: ["30 صياغة شهرياً", "50 ترجمة شهرياً", "جميع أنواع الوثائق", "أولوية المعالجة", "تصدير Word"] },
  professional: { ar: "احترافي", en: "Professional", mo: 399, yr: 3990, lim: { d: 100, t: 200 }, color: "#7c3aed", feat: ["100 صياغة شهرياً", "200 ترجمة شهرياً", "أولوية قصوى", "تصدير متعدد", "دعم متقدم"] },
  team: { ar: "فريق", en: "Team", mo: 249, yr: 2490, pu: true, lim: { d: 80, t: 150 }, color: "#059669", feat: ["80 صياغة / مستخدم", "150 ترجمة / مستخدم", "لوحة إدارة", "مشاركة القوالب", "3+ مستخدمين", "دعم مخصص"] },
};

const renderMarkdown = (text) => {
  return text
    .replace(/^####\s+(.+)$/gm, '$1')
    .replace(/^###\s+(.+)$/gm, '$1')
    .replace(/^##\s+(.+)$/gm, '$1')
    .replace(/^#\s+(.+)$/gm, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^---$/gm, '─────────────────────')
    .trim();
};

// ─── Pure utility functions (outside component) ───────────────────────────
const BLOCKED_DOMAINS = ["mailinator.com","guerrillamail.com","tempmail.com","throwam.com","sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info","guerrillamail.biz","guerrillamail.de","guerrillamail.net","guerrillamail.org","spam4.me","trashmail.com","trashmail.me","trashmail.net","dispostable.com","yopmail.com","emailondeck.com","10minutemail.com","10minutemail.net","fakeinbox.com","mailnull.com","spamgourmet.com","spamgourmet.net","spamgourmet.org","emailax.pro","maildrop.cc","discard.email","spamspot.com","spamthisplease.com","spamhereplease.com"];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isDisposableEmail = (email) => {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? BLOCKED_DOMAINS.includes(domain) : false;
};

const validatePassword = (p) => {
  if (p.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (!/[A-Z]/.test(p)) return "يجب أن تحتوي على حرف كبير واحد على الأقل";
  if (!/[0-9]/.test(p)) return "يجب أن تحتوي على رقم واحد على الأقل";
  return null;
};

const getPasswordStrength = (p) => {
  if (!p) return null;
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 1) return { level: "ضعيفة", color: "#ef4444", width: "25%" };
  if (score <= 2) return { level: "متوسطة", color: "#f59e0b", width: "50%" };
  if (score <= 3) return { level: "جيدة", color: "#3b82f6", width: "75%" };
  return { level: "قوية", color: "#10b981", width: "100%" };
};

const translateAuthError = (msg) => {
  if (!msg) return "حدث خطأ غير متوقع";
  if (msg.includes("Invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (msg.includes("Email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني أولاً";
  if (msg.includes("User already registered")) return "هذا البريد الإلكتروني مسجل مسبقاً";
  if (msg.includes("Password should be at least")) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (msg.includes("Invalid email")) return "البريد الإلكتروني غير صحيح";
  if (msg.includes("Email rate limit")) return "تم تجاوز الحد المسموح، حاول لاحقاً";
  return msg;
};
// ──────────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useState(false);
  const [session, setSession] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [tab, setTab] = useState("draft");
  const [docType, setDocType] = useState("claim");
  const [transDir, setTransDir] = useState("en_to_ar");
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [billing, setBilling] = useState("monthly");
  const [plan, setPlan] = useState("free");
  const [quotaErr, setQuotaErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_e, s) => setSession(s));
  }, []);

  const d = {
    bg: dark ? "#0d1117" : "#fafafa",
    surface: dark ? "#161b22" : "#ffffff",
    surface2: dark ? "#1e2530" : "#f6f8fa",
    border: dark ? "#30363d" : "#e5e7eb",
    text: dark ? "#e6edf3" : "#24292f",
    muted: dark ? "#8b949e" : "#6b7280",
    gold: "#c9a84c",
    goldLight: dark ? "rgba(201,168,76,0.12)" : "rgba(201,168,76,0.08)",
    navy: "#1e3a5f",
    danger: dark ? "#f87171" : "#dc2626",
    dangerBg: dark ? "rgba(248,113,113,0.1)" : "#fef2f2",
  };

  const canUse = (k) => {
    try {
      const s = localStorage.getItem("litiga_usage");
      const u = s ? JSON.parse(s) : { d: 0, t: 0 };
      return u[k] < PLANS[plan].lim[k];
    } catch { return true; }
  };

  const incUsage = (k) => {
    try {
      const s = localStorage.getItem("litiga_usage");
      const u = s ? JSON.parse(s) : { d: 0, t: 0 };
      u[k] = (u[k] || 0) + 1;
      localStorage.setItem("litiga_usage", JSON.stringify(u));
    } catch {}
  };



  const handleAuth = async () => {
    setAuthErr(""); setLoading(true);
    if (!isValidEmail(email)) { setAuthErr("صيغة البريد الإلكتروني غير صحيحة"); setLoading(false); return; }
    if (isDisposableEmail(email)) { setAuthErr("لا يُسمح باستخدام البريد المؤقت أو الوهمي"); setLoading(false); return; }
    if (!isLogin) {
      const passErr = validatePassword(password);
      if (passErr) { setAuthErr(passErr); setLoading(false); return; }
    }
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthErr(translateAuthError(error.message));
        else { const { data } = await supabase.auth.getSession(); setSession(data.session); }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setAuthErr(translateAuthError(error.message));
        else { setIsLogin(true); setAuthErr("✓ تم إنشاء الحساب — سجّل دخولك الآن"); }
      }
    } catch { setAuthErr("حدث خطأ غير متوقع، تحقق من الاتصال"); }
    setLoading(false);
  };

  const handleDraft = async () => {
    if (!input.trim()) return;
    if (!canUse("d")) { setQuotaErr("draft"); return; }
    setQuotaErr(""); setLoading(true); setResult("");
    const docLabel = DOC_TYPES.find(x => x.id === docType)?.label || docType;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const req = `نوع الوثيقة: ${docLabel}\n\nالتفاصيل:\n${input}`;
      const res = await axios.post(
        `${API}/draft?request=${encodeURIComponent(req)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data.draft);
      incUsage("d");
    } catch { setResult("حدث خطأ في الاتصال بالخادم"); }
    setLoading(false);
  };

  const handleTranslate = async () => {
    if (!input.trim()) return;
    if (!canUse("t")) { setQuotaErr("translate"); return; }
    setQuotaErr(""); setLoading(true); setResult("");
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      const res = await axios.post(
        `${API}/translate?text=${encodeURIComponent(input)}&direction=${transDir}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data.translation);
      incUsage("t");
    } catch { setResult("حدث خطأ في الاتصال بالخادم"); }
    setLoading(false);
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const downloadWord = async () => {
  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    const token = s?.access_token;
    const docLabel = DOC_TYPES.find(x => x.id === docType)?.label || "وثيقة قانونية";
    const res = await axios.post(
      `${API}/export-word`,
      { content: result, title: docLabel },
      { 
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      }
    );
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `litiga-${docType}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch { alert("حدث خطأ أثناء تحميل الملف"); }
};

  const passStrength = useMemo(() => !isLogin ? getPasswordStrength(password) : null, [password, isLogin]);

  // ─── AUTH SCREEN ───────────────────────────────

  if (!session) return (
    <div style={{ minHeight: "100vh", background: d.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans Arabic', sans-serif", direction: "rtl", padding: "20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .auth-input{width:100%;padding:11px 14px;border-radius:10px;font-size:14px;font-family:inherit;direction:rtl;box-sizing:border-box;outline:none;transition:border-color .15s}
        .auth-input:focus{border-color:#c9a84c!important;box-shadow:0 0 0 3px rgba(201,168,76,0.15)}
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: "center", animation: "slideIn .3s ease" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${d.navy}, #2d5a8e)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: `0 0 0 1px #c9a84c33, 0 4px 20px rgba(30,58,95,0.3)` }}>
          <span style={{ font: "800 24px/1 'Outfit'", color: "#c9a84c", letterSpacing: -1 }}>L</span>
        </div>
        <h1 style={{ font: "800 22px/1 'Outfit'", color: d.text, letterSpacing: -0.8, margin: 0 }}>
          Litiga <span style={{ color: "#c9a84c", fontSize: 13, fontWeight: 400, marginRight: 6 }}>• Legal AI</span>
        </h1>
        <p style={{ color: d.muted, fontSize: 12, marginTop: 4 }}>صياغة المرافعات • الترجمة القانونية</p>
      </div>

      {/* Card */}
      <div style={{ width: "100%", maxWidth: 400, background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, padding: "28px 24px", boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.06)", animation: "slideIn .35s ease" }}>

        {/* Toggle Login/Signup */}
        <div style={{ display: "flex", background: d.surface2, borderRadius: 10, padding: 3, marginBottom: 22 }}>
          {[{ v: true, l: "تسجيل الدخول" }, { v: false, l: "حساب جديد" }].map(({ v, l }) => (
            <button key={l} onClick={() => { setIsLogin(v); setAuthErr(""); setEmail(""); setPassword(""); }}
              style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: isLogin === v ? d.surface : "transparent", fontWeight: isLogin === v ? 700 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: isLogin === v ? d.text : d.muted, boxShadow: isLogin === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all .15s" }}>
              {l}
            </button>
          ))}
        </div>

        {/* Email */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: d.muted, marginBottom: 6 }}>البريد الإلكتروني</label>
          <input type="email" className="auth-input" placeholder="example@domain.com" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ background: d.surface2, border: `1.5px solid ${email && !isValidEmail(email) ? "#ef4444" : d.border}`, color: d.text }} />
          {email && !isValidEmail(email) && <p style={{ fontSize: 11, color: "#ef4444", margin: "4px 0 0", textAlign: "right" }}>صيغة البريد الإلكتروني غير صحيحة</p>}
          {email && isValidEmail(email) && isDisposableEmail(email) && <p style={{ fontSize: 11, color: "#ef4444", margin: "4px 0 0", textAlign: "right" }}>لا يُسمح باستخدام البريد المؤقت</p>}
        </div>

        {/* Password */}
        <div style={{ marginBottom: !isLogin ? 8 : 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: d.muted, marginBottom: 6 }}>كلمة المرور</label>
          <input type="password" className="auth-input" placeholder={isLogin ? "••••••••" : "8 أحرف على الأقل"}
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={{ background: d.surface2, border: `1.5px solid ${d.border}`, color: d.text }} />
        </div>

        {/* Password strength (signup only) */}
        {!isLogin && password && passStrength && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ background: d.surface2, borderRadius: 3, height: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: passStrength.width, background: passStrength.color, borderRadius: 3, transition: "width .3s, background .3s" }} />
            </div>
            <p style={{ fontSize: 11, color: passStrength.color, margin: "4px 0 0", textAlign: "right" }}>قوة كلمة المرور: {passStrength.level}</p>
          </div>
        )}

        {/* Password requirements (signup only) */}
        {!isLogin && (
          <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              { label: "8 أحرف", ok: password.length >= 8 },
              { label: "حرف كبير", ok: /[A-Z]/.test(password) },
              { label: "رقم", ok: /[0-9]/.test(password) },
            ].map(({ label, ok }) => (
              <span key={label} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: ok ? (dark ? "rgba(16,185,129,0.15)" : "#ecfdf5") : d.surface2, color: ok ? "#10b981" : d.muted, border: `1px solid ${ok ? "#10b981" : d.border}`, transition: "all .2s" }}>
                {ok ? "✓" : "○"} {label}
              </span>
            ))}
          </div>
        )}

        {/* Error/Success message */}
        {authErr && (
          <div style={{ background: authErr.startsWith("✓") ? (dark ? "rgba(16,185,129,0.1)" : "#ecfdf5") : d.dangerBg, border: `1px solid ${authErr.startsWith("✓") ? "#6ee7b7" : d.danger + "44"}`, borderRadius: 8, padding: "9px 12px", fontSize: 12, color: authErr.startsWith("✓") ? "#059669" : d.danger, marginBottom: 14, textAlign: "right", animation: "slideIn .2s ease" }}>
            {authErr}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleAuth} disabled={loading}
          style={{ width: "100%", padding: 13, background: d.navy, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity .15s" }}>
          {loading && <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />}
          {loading ? "جارٍ المعالجة..." : isLogin ? "دخول" : "إنشاء الحساب"}
        </button>

        {/* Forgot password (login only) */}
        {isLogin && (
          <p onClick={async () => {
            if (!email || !isValidEmail(email)) { setAuthErr("أدخل بريدك الإلكتروني أولاً"); return; }
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) setAuthErr(translateAuthError(error.message));
            else setAuthErr("✓ تم إرسال رابط إعادة تعيين كلمة المرور لبريدك");
          }} style={{ textAlign: "center", color: d.muted, fontSize: 12, cursor: "pointer", margin: 0 }}>
            نسيت كلمة المرور؟
          </p>
        )}
      </div>

      {/* Dark mode toggle */}
      <button onClick={() => setDark(!dark)} style={{ marginTop: 16, background: "none", border: `1px solid ${d.border}`, borderRadius: 20, padding: "5px 14px", color: d.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
        {dark ? "☀️ فاتح" : "🌙 داكن"}
      </button>
    </div>
  );

  // ─── MAIN APP ──────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: d.bg, fontFamily: "'IBM Plex Sans Arabic', sans-serif", direction: "rtl", color: d.text, display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${d.border};border-radius:2px}
        textarea:focus,input:focus{outline:none;border-color:#c9a84c!important;box-shadow:0 0 0 3px rgba(201,168,76,0.15)}
      `}</style>

      {/* Header */}
      <header style={{ background: d.surface, borderBottom: `1px solid ${d.border}`, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${d.navy}, #2d5a8e)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 1px #c9a84c44" }}>
            <span style={{ font: "800 16px/1 'Outfit'", color: "#c9a84c" }}>L</span>
          </div>
          <div>
            <div style={{ font: "800 17px/1 'Outfit'", color: d.text, letterSpacing: -0.5 }}>
              Litiga <span style={{ color: d.muted, fontWeight: 400, fontSize: 12 }}>• Legal AI</span>
            </div>
            <div style={{ fontSize: 10, color: d.muted, marginTop: 1 }}>صياغة المرافعات • بحث السوابق • الترجمة القانونية</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setTab("pricing")} style={{ padding: "5px 14px", border: `1px solid ${d.border}`, borderRadius: 20, background: d.surface, cursor: "pointer", fontSize: 12, fontWeight: 600, color: d.navy, fontFamily: "inherit" }}>
            ◆ {PLANS[plan].ar}
          </button>
          <button onClick={() => setDark(!dark)} style={{ background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8, padding: "5px 10px", color: d.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: `1px solid ${d.border}`, borderRadius: 8, padding: "5px 12px", color: d.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            خروج
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: d.surface, borderBottom: `1px solid ${d.border}`, display: "flex", overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(""); setInput(""); }}
            style={{ flex: 1, padding: "11px 4px 9px", border: "none", borderBottom: `2px solid ${tab === t.id ? "#c9a84c" : "transparent"}`, background: "transparent", color: tab === t.id ? "#c9a84c" : d.muted, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all .15s", minWidth: 80 }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 18px", animation: "fadeUp .2s ease", width: "100%", flex: 1 }}>

        {/* Draft Tab */}
        {tab === "draft" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {quotaErr === "draft" && (
              <div style={{ background: dark ? "rgba(220,38,38,0.1)" : "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: dark ? "#f87171" : "#b91c1c" }}>انتهت حصتك الشهرية في باقة "{PLANS[plan].ar}"</span>
                <button onClick={() => { setTab("pricing"); setQuotaErr(""); }} style={{ padding: "4px 14px", background: d.navy, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ترقية</button>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: d.muted, marginBottom: 8 }}>نوع الوثيقة</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(138px, 1fr))", gap: 8 }}>
                {DOC_TYPES.map(dt => (
                  <button key={dt.id} onClick={() => setDocType(dt.id)}
                    style={{ padding: "11px 10px", border: `1.5px solid ${docType === dt.id ? "#c9a84c" : d.border}`, borderRadius: 10, background: docType === dt.id ? (dark ? "rgba(201,168,76,0.12)" : "#fffbeb") : d.surface, cursor: "pointer", fontFamily: "inherit", transition: ".12s", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: docType === dt.id ? "#c9a84c" : d.text }}>{dt.label}</span>
                    <span style={{ fontSize: 10, color: d.muted }}>{dt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: d.muted, marginBottom: 8 }}>تفاصيل القضية</label>
              <textarea value={input} onChange={e => setInput(e.target.value)} rows={5}
                placeholder="الأطراف، الوقائع، المطالبات، المستندات..."
                style={{ width: "100%", padding: "12px 14px", background: d.surface, border: `1.5px solid ${d.border}`, borderRadius: 10, fontSize: 14, color: d.text, fontFamily: "inherit", lineHeight: 1.8, resize: "vertical", direction: "rtl" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleDraft} disabled={loading || !input.trim()}
                style={{ flex: 1, padding: "11px 20px", background: d.navy, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> : "⚖️"}
                {loading ? "جارٍ المعالجة..." : "صياغة الوثيقة"}
              </button>
            </div>
          </div>
        )}

        {/* Translate Tab */}
        {tab === "translate" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {quotaErr === "translate" && (
              <div style={{ background: dark ? "rgba(220,38,38,0.1)" : "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: dark ? "#f87171" : "#b91c1c" }}>انتهت حصتك الشهرية في باقة "{PLANS[plan].ar}"</span>
                <button onClick={() => { setTab("pricing"); setQuotaErr(""); }} style={{ padding: "4px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ترقية</button>
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: d.muted, marginBottom: 8 }}>الاتجاه</label>
              <div style={{ display: "flex", gap: 8 }}>
                {TRANS_DIR.map(dir => (
                  <button key={dir.id} onClick={() => setTransDir(dir.id)}
                    style={{ flex: 1, padding: "14px", border: `1.5px solid ${transDir === dir.id ? "#059669" : d.border}`, borderRadius: 10, background: transDir === dir.id ? (dark ? "rgba(5,150,105,0.12)" : "#ecfdf5") : d.surface, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: transDir === dir.id ? "#059669" : d.text, transition: ".12s" }}>
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: d.muted, marginBottom: 8 }}>النص المصدر</label>
              <textarea value={input} onChange={e => setInput(e.target.value)} rows={6}
                placeholder={transDir === "en_to_ar" ? "Enter English legal text here..." : "أدخل النص القانوني العربي هنا..."}
                style={{ width: "100%", padding: "12px 14px", background: d.surface, border: `1.5px solid ${d.border}`, borderRadius: 10, fontSize: 14, color: d.text, fontFamily: "inherit", lineHeight: 1.8, resize: "vertical", direction: transDir === "en_to_ar" ? "ltr" : "rtl", textAlign: transDir === "en_to_ar" ? "left" : "right" }} />
            </div>

            <button onClick={handleTranslate} disabled={loading || !input.trim()}
              style={{ padding: "11px 20px", background: "#059669", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} /> : "🌐"}
              {loading ? "جارٍ الترجمة..." : "ترجمة"}
            </button>
          </div>
        )}

        {/* Pricing Tab */}
        {tab === "pricing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ font: "700 22px/1.3 'Outfit', sans-serif", color: d.text, letterSpacing: -0.3, margin: "0 0 6px" }}>خطط الاشتراك</h2>
              <p style={{ color: d.muted, fontSize: 14 }}>أسعار تنافسية للمحامين والمكاتب القانونية</p>
            </div>

            {/* Billing Toggle */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: 2, background: d.surface2, borderRadius: 10, padding: 3, maxWidth: 280, width: "100%" }}>
                {[{ id: "monthly", label: "شهري" }, { id: "annual", label: "سنوي −17%" }].map(b => (
                  <button key={b.id} onClick={() => setBilling(b.id)}
                    style={{ flex: 1, padding: "8px 16px", border: "none", borderRadius: 8, background: billing === b.id ? d.surface : "transparent", fontWeight: billing === b.id ? 700 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: billing === b.id ? d.text : d.muted, boxShadow: billing === b.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 12 }}>
              {Object.entries(PLANS).map(([pid, p]) => {
                const cur = plan === pid;
                const pop = pid === "professional";
                const pr = billing === "annual" ? p.yr : p.mo;
                return (
                  <div key={pid} style={{ border: `1.5px solid ${cur ? p.color : d.border}`, borderRadius: 14, padding: "20px 16px", background: d.surface, position: "relative", display: "flex", flexDirection: "column", gap: 14, boxShadow: pop ? `0 2px 12px ${p.color}14` : "none" }}>
                    {pop && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: p.color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 12px", borderRadius: 20, whiteSpace: "nowrap", fontFamily: "inherit" }}>الأكثر طلباً</div>}
                    {cur && <div style={{ position: "absolute", top: -9, right: 14, background: p.color, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 12px", borderRadius: 20, fontFamily: "inherit" }}>الحالية</div>}
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: p.color }}>{p.ar}</div>
                      <div style={{ fontSize: 11, color: d.muted }}>{p.en}</div>
                    </div>
                    <div>
                      <span style={{ font: "800 28px/1 'Outfit'", color: d.text }}>{pr === 0 ? "مجاني" : pr}</span>
                      {pr > 0 && <span style={{ fontSize: 12, color: d.muted }}> ر.س/{billing === "annual" ? "سنة" : "شهر"}{p.pu ? "/مستخدم" : ""}</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                      {p.feat.map((f, i) => (
                        <div key={i} style={{ fontSize: 11, color: d.muted, display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: p.color, flexShrink: 0 }}>✓</span>{f}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setPlan(pid)} disabled={cur}
                      style={{ padding: 10, border: cur ? `1.5px solid ${p.color}` : "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: cur ? "default" : "pointer", fontFamily: "inherit", color: cur ? p.color : "#fff", background: cur ? "transparent" : p.color, opacity: cur ? 0.5 : 1, width: "100%" }}>
                      {cur ? "✓ الحالية" : pid === "free" ? "ابدأ مجاناً" : "اشترك"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Usage Tracker */}
            {(() => {
              const u = (() => { try { const s = localStorage.getItem("litiga_usage"); return s ? JSON.parse(s) : { d: 0, t: 0 }; } catch { return { d: 0, t: 0 }; } })();
              const lim = PLANS[plan].lim;
              return (
                <div style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: d.muted, marginBottom: 14, textAlign: "right" }}>الاستخدام هذا الشهر</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      { label: "الصياغات", used: u.d, total: lim.d, color: "#1e3a5f" },
                      { label: "الترجمات", used: u.t, total: lim.t, color: "#059669" },
                    ].map(({ label, used, total, color }) => {
                      const pct = Math.min(100, Math.round((used / total) * 100));
                      return (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: d.muted, marginBottom: 4 }}>{label}</div>
                          <div style={{ font: "800 22px/1 'Outfit'", color }}>
                            {used}<span style={{ fontSize: 11, color: d.muted }}>/{total}</span>
                          </div>
                          <div style={{ background: d.surface2, borderRadius: 3, height: 4, marginTop: 6, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: pct >= 90 ? "#ef4444" : color, borderRadius: 3, transition: "width .3s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Result */}
        {result && tab !== "pricing" && (
          <div style={{ marginTop: 20, border: `1px solid ${d.border}`, borderRadius: 12, overflow: "hidden", background: d.surface, animation: "fadeUp .2s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${d.border}`, background: d.surface2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: d.muted }}>المخرج القانوني</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyResult} style={{ padding: "4px 12px", border: `1px solid ${d.border}`, borderRadius: 6, background: d.surface, cursor: "pointer", fontSize: 12, color: copied ? "#c9a84c" : d.muted, fontFamily: "inherit", fontWeight: copied ? 700 : 400 }}>
                  {copied ? "✓ تم النسخ" : "نسخ"}
                </button>
                {tab === "draft" && (
                  <button onClick={downloadWord} style={{ padding: "4px 12px", border: `1px solid ${d.border}`, borderRadius: 6, background: d.navy, cursor: "pointer", fontSize: 12, color: "#fff", fontFamily: "inherit", fontWeight: 600 }}>
                    ⬇ Word
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: 18, maxHeight: 460, overflowY: "auto" }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 14, lineHeight: 2, color: d.text, textAlign: "right" }}>{renderMarkdown(result)}</pre>
            </div>
            <div style={{ padding: "8px 16px", borderTop: `1px solid ${d.border}`, background: dark ? "rgba(201,168,76,0.06)" : "#fffbeb", fontSize: 11, color: dark ? "#c9a84c" : "#92400e", textAlign: "center" }}>
              ⚠ محتوى استرشادي — يحتاج مراجعة متخصص مرخص
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: 14, fontSize: 11, color: d.muted, borderTop: `1px solid ${d.border}`, background: d.surface, marginTop: "auto" }}>
        <span style={{ font: "700 12px/1 'Outfit'", color: "#c9a84c" }}>Litiga</span>
        <span style={{ color: d.border }}> • </span>
        <span>أداة استرشادية لا تُغني عن الاستشارة القانونية المتخصصة</span>
      </footer>
    </div>
  );
}