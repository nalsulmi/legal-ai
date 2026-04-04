from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from app.rag import add_document, search_documents
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from jwt.algorithms import ECAlgorithm
from pydantic import BaseModel
from supabase import create_client
import anthropic
import os
import jwt as pyjwt
import httpx
import json
import io
import time
import logging
import datetime

logging.basicConfig(level=logging.WARNING)
load_dotenv()

app = FastAPI()
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

supabase_admin = create_client(SUPABASE_URL, os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

BLOCKED_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
    "sharklasers.com", "trashmail.com", "yopmail.com", "emailondeck.com",
    "10minutemail.com", "fakeinbox.com", "maildrop.cc", "discard.email",
    "emailax.pro", "spamgourmet.com", "dispostable.com"
}

PLAN_LIMITS = {
    "free":         {"drafts": 3,   "translations": 5},
    "individual":   {"drafts": 30,  "translations": 50},
    "professional": {"drafts": 100, "translations": 200},
    "team":         {"drafts": 80,  "translations": 150},
}

DOC_PROMPTS = {
    "claim": """أنت محامٍ خبير في صياغة صحائف الدعوى أمام المحاكم السعودية.
اكتب صحيفة دعوى كاملة تشمل:
- بيانات المدعي والمدعى عليه
- الوقائع والأسانيد
- الطلبات الختامية
- المستندات المرفقة
استند للمواد النظامية بأرقامها.""",

    "appeal": """أنت محامٍ خبير في صياغة لوائح الاعتراض على الأحكام القضائية السعودية.
اكتب لائحة اعتراضية كاملة تشمل:
- بيانات الحكم المعترض عليه
- أوجه الاعتراض والأسباب القانونية
- المطالبة بإلغاء أو تعديل الحكم
استند للمواد النظامية بأرقامها.""",

    "response": """أنت محامٍ خبير في صياغة المذكرات الجوابية أمام المحاكم السعودية.
اكتب مذكرة جوابية كاملة تشمل:
- الرد على ادعاءات المدعي نقطة بنقطة
- الدفوع الشكلية والموضوعية
- الطلبات الختامية بالرفض
استند للمواد النظامية بأرقامها.""",

    "enforcement": """أنت محامٍ خبير في صياغة طلبات التنفيذ أمام محاكم التنفيذ السعودية.
اكتب طلب تنفيذ كاملاً يشمل:
- بيانات السند التنفيذي
- المطلوب تنفيذه وقيمته
- إجراءات التنفيذ المطلوبة
استند لنظام التنفيذ السعودي بأرقام المواد.""",

    "supplementary": """أنت محامٍ خبير في صياغة المذكرات التكميلية أمام المحاكم السعودية.
اكتب مذكرة تكميلية كاملة تشمل:
- الإشارة للمذكرة السابقة
- المستجدات والأدلة الإضافية
- تعزيز الموقف القانوني السابق
استند للمواد النظامية بأرقامها.""",

    "reconsideration": """أنت محامٍ خبير في صياغة التماسات إعادة النظر أمام المحاكم السعودية.
اكتب التماس إعادة نظر كاملاً يشمل:
- بيانات الحكم المطلوب إعادة النظر فيه
- الأسباب الموجبة لإعادة النظر
- الأدلة الجديدة أو الأخطاء القانونية
استند لنظام المرافعات الشرعية بأرقام المواد.""",
}

# ─── Models ───────────────────────────────────────────────────────────────
class WordExportRequest(BaseModel):
    content: str
    title: str = "وثيقة قانونية"

# ─── JWKS Cache ───────────────────────────────────────────────────────────
_jwks_cache = None
_jwks_cache_time = 0

async def get_supabase_jwks():
    global _jwks_cache, _jwks_cache_time
    if _jwks_cache and time.time() - _jwks_cache_time < 3600:
        return _jwks_cache
    try:
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        async with httpx.AsyncClient() as client_http:
            resp = await client_http.get(jwks_url, timeout=5)
            _jwks_cache = resp.json().get("keys", [])
            _jwks_cache_time = time.time()
            return _jwks_cache
    except Exception:
        return _jwks_cache or []
# ──────────────────────────────────────────────────────────────────────────


