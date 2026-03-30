import { useState, useEffect } from "react";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const API = "http://127.0.0.1:8000";
const supabase = createClient(
  "https://taodusjrsoxpnyirbneu.supabase.co",
  "sb_publishable_T_TinfVHGYCsNgl59KuUBg_CPYF8NPV"
);

function App() {
  const [session, setSession] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("draft");
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState("en_to_ar");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  const handleAuth = async () => {
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert("تم إنشاء الحساب، سجّل دخولك الآن");
    }
    setLoading(false);
  };

  const handleDraft = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await axios.post(`${API}/draft?request=${encodeURIComponent(input)}`);
      setResult(res.data.draft);
    } catch (e) {
      setResult("حدث خطأ");
    }
    setLoading(false);
  };

  const handleTranslate = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await axios.post(`${API}/translate?text=${encodeURIComponent(input)}&direction=${direction}`);
      setResult(res.data.translation);
    } catch (e) {
      setResult("حدث خطأ");
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", padding: 32, fontFamily: "sans-serif", direction: "rtl" }}>
        <h1 style={{ color: "#1a365d", textAlign: "center", marginBottom: 8 }}>المساعد القانوني الذكي</h1>
        <p style={{ textAlign: "center", color: "#666", marginBottom: 32 }}>{isLogin ? "تسجيل الدخول" : "إنشاء حساب"}</p>

        <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 12, borderRadius: 8, border: "1px solid #cbd5e0", fontSize: 15, boxSizing: "border-box", textAlign: "right" }} />

        <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, marginBottom: 16, borderRadius: 8, border: "1px solid #cbd5e0", fontSize: 15, boxSizing: "border-box", textAlign: "right" }} />

        <button onClick={handleAuth} disabled={loading}
          style={{ width: "100%", padding: 14, background: "#1a365d", color: "white", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>
          {loading ? "..." : isLogin ? "دخول" : "إنشاء حساب"}
        </button>

        <p onClick={() => setIsLogin(!isLogin)} style={{ textAlign: "center", color: "#1a365d", cursor: "pointer", marginTop: 16 }}>
          {isLogin ? "ما عندك حساب؟ أنشئ واحد" : "عندك حساب؟ سجّل دخول"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 32, fontFamily: "sans-serif", direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: "#e53e3e", cursor: "pointer", fontSize: 14 }}>خروج</button>
        <h1 style={{ color: "#1a365d", margin: 0 }}>المساعد القانوني الذكي</h1>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button onClick={() => { setTab("draft"); setResult(""); }}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "draft" ? "#1a365d" : "#e2e8f0", color: tab === "draft" ? "white" : "#333" }}>
          الصياغة القانونية
        </button>
        <button onClick={() => { setTab("translate"); setResult(""); }}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "translate" ? "#1a365d" : "#e2e8f0", color: tab === "translate" ? "white" : "#333" }}>
          الترجمة القانونية
        </button>
      </div>

      {tab === "translate" && (
        <div style={{ marginBottom: 16 }}>
          <select value={direction} onChange={e => setDirection(e.target.value)}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e0" }}>
            <option value="en_to_ar">إنجليزي ← عربي</option>
            <option value="ar_to_en">عربي ← إنجليزي</option>
          </select>
        </div>
      )}

      <textarea value={input} onChange={e => setInput(e.target.value)}
        placeholder={tab === "draft" ? "اكتب طلبك مثل: أحتاج بند فسخ عقد..." : "أدخل النص المراد ترجمته..."}
        style={{ width: "100%", height: 140, padding: 16, borderRadius: 8, border: "1px solid #cbd5e0", fontSize: 15, resize: "vertical", boxSizing: "border-box" }} />

      <button onClick={tab === "draft" ? handleDraft : handleTranslate} disabled={loading || !input}
        style={{ marginTop: 12, padding: "12px 32px", background: loading ? "#94a3b8" : "#1a365d", color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 15 }}>
        {loading ? "جاري المعالجة..." : tab === "draft" ? "اصغ البند" : "ترجم"}
      </button>

      {result && (
        <div style={{ marginTop: 24, padding: 20, background: "#f7fafc", borderRadius: 8, border: "1px solid #e2e8f0", lineHeight: 1.8, fontSize: 15, whiteSpace: "pre-wrap" }}>
          {result}
        </div>
      )}
    </div>
  );
}

export default App;