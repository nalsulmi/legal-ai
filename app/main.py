from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from app.rag import add_document, search_documents
import anthropic
import httpx
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
async def draft_clause(request: str, user=Depends(verify_token)):
    docs = search_documents(request)
    context = "\n\n".join([f"title: {d['title']}\n{d['content']}" for d in docs])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": f"""أنت محامٍ خبير في الصياغة القانونية السعودية.
بناءً على هذه النماذج القانونية المعتمدة فقط:

{context}

اصغ بنداً قانونياً احترافياً لهذا الطلب:
{request}

اكتب البند فقط بدون أي شرح أو مقدمة."""
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
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    return {
        "translation": message.content[0].text,
        "direction": direction
    }