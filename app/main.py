from fastapi import FastAPI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from app.rag import add_document, search_documents
import anthropic
import os

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

@app.get("/")
def home():
    return {"status": "Legal AI is running!"}

@app.post("/add-document")
def upload_document(title: str, content: str, category: str):
    result = add_document(title, content, category)
    return result

@app.post("/draft")
def draft_clause(request: str):
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
def translate_legal(text: str, direction: str = "en_to_ar"):
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