def add_rtl_to_paragraph(p):
    pPr = p._p.get_or_add_pPr()
    bidi = OxmlElement('w:bidi')
    pPr.append(bidi)


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials

    try:
        header = pyjwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except Exception:
        raise HTTPException(status_code=401, detail="Token غير صالح")

    payload = None

    if alg == "ES256":
        keys = await get_supabase_jwks()
        kid = header.get("kid")
        matching_keys = [k for k in keys if k.get("kid") == kid] if kid else keys
        for jwk_key in matching_keys:
            try:
                public_key = ECAlgorithm.from_jwk(json.dumps(jwk_key))
                payload = pyjwt.decode(
                    token, public_key, algorithms=["ES256"],
                    audience="authenticated",
                    options={"require": ["exp", "sub"]}
                )
                break
            except pyjwt.ExpiredSignatureError:
                raise HTTPException(status_code=401, detail="انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً")
            except pyjwt.InvalidAudienceError:
                try:
                    public_key = ECAlgorithm.from_jwk(json.dumps(jwk_key))
                    payload = pyjwt.decode(
                        token, public_key, algorithms=["ES256"],
                        options={"require": ["exp", "sub"], "verify_aud": False}
                    )
                    break
                except Exception:
                    continue
            except pyjwt.InvalidSignatureError:
                continue
            except Exception as e:
                logging.warning(f"JWT verification error: {type(e).__name__}: {e}")
                continue
    else:
        if not SUPABASE_JWT_SECRET:
            raise HTTPException(status_code=500, detail="JWT Secret غير مضبوط في المتغيرات البيئية")
        try:
            payload = pyjwt.decode(
                token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["exp", "sub"]}
            )
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="انتهت صلاحية الجلسة — يرجى تسجيل الدخول مجدداً")
        except pyjwt.InvalidAudienceError:
            try:
                payload = pyjwt.decode(
                    token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                    options={"require": ["exp", "sub"], "verify_aud": False}
                )
            except Exception:
                raise HTTPException(status_code=401, detail="غير مصرح — يرجى تسجيل الدخول")
        except pyjwt.InvalidSignatureError:
            raise HTTPException(status_code=401, detail="توقيع غير صالح")
        except pyjwt.DecodeError:
            raise HTTPException(status_code=401, detail="Token غير صالح")

    if payload is None:
        raise HTTPException(status_code=401, detail="غير مصرح — يرجى تسجيل الدخول")

    email = payload.get("email", "") or payload.get("user_metadata", {}).get("email", "")
    if not email:
        raise HTTPException(status_code=401, detail="غير مصرح — يرجى تسجيل الدخول")

    domain = email.split("@")[1].lower() if "@" in email else ""
    if domain in BLOCKED_DOMAINS:
        raise HTTPException(status_code=403, detail="نوع البريد الإلكتروني غير مسموح به")

    return payload


# ─── Usage & Plan Functions ───────────────────────────────────────────────

def get_user_plan(user_id: str) -> dict:
    """جلب باقة المستخدم — يُنشئ سجل تلقائياً إذا لم يكن موجوداً"""
    result = supabase_admin.table("user_plans").select("*").eq("user_id", user_id).execute()
    if result.data:
        return result.data[0]
    # إنشاء سجل جديد بالباقة المجانية
    new_plan = supabase_admin.table("user_plans").insert({
        "user_id": user_id,
        "plan": "free",
    }).execute()
    return new_plan.data[0]


def get_user_usage(user_id: str) -> dict:
    """جلب استخدام المستخدم — يُنشئ سجل تلقائياً إذا لم يكن موجوداً"""
    result = supabase_admin.table("user_usage").select("*").eq("user_id", user_id).execute()
    if result.data:
        return result.data[0]
    new_usage = supabase_admin.table("user_usage").insert({
        "user_id": user_id,
        "drafts_used": 0,
        "translations_used": 0,
        "period_start": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }).execute()
    return new_usage.data[0]


