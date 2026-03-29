import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator,
  SafeAreaView, StatusBar, Alert
} from "react-native";
import axios from "axios";
import { supabase } from "./supabase";

const API = "https://legal-ai-production-2548.up.railway.app";

export default function App() {
  const [session, setSession] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("draft");
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState("en_to_ar");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert("خطأ", error.message);
        else {
          const { data } = await supabase.auth.getSession();
          setSession(data.session);
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) Alert.alert("خطأ", error.message);
        else Alert.alert("تم", "تم إنشاء الحساب، يمكنك تسجيل الدخول الآن");
      }
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ غير متوقع");
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleDraft = async () => {
    if (!input) return;
    setLoading(true);
    setResult("");
    try {
      const res = await axios.post(`${API}/draft?request=${encodeURIComponent(input)}`);
      setResult(res.data.draft);
    } catch (e) {
      setResult("حدث خطأ، تأكد من الاتصال بالإنترنت");
    }
    setLoading(false);
  };

  const handleTranslate = async () => {
    if (!input) return;
    setLoading(true);
    setResult("");
    try {
      const res = await axios.post(`${API}/translate?text=${encodeURIComponent(input)}&direction=${direction}`);
      setResult(res.data.translation);
    } catch (e) {
      setResult("حدث خطأ، تأكد من الاتصال بالإنترنت");
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.authContainer}>
          <Text style={styles.title}>المساعد القانوني الذكي</Text>
          <Text style={styles.subtitle}>{isLogin ? "تسجيل الدخول" : "إنشاء حساب"}</Text>

          <TextInput
            style={styles.input}
            placeholder="البريد الإلكتروني"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign="right"
          />

          <TextInput
            style={styles.input}
            placeholder="كلمة المرور"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textAlign="right"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.buttonText}>{isLogin ? "دخول" : "إنشاء حساب"}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={{ marginTop: 16 }}>
            <Text style={{ color: "#1a365d", textAlign: "center" }}>
              {isLogin ? "ما عندك حساب؟ أنشئ واحد" : "عندك حساب؟ سجّل دخول"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <TouchableOpacity onPress={handleSignOut}>
            <Text style={{ color: "#e53e3e", fontSize: 13 }}>خروج</Text>
          </TouchableOpacity>
          <Text style={styles.title}>المساعد القانوني</Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === "draft" && styles.tabActive]}
            onPress={() => { setTab("draft"); setResult(""); }}>
            <Text style={[styles.tabText, tab === "draft" && styles.tabTextActive]}>الصياغة</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "translate" && styles.tabActive]}
            onPress={() => { setTab("translate"); setResult(""); }}>
            <Text style={[styles.tabText, tab === "translate" && styles.tabTextActive]}>الترجمة</Text>
          </TouchableOpacity>
        </View>

        {tab === "translate" && (
          <View style={styles.directionRow}>
            <TouchableOpacity
              style={[styles.dirBtn, direction === "en_to_ar" && styles.dirBtnActive]}
              onPress={() => setDirection("en_to_ar")}>
              <Text style={[styles.dirText, direction === "en_to_ar" && styles.dirTextActive]}>إنجليزي ← عربي</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dirBtn, direction === "ar_to_en" && styles.dirBtnActive]}
              onPress={() => setDirection("ar_to_en")}>
              <Text style={[styles.dirText, direction === "ar_to_en" && styles.dirTextActive]}>عربي ← إنجليزي</Text>
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          style={styles.input}
          multiline
          textAlign="right"
          placeholder={tab === "draft" ? "اكتب طلبك القانوني هنا..." : "أدخل النص المراد ترجمته..."}
          placeholderTextColor="#999"
          value={input}
          onChangeText={setInput}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={tab === "draft" ? handleDraft : handleTranslate}
          disabled={loading}>
          {loading
            ? <ActivityIndicator color="white" />
            : <Text style={styles.buttonText}>{tab === "draft" ? "اصغ البند" : "ترجم"}</Text>
          }
        </TouchableOpacity>

        {result !== "" && (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>النتيجة</Text>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  authContainer: { flex: 1, padding: 24, justifyContent: "center" },
  scroll: { padding: 20, paddingTop: 20 },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", color: "#1a365d", marginBottom: 6 },
  subtitle: { fontSize: 16, textAlign: "center", color: "#666", marginBottom: 28 },
  tabs: { flexDirection: "row", backgroundColor: "#e2e8f0", borderRadius: 10, padding: 4, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#1a365d" },
  tabText: { color: "#666", fontWeight: "600" },
  tabTextActive: { color: "white" },
  directionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dirBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#cbd5e0", alignItems: "center" },
  dirBtnActive: { backgroundColor: "#1a365d", borderColor: "#1a365d" },
  dirText: { fontSize: 13, color: "#555" },
  dirTextActive: { color: "white" },
  input: { backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, minHeight: 50, fontSize: 15, color: "#333", marginBottom: 16, textAlignVertical: "top" },
  button: { backgroundColor: "#1a365d", borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 20 },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  result: { backgroundColor: "white", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  resultLabel: { fontSize: 13, color: "#666", marginBottom: 8, textAlign: "right" },
  resultText: { fontSize: 15, color: "#1a365d", lineHeight: 26, textAlign: "right" },
});