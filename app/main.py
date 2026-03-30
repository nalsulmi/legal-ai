from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from app.rag import add_document, search_documents
import anthropic
import os
import jwt as pyjwt

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

BLOCKED_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
    "sharklasers.com", "trashmail.com", "yopmail.com", "emailondeck.com",
    "10minutemail.com", "fakeinbox.com", "maildrop.cc", "discard.email",
    "emailax.pro", "spamgourmet.com", "dispostable.com"
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

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = pyjwt.decode(
            token,
            options={"verify_signature": False}
        )
        email = payload.get("email", "")
        if not email:
            raise HTTPException(status_code=401, detail="غير مصرح — يرجى تسجيل الدخول")
        domain = email.split("@")[1].lower() if "@" in email else ""
        if domain in BLOCKED_DOMAINS:
            raise HTTPException(status_code=403, detail="نوع البريد الإلكتروني غير مسموح به")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="غير مصرح — يرجى تسجيل الدخول")

@app.get("/")
def home():
    return {"status": "Litiga API is running!"}

@app.post("/add-document")
async def upload_document(title: str, content: str, category: str, user=Depends(verify_token)):
    result = add_document(title, content, category)
    return result

@app.post("/draft")
async def draft_clause(request: str, doc_type: str = "claim", user=Depends(verify_token)):
    docs = search_documents(request)
    context = "\n\n".join([f"title: {d['title']}\n{d['content']}" for d in docs])
    system_prompt = DOC_PROMPTS.get(doc_type, DOC_PROMPTS["claim"])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""{system_prompt}

بناءً على هذه النماذج القانونية المعتمدة:
{context}

التفاصيل:
{request}

اكتب الوثيقة كاملة بالعربية الفصحى القانونية بدون أي شرح أو مقدمة."""
        }]
    )
    return {
        "draft": message.content[0].text,
        "based_on": [d['title'] for d in docs]
    }

@app.post("/translate")
async def translate_legal(text: str, direction: str = "en_to_ar", user=Depends(verify_token)):
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
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    return {
        "translation": message.content[0].text,
        "direction": direction
    }