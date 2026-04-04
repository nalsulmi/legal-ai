import fitz  # PyMuPDF
import sys
import os

# إضافة مجلد المشروع للمسار
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.rag import add_document

DATA_DIR = r"C:\Users\Nawaf\Music\dataset for litiga"

FILES = [
    ("نظام المرافعات الشرعية ولوائحه التنفيذية مع الفهارس.pdf", "نظام المرافعات الشرعية", "إجراءات"),
    ("نظام الإجراءات الجزائية ولوائحه التنفيذية.pdf", "نظام الإجراءات الجزائية", "إجراءات"),
    ("نظام التنفيذ ولائحته التنفيذية.pdf", "نظام التنفيذ", "إجراءات"),
    ("نظام التحكيم ولائحته التنفيذية.pdf", "نظام التحكيم", "إجراءات"),
    ("نظام المحاكم التجارية ولوائحه التنفيذية.pdf", "نظام المحاكم التجارية", "إجراءات"),
    ("نظام العمل ولوائحه التنفيذية.pdf", "نظام العمل", "عمل"),
    ("نظام الأحوال الشخصية مع الفهارس.pdf", "نظام الأحوال الشخصية", "أسرة"),
    ("نظام الشركات ولوائحه التنفيذية.pdf", "نظام الشركات", "تجاري"),
    ("نظام التجارة الالكترونية.pdf", "نظام التجارة الإلكترونية", "تجاري"),
    ("الالئحة التنفيذية لنظام التجارة الالكترونية.pdf", "اللائحة التنفيذية لنظام التجارة الإلكترونية", "تجاري"),
    ("نظام المعاملات المدنية مع الفهارس.pdf", "نظام المعاملات المدنية", "مدني"),
    ("نظام الإفلاس ولوائحه وقواعده.pdf", "نظام الإفلاس", "تجاري"),
    ("نظام المحاكم التجارية ولوائحه التنفيذية.pdf", "نظام المحاكم التجارية", "تجاري"),
    ("نظام حماية حقوق المؤلف ولائحته التنفيذية.pdf", "نظام حماية حقوق المؤلف", "ملكية فكرية"),
    ("نظام الاتصالات.pdf", "نظام الاتصالات", "تجاري"),
    ("نظام هيئة الرقابة ومكافحة الفساد.pdf", "نظام مكافحة الفساد", "إداري"),
    ("المحاماة.pdf", "نظام المحاماة", "مهني"),
]


def extract_text(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if len(c) > 100]  # تجاهل الأجزاء القصيرة جداً


def add_pdf(filename: str, title: str, category: str):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print(f"  ⚠ الملف غير موجود: {filename}")
        return

    print(f"\n📄 جارٍ معالجة: {title}")
    text = extract_text(path)

    if not text.strip():
        print(f"  ⚠ لم يتم استخراج نص من: {filename}")
        return

    chunks = chunk_text(text)
    print(f"  عدد الأجزاء: {len(chunks)}")

    for i, chunk in enumerate(chunks):
        add_document(
            title=f"{title} — جزء {i+1}",
            content=chunk,
            category=category
        )
        print(f"  ✓ {i+1}/{len(chunks)}", end="\r")

    print(f"  ✅ اكتمل: {title} ({len(chunks)} جزء)     ")


if __name__ == "__main__":
    print("=" * 50)
    print("بدء إضافة البيانات القانونية إلى المكتبة")
    print("=" * 50)

    for filename, title, category in FILES:
        add_pdf(filename, title, category)

    print("\n" + "=" * 50)
    print("✅ اكتملت إضافة جميع الوثائق")
    print("=" * 50)