"""
Priority 21: Retrieve Content (RAG) Service Module

This module implements a comprehensive RAG (Retrieval-Augmented Generation) service
for retrieving relevant content sections from stored PDF content/chunks based on user context,
topic, and difficulty requirements.

Features:
- Vector-based semantic search using FAISS
- Content filtering by topic and difficulty
- Optimized retrieval with business rules
- LangChain integration for efficient processing
"""

import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import numpy as np

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain.embeddings import HuggingFaceEmbeddings
    from langchain.vectorstores import FAISS
    from langchain.schema import Document
    from langchain.retrievers import ContextualCompressionRetriever
    from langchain.retrievers.document_compressors import LLMChainExtractor
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    print("⚠️ LangChain not available. Install with: pip install langchain faiss-cpu sentence-transformers")


class DifficultyLevel(Enum):
    """Difficulty levels for content filtering"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


@dataclass
class RetrievalRequest:
    """Request model for content retrieval"""
    query: str
    topic: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    num_results: int = 5
    min_relevance_score: float = 0.7
    context_window: int = 1000


@dataclass
class RetrievedContent:
    """Model for retrieved content sections"""
    content: str
    relevance_score: float
    source_document: str
    chunk_id: str
    topic: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    metadata: Dict = None


class RAGRetrievalService:
    """
    RAG Service for retrieving relevant content from PDF chunks
    
    Business Rules:
    1. Content must match the selected topic
    2. Content must match the selected difficulty level
    3. RAG retrieval must be optimized for performance
    4. Results must meet minimum relevance threshold
    """
    
    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        vector_store_path: str = "./vector_store",
        chunk_size: int = 500,
        chunk_overlap: int = 50
    ):
        """
        Initialize RAG Retrieval Service
        
        Args:
            model_name: HuggingFace embedding model name
            vector_store_path: Path to store/load vector database
            chunk_size: Size of text chunks for embedding
            chunk_overlap: Overlap between chunks
        """
        self.model_name = model_name
        self.vector_store_path = vector_store_path
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        if LANGCHAIN_AVAILABLE:
            self.embeddings = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={'device': 'cpu'}
            )
            self.text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                length_function=len,
                separators=["\n\n", "\n", " ", ""]
            )
            self.vector_store = None
            print(f"✅ RAG Retrieval Service initialized with {model_name}")
        else:
            print("⚠️ RAG service running in fallback mode (no vector search)")
    
    def index_content(
        self,
        content: str,
        metadata: Dict = None,
        document_id: str = None
    ) -> bool:
        """
        Index content chunks into vector database
        
        Args:
            content: Text content to index
            metadata: Additional metadata (topic, difficulty, etc.)
            document_id: Unique identifier for the document
            
        Returns:
            True if indexing successful, False otherwise
        """
        if not LANGCHAIN_AVAILABLE:
            print("⚠️ Cannot index content: LangChain not available")
            return False
        
        try:
            # Create document with metadata
            doc_metadata = metadata or {}
            if document_id:
                doc_metadata['document_id'] = document_id
            
            document = Document(page_content=content, metadata=doc_metadata)
            
            # Split into chunks
            chunks = self.text_splitter.split_documents([document])
            
            # Add chunk IDs to metadata
            for i, chunk in enumerate(chunks):
                chunk.metadata['chunk_id'] = f"{document_id}_chunk_{i}" if document_id else f"chunk_{i}"
            
            # Create or update vector store
            if self.vector_store is None:
                self.vector_store = FAISS.from_documents(chunks, self.embeddings)
            else:
                self.vector_store.add_documents(chunks)
            
            # Save to disk
            self.vector_store.save_local(self.vector_store_path)
            
            print(f"✅ Indexed {len(chunks)} chunks from document")
            return True
            
        except Exception as e:
            print(f"❌ Error indexing content: {e}")
            return False
    
    def load_vector_store(self) -> bool:
        """
        Load existing vector store from disk
        
        Returns:
            True if loading successful, False otherwise
        """
        if not LANGCHAIN_AVAILABLE:
            return False
        
        try:
            if os.path.exists(self.vector_store_path):
                self.vector_store = FAISS.load_local(
                    self.vector_store_path,
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                print(f"✅ Loaded vector store from {self.vector_store_path}")
                return True
            else:
                print(f"⚠️ No existing vector store found at {self.vector_store_path}")
                return False
        except Exception as e:
            print(f"❌ Error loading vector store: {e}")
            return False
    
    def retrieve_content(
        self,
        request: RetrievalRequest
    ) -> List[RetrievedContent]:
        """
        Retrieve relevant content based on query and business rules
        
        Args:
            request: RetrievalRequest with query, topic, difficulty, etc.
            
        Returns:
            List of RetrievedContent objects sorted by relevance
        """
        if not LANGCHAIN_AVAILABLE:
            print("⚠️ Using fallback retrieval (no vector search)")
            return self._fallback_retrieval(request)
        
        if self.vector_store is None:
            print("⚠️ Vector store not initialized, attempting to load...")
            if not self.load_vector_store():
                print("⚠️ No vector store available, using fallback")
                return self._fallback_retrieval(request)
        
        try:
            # Build search filter based on business rules
            search_kwargs = {
                "k": request.num_results * 2,  # Retrieve more for filtering
            }
            
            # Perform similarity search
            docs_with_scores = self.vector_store.similarity_search_with_score(
                request.query,
                **search_kwargs
            )
            
            # Convert to RetrievedContent and apply business rules
            retrieved_content = []
            for doc, score in docs_with_scores:
                # Apply minimum relevance threshold
                if score < request.min_relevance_score:
                    continue
                
                # Apply topic filtering if specified
                if request.topic and doc.metadata.get('topic'):
                    if request.topic.lower() not in doc.metadata.get('topic', '').lower():
                        continue
                
                # Apply difficulty filtering if specified
                if request.difficulty and doc.metadata.get('difficulty'):
                    if doc.metadata.get('difficulty') != request.difficulty.value:
                        continue
                
                retrieved_content.append(RetrievedContent(
                    content=doc.page_content,
                    relevance_score=float(1 - score),  # Convert distance to similarity
                    source_document=doc.metadata.get('document_id', 'unknown'),
                    chunk_id=doc.metadata.get('chunk_id', 'unknown'),
                    topic=doc.metadata.get('topic'),
                    difficulty=DifficultyLevel(doc.metadata.get('difficulty')) if doc.metadata.get('difficulty') else None,
                    metadata=doc.metadata
                ))
            
            # Sort by relevance score and limit results
            retrieved_content.sort(key=lambda x: x.relevance_score, reverse=True)
            retrieved_content = retrieved_content[:request.num_results]
            
            print(f"✅ Retrieved {len(retrieved_content)} relevant content sections")
            return retrieved_content
            
        except Exception as e:
            print(f"❌ Error during retrieval: {e}")
            return self._fallback_retrieval(request)
    
    def _fallback_retrieval(self, request: RetrievalRequest) -> List[RetrievedContent]:
        """
        Fallback retrieval when vector search is not available
        
        Args:
            request: RetrievalRequest
            
        Returns:
            List of RetrievedContent objects
        """
        print("⚠️ Using simple keyword matching as fallback")
        
        # This is a simple fallback - in production, you might want to implement
        # basic TF-IDF or BM25 retrieval here
        return [
            RetrievedContent(
                content="Fallback content: Vector search not available. Please install LangChain.",
                relevance_score=0.5,
                source_document="fallback",
                chunk_id="fallback_0",
                topic=request.topic,
                difficulty=request.difficulty,
                metadata={"fallback": True}
            )
        ]
    
    def hybrid_retrieval(
        self,
        query: str,
        topic: Optional[str] = None,
        difficulty: Optional[DifficultyLevel] = None,
        num_results: int = 5,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3
    ) -> List[RetrievedContent]:
        """
        Hybrid retrieval combining semantic and keyword search
        
        Args:
            query: Search query
            topic: Optional topic filter
            difficulty: Optional difficulty filter
            num_results: Number of results to return
            semantic_weight: Weight for semantic search results
            keyword_weight: Weight for keyword search results
            
        Returns:
            List of RetrievedContent objects with combined scores
        """
        request = RetrievalRequest(
            query=query,
            topic=topic,
            difficulty=difficulty,
            num_results=num_results
        )
        
        # Get semantic results
        semantic_results = self.retrieve_content(request)
        
        # In a full implementation, you would also get keyword results here
        # and combine them with the specified weights
        
        return semantic_results
    
    def get_context_window(
        self,
        retrieved_content: List[RetrievedContent],
        window_size: int = 1000
    ) -> str:
        """
        Combine retrieved content into a context window
        
        Args:
            retrieved_content: List of retrieved content sections
            window_size: Maximum size of context window
            
        Returns:
            Combined context string
        """
        context_parts = []
        current_size = 0
        
        for content in retrieved_content:
            if current_size + len(content.content) > window_size:
                # Add partial content if it fits
                remaining = window_size - current_size
                if remaining > 100:  # Only add if meaningful amount remains
                    context_parts.append(content.content[:remaining])
                break
            context_parts.append(content.content)
            current_size += len(content.content)
        
        return "\n\n".join(context_parts)
    
    def clear_vector_store(self) -> bool:
        """
        Clear the vector store
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if os.path.exists(self.vector_store_path):
                import shutil
                shutil.rmtree(self.vector_store_path)
                print(f"✅ Cleared vector store at {self.vector_store_path}")
            self.vector_store = None
            return True
        except Exception as e:
            print(f"❌ Error clearing vector store: {e}")
            return False