def check_and_increment(user_id: str, usage_type: str):
    """
    يتحقق من الحد ويزيد العداد.
    usage_type: 'drafts' أو 'translations'
    يرفع HTTPException 429 إذا تجاوز الحد.
    """
    plan_data = get_user_plan(user_id)
    usage_data = get_user_usage(user_id)

    plan = plan_data.get("plan", "free")
    now_dt = datetime.datetime.now(datetime.timezone.utc)

    # ─── تحقق من انتهاء الاشتراك ───
    plan_end = plan_data.get("plan_end")
    if plan_end and plan != "free":
        plan_end_dt = datetime.datetime.fromisoformat(plan_end.replace("Z", "+00:00"))
        if now_dt > plan_end_dt:
            supabase_admin.table("user_plans").update({
                "plan": "free",
                "plan_end": None,
                "updated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }).eq("user_id", user_id).execute()
            supabase_admin.table("user_usage").update({
                "drafts_used": 0,
                "translations_used": 0,
                "period_start": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "updated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }).eq("user_id", user_id).execute()
            plan = "free"
            usage_data["drafts_used"] = 0
            usage_data["translations_used"] = 0

    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

    # ─── تصفير العداد الشهري (للباقات المدفوعة فقط) ───
    period_start = plan_data.get("plan_start")
    if period_start and plan != "free":
        start_dt = datetime.datetime.fromisoformat(period_start.replace("Z", "+00:00"))
        months_passed = (now_dt.year - start_dt.year) * 12 + (now_dt.month - start_dt.month)
        current_period_start = start_dt.replace(
            year=start_dt.year + (start_dt.month + months_passed - 1) // 12,
            month=(start_dt.month + months_passed - 1) % 12 + 1
        )
        usage_period_start = datetime.datetime.fromisoformat(
            usage_data.get("period_start", period_start).replace("Z", "+00:00")
        )
        if current_period_start > usage_period_start:
            supabase_admin.table("user_usage").update({
                "drafts_used": 0,
                "translations_used": 0,
                "period_start": current_period_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "updated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }).eq("user_id", user_id).execute()
            usage_data["drafts_used"] = 0
            usage_data["translations_used"] = 0

    field = f"{usage_type}_used"
    current = usage_data.get(field, 0)
    limit = limits.get(usage_type, 0)

    if current >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"انتهت حصتك الشهرية في باقة '{plan}' — يرجى الترقية للاستمرار"
        )

    supabase_admin.table("user_usage").update({
        field: current + 1,
        "updated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }).eq("user_id", user_id).execute()

# ──────────────────────────────────────────────────────────────────────────


@app.get("/")
def home():
    return {"status": "Litiga API is running!"}


@app.post("/add-document")
async def upload_document(title: str, content: str, category: str, user=Depends(verify_token)):
    result = add_document(title, content, category)
    return result


@app.get("/usage")
async def get_usage(user=Depends(verify_token)):
    """يُرجع استخدام المستخدم وباقته الحالية"""
    user_id = user.get("sub")
    plan_data = get_user_plan(user_id)
    usage_data = get_user_usage(user_id)
    plan = plan_data.get("plan", "free")
    now_dt = datetime.datetime.now(datetime.timezone.utc)

    # تحقق من انتهاء الاشتراك عند فتح التطبيق
    plan_end = plan_data.get("plan_end")
    if plan_end and plan != "free":
        plan_end_dt = datetime.datetime.fromisoformat(plan_end.replace("Z", "+00:00"))
        if now_dt > plan_end_dt:
            supabase_admin.table("user_plans").update({
                "plan": "free",
                "plan_end": None,
                "updated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }).eq("user_id", user_id).execute()
            supabase_admin.table("user_usage").update({
                "drafts_used": 0,
                "translations_used": 0,
                "period_start": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "updated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }).eq("user_id", user_id).execute()
            plan = "free"
            usage_data = {"drafts_used": 0, "translations_used": 0}

    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    return {
        "plan": plan,
        "plan_start": plan_data.get("plan_start"),
        "plan_end": plan_data.get("plan_end"),
        "drafts_used": usage_data.get("drafts_used", 0),
        "drafts_limit": limits["drafts"],
        "translations_used": usage_data.get("translations_used", 0),
        "translations_limit": limits["translations"],
    }


@app.post("/draft")
async def draft_clause(request: str, doc_type: str = "claim", user=Depends(verify_token)):
    user_id = user.get("sub")

    # ─── تحقق أولاً هل الطلب قانوني — بدون خصم من العداد ───
    check = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=10,
        messages=[{
            "role": "user",
            "content": f"""هل يصف هذا النص قضية قانونية حقيقية يمكن رفعها أمام المحاكم السعودية؟
أجب بكلمة واحدة فقط: YES أو NO

النص: {request}"""
        }]
    )
    if check.content[0].text.strip().upper() != "YES":
        raise HTTPException(
            status_code=400,
            detail="يرجى إدخال تفاصيل قضية قانونية واضحة"
        )

    # ─── الطلب قانوني — خصم من العداد وابدأ الصياغة ───
    check_and_increment(user_id, "drafts")

    docs = search_documents(request)
    context = "\n\n".join([f"title: {d['title']}\n{d['content']}" for d in docs])
    system_prompt = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=5000,
        messages=[{
            "role": "user",
            "content": f"""{system_prompt}

بناءً على هذه النصوص النظامية المتاحة:
{context}

التفاصيل:
{request}

اكتب الوثيقة كاملة بالعربية الفصحى القانونية بدون أي شرح أو مقدمة.

تعليمات مهمة:
- استند فقط للنصوص النظامية المقدمة أعلاه.
- إذا كانت النصوص كافية، اكتب الوثيقة كاملة بثقة.
- إذا كانت النصوص غير كافية لبعض الجوانب، اكتب الوثيقة مع إشارة واضحة في الهامش أن تلك المواد تحتاج مراجعة متخصص.
- لا تخترع أرقام مواد غير موجودة في النصوص المقدمة."""
        }]
    )
    response_text = message.content[0].text.strip()
    return {
        "draft": response_text,
        "based_on": [d['title'] for d in docs]
    }


@app.post("/export-word")
async def export_word(request: WordExportRequest, user=Depends(verify_token)):
    content = request.content
    title = request.title

    doc = Document()

    settings = doc.settings.element
    rPrDefault = OxmlElement('w:rPrDefault')
    rPr = OxmlElement('w:rPr')
    rtl_default = OxmlElement('w:rtl')
    rPr.append(rtl_default)
    rPrDefault.append(rPr)
    settings.append(rPrDefault)

    section = doc.sections[0]
    section.right_margin = Pt(72)
    section.left_margin = Pt(72)

    heading = doc.add_heading(title, level=1)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_rtl_to_paragraph(heading)
    for run in heading.runs:
        run.font.color.rgb = RGBColor(0x1e, 0x3a, 0x5f)
        run.font.size = Pt(18)
        run.bold = True
        run.font.rtl = True

    doc.add_paragraph()

    for line in content.split("\n"):
        stripped = line.strip()

        if not stripped:
            doc.add_paragraph()
            continue

        if stripped in ("---", "─────", "———"):
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run("─" * 50)
            run.font.color.rgb = RGBColor(0xd1, 0xd5, 0xdb)
            run.font.size = Pt(8)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            continue

        if stripped.startswith("#### "):
            text = stripped[5:].strip()
            h = doc.add_heading(text, level=3)
            h.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            add_rtl_to_paragraph(h)
            for run in h.runs:
                run.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
                run.font.size = Pt(11)
                run.font.rtl = True
            continue

        if stripped.startswith("### "):
            text = stripped[4:].strip()
            h = doc.add_heading(text, level=3)
            h.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            add_rtl_to_paragraph(h)
            for run in h.runs:
                run.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
                run.font.size = Pt(12)
                run.font.rtl = True
            continue

        if stripped.startswith("## "):
            text = stripped[3:].strip()
            h = doc.add_heading(text, level=2)
            h.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            add_rtl_to_paragraph(h)
            for run in h.runs:
                run.font.color.rgb = RGBColor(0x1e, 0x3a, 0x5f)
                run.font.size = Pt(13)
                run.font.rtl = True
            continue

        if stripped.startswith("# "):
            text = stripped[2:].strip()
            h = doc.add_heading(text, level=1)
            h.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            add_rtl_to_paragraph(h)
            for run in h.runs:
                run.font.color.rgb = RGBColor(0x1e, 0x3a, 0x5f)
                run.font.size = Pt(15)
                run.font.rtl = True
            continue

        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        p.paragraph_format.space_after = Pt(4)
        add_rtl_to_paragraph(p)

        parts = stripped.split("**")
        for i, part in enumerate(parts):
            if not part:
                continue
            run = p.add_run(part)
            run.bold = (i % 2 == 1)
            run.font.size = Pt(12)
            run.font.color.rgb = RGBColor(0x24, 0x29, 0x2f)
            run.font.rtl = True

    doc.add_paragraph()
    footer_p = doc.add_paragraph("⚠ محتوى استرشادي — يحتاج مراجعة متخصص مرخص  •  Litiga Legal AI")
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in footer_p.runs:
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x9c, 0xa3, 0xaf)

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=litiga-document.docx"}
    )


@app.post("/translate")
async def translate_legal(text: str, direction: str = "en_to_ar", user=Depends(verify_token)):
    user_id = user.get("sub")
    check_and_increment(user_id, "translations")

    docs = search_documents(text)
    terms_context = "\n".join([f"- {d['title']}: {d['content']}" for d in docs])
    if direction == "en_to_ar":
        prompt = f"""أنت مترجم قانوني متخصص.
استخدم هذا القاموس القانوني المعتمد:
{terms_context}

ترجم هذا النص القانوني من الإنجليزية للعربية مع الحفاظ على الدقة القانونية:
{text}

اكتب الترجمة فقط بدون أي شرح."""
    else:
        prompt = f"""You are a specialized legal translator.
Use this approved legal glossary:
{terms_context}

Translate this legal text from Arabic to English maintaining legal accuracy:
{text}

Write only the translation without any explanation."""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=5000,
        messages=[{"role": "user", "content": prompt}]
    )
    return {
        "translation": message.content[0].text,
        "direction": direction
    }