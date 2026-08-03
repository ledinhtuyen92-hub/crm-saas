import os
import PyPDF2
from docx import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from .models import AiKnowledgeDocument, AiKnowledgeChunk
from openai import OpenAI
import google.generativeai as genai

def parse_document(file_path, doc_type):
    """
    Đọc text từ file PDF hoặc DOCX hoặc TXT.
    """
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    
    try:
        if ext == '.pdf':
            with open(file_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        elif ext == '.docx':
            doc = Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif ext == '.txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
    except Exception as e:
        raise Exception(f"Lỗi khi đọc file: {str(e)}")
        
    return text

def chunk_text(text):
    """
    Băm nhỏ text theo Semantic (ngữ nghĩa) hoặc Recursive (kích thước).
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=len,
        is_separator_regex=False,
    )
    chunks = splitter.split_text(text)
    return chunks

def get_embeddings(texts, api_key):
    """
    Gọi OpenAI API để lấy embeddings cho danh sách các chunks.
    Mô hình: text-embedding-3-small
    """
    client = OpenAI(api_key=api_key)
    # Get embeddings for all chunks in one batch to save time/requests
    # OpenAI allows up to 2048 inputs per batch for embeddings
    embeddings = []
    
    # Process in batches of 100 to be safe
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = client.embeddings.create(
            input=batch,
            model="text-embedding-3-small"
        )
        for data in response.data:
            embeddings.append(data.embedding)
            
    return embeddings

def get_gemini_embeddings(texts, api_key):
    """
    Gọi Gemini API để lấy embeddings (models/text-embedding-004)
    """
    genai.configure(api_key=api_key)
    embeddings = []
    
    # Gemini allows batching too
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = genai.embed_content(
            model="models/gemini-embedding-001",
            content=batch,
            task_type="retrieval_document",
            output_dimensionality=768
        )
        for emb in response['embedding']:
            embeddings.append(emb)
            
    return embeddings

def process_and_save_document(doc_id, api_key, provider='openai'):
    """
    Hàm chính xử lý document (gọi từ Celery task).
    """
    doc = AiKnowledgeDocument.objects.get(id=doc_id)
    doc.status = 'processing'
    doc.save()
    
    try:
        text = ""
        if doc.doc_type == 'file' and doc.file_attachment:
            file_path = doc.file_attachment.path
            text = parse_document(file_path, doc.doc_type)
            
        if doc.content:
            text += "\n" + doc.content
            
        if not text.strip():
            raise Exception("Tài liệu trắng, không có văn bản hoặc mô tả.")
            
        chunks = chunk_text(text)
        
        # Get embeddings
        if provider == 'gemini':
            embeddings = get_gemini_embeddings(chunks, api_key)
        else:
            embeddings = get_embeddings(chunks, api_key)
        
        # Xóa các chunk cũ nếu có (trường hợp xử lý lại)
        doc.chunks.all().delete()
        
        # Lưu vào DB
        chunk_objects = []
        for i, chunk_text_val in enumerate(chunks):
            chunk = AiKnowledgeChunk(
                document=doc,
                content=chunk_text_val,
                embedding_provider=provider
            )
            if provider == 'gemini':
                chunk.embedding_gemini = embeddings[i]
            else:
                chunk.embedding = embeddings[i]
                
            chunk_objects.append(chunk)
            
        AiKnowledgeChunk.objects.bulk_create(chunk_objects)
        
        # Lưu text extract được vào content để Frontend có thể hiển thị
        if doc.doc_type == 'file' and not doc.content:
            doc.content = text.strip()
        
        doc.status = 'completed'
        doc.error_message = ''
        doc.save()
        
    except Exception as e:
        doc.status = 'failed'
        doc.error_message = str(e)
        doc.save()
        raise e

def search_knowledge(agent, query: str, limit: int = 4):
    """
    Tìm kiếm chunk có semantic tương đồng với câu hỏi (query).
    """
    from .models import AiKnowledgeChunk
    from .services import get_api_keys
    from pgvector.django import CosineDistance
    import logging
    
    if not query or not query.strip():
        return ""
        
    try:
        # Determine provider
        provider = getattr(agent.company.ai_settings, 'default_embedding_provider', 'openai')
        keys = get_api_keys(agent.company, provider)
        api_key = keys[0] if keys else None
        
        if not api_key:
            return ""
            
        if provider == 'gemini':
            query_vector = get_gemini_embeddings([query], api_key)[0]
            chunks = AiKnowledgeChunk.objects.filter(
                document__agent=agent,
                document__status='completed',
                embedding_gemini__isnull=False
            ).annotate(distance=CosineDistance('embedding_gemini', query_vector)).order_by('distance')[:limit]
        else:
            query_vector = get_embeddings([query], api_key)[0]
            chunks = AiKnowledgeChunk.objects.filter(
                document__agent=agent,
                document__status='completed',
                embedding__isnull=False
            ).annotate(distance=CosineDistance('embedding', query_vector)).order_by('distance')[:limit]
            
        if chunks:
            # We can filter out chunks with distance > 0.6 if needed to reduce noise
            # but for now, just return top matches
            knowledge_texts = []
            for c in chunks:
                if getattr(c, 'distance', 1) < 0.7:  # Threshold
                    knowledge_texts.append(f"- (Nguồn: {c.document.title}) {c.content}")
                    
            if knowledge_texts:
                return "\n\n[TRÍCH XUẤT KIẾN THỨC NỘI BỘ TỪ CÔNG TY (RAG)]:\n" + "\n".join(knowledge_texts) + "\n(Hãy ưu tiên sử dụng những kiến thức trên để trả lời khách hàng một cách chính xác nhất)."
                
    except Exception as e:
        logging.getLogger(__name__).error(f"RAG Search Error: {e}")
        
    return ""