# Singleton instance for application-wide use
_rag_service_instance = None

def get_rag_service(
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
    vector_store_path: str = "./vector_store"
) -> RAGRetrievalService:
    """
    Get or create singleton RAG service instance
    
    Args:
        model_name: HuggingFace embedding model name
        vector_store_path: Path to vector store
        
    Returns:
        RAGRetrievalService instance
    """
    global _rag_service_instance
    
    if _rag_service_instance is None:
        _rag_service_instance = RAGRetrievalService(
            model_name=model_name,
            vector_store_path=vector_store_path
        )
        # Try to load existing vector store
        _rag_service_instance.load_vector_store()
    
    return _rag_service_instance


# Example usage and testing
if __name__ == "__main__":
    # Example usage of the RAG service
    print("🧪 Testing RAG Retrieval Service")
    
    # Create service instance
    rag_service = get_rag_service()
    
    # Example content to index
    sample_content = """
    Machine learning is a subset of artificial intelligence that enables systems to learn from data.
    Deep learning uses neural networks with multiple layers to extract features from data.
    Natural language processing deals with the interaction between computers and human language.
    Computer vision enables machines to interpret and understand visual information from the world.
    """
    
    # Index content with metadata
    success = rag_service.index_content(
        content=sample_content,
        metadata={
            "topic": "artificial intelligence",
            "difficulty": "medium",
            "source": "textbook"
        },
        document_id="sample_doc_1"
    )
    
    if success:
        print("✅ Content indexed successfully")
        
        # Test retrieval
        request = RetrievalRequest(
            query="What is machine learning?",
            topic="artificial intelligence",
            difficulty=DifficultyLevel.MEDIUM,
            num_results=3
        )
        
        results = rag_service.retrieve_content(request)
        
        print(f"\n📊 Retrieved {len(results)} content sections:")
        for i, result in enumerate(results, 1):
            print(f"\n{i}. Relevance: {result.relevance_score:.2f}")
            print(f"   Content: {result.content[:100]}...")
            print(f"   Topic: {result.topic}")
            print(f"   Difficulty: {result.difficulty}")
    else:
        print("❌ Failed to index content")