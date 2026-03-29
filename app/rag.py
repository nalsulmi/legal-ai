from openai import OpenAI
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

def get_embedding(text: str):
    response = openai_client.embeddings.create(
        model="text-embedding-ada-002",
        input=text
    )
    return response.data[0].embedding

def add_document(title: str, content: str, category: str):
    embedding = get_embedding(content)
    supabase.table("documents").insert({
        "title": title,
        "content": content,
        "category": category,
        "embedding": embedding
    }).execute()
    return {"status": "added", "title": title}

def search_documents(query: str, limit: int = 3):
    query_embedding = get_embedding(query)
    result = supabase.rpc("match_documents", {
        "query_embedding": query_embedding,
        "match_threshold": 0.7,
        "match_count": limit
    }).execute()
    return result.data