import { useState } from "react";
import axios from "axios";

const API = "http://127.0.0.1:8000";

function App() {
  const [tab, setTab] = useState("draft");
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState("en_to_ar");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDraft = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await axios.post(`${API}/draft?request=${encodeURIComponent(input)}`);
      setResult(res.data.draft);
    } catch (e) {
      setResult("حدث خطأ، تأكد من تشغيل السيرفر");
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
      setResult("حدث خطأ، تأكد من تشغيل السيرفر");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 32, fontFamily: "sans-serif", direction: "rtl" }}>
      <h1 style={{ color: "#1a365d", marginBottom: 8 }}>المساعد القانوني الذكي</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>صياغة وترجمة قانونية احترافية</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => { setTab("draft"); setResult(""); }}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === "draft" ? "#1a365d" : "#e2e8f0", color: tab === "draft" ? "white" : "#333" }}>
          الصياغة القانونية
        </button>
        <button
          onClick={() => { setTab("translate"); setResult(""); }}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === "translate" ? "#1a365d" : "#e2e8f0", color: tab === "translate" ? "white" : "#333" }}>
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

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder={tab === "draft" ? "اكتب طلبك مثل: أحتاج بند فسخ عقد..." : "أدخل النص المراد ترجمته..."}
        style={{ width: "100%", height: 140, padding: 16, borderRadius: 8, border: "1px solid #cbd5e0",
          fontSize: 15, resize: "vertical", boxSizing: "border-box" }}
      />

      <button
        onClick={tab === "draft" ? handleDraft : handleTranslate}
        disabled={loading || !input}
        style={{ marginTop: 12, padding: "12px 32px", background: loading ? "#94a3b8" : "#1a365d",
          color: "white", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 15 }}>
        {loading ? "جاري المعالجة..." : tab === "draft" ? "اصغ البند" : "ترجم"}
      </button>

      {result && (
        <div style={{ marginTop: 24, padding: 20, background: "#f7fafc", borderRadius: 8,
          border: "1px solid #e2e8f0", lineHeight: 1.8, fontSize: 15, whiteSpace: "pre-wrap" }}>
          {result}
        </div>
      )}
    </div>
  );
}

export default App;