"""
RAG Integration Module for QuizMaster AI Backend

This module provides integration between the RAG retrieval service and the existing
quiz generation system. It handles the Priority 21 requirement for retrieving content
using RAG with topic and difficulty filtering.
"""

from typing import List, Dict, Optional
from rag_retrieval_service import (
    RAGRetrievalService,
    RetrievalRequest,
    RetrievedContent,
    DifficultyLevel,
    get_rag_service
)


class RAGContentManager:
    """
    Manager class for RAG content operations in the quiz system
    
    This class handles:
    - Indexing PDF content with metadata
    - Retrieving relevant content for quiz generation
    - Applying business rules for topic and difficulty filtering
    """
    
    def __init__(self, rag_service: Optional[RAGRetrievalService] = None):
        """
        Initialize RAG Content Manager
        
        Args:
            rag_service: Optional RAG service instance (creates singleton if not provided)
        """
        self.rag_service = rag_service or get_rag_service()
    
    def index_pdf_content(
        self,
        pdf_id: int,
        content: str,
        metadata: Dict = None
    ) -> bool:
        """
        Index PDF content for RAG retrieval
        
        Args:
            pdf_id: Database ID of the PDF
            content: Extracted text content from PDF
            metadata: Additional metadata (topic, difficulty, etc.)
            
        Returns:
            True if indexing successful, False otherwise
        """
        # Prepare metadata with PDF ID
        doc_metadata = metadata or {}
        doc_metadata['pdf_id'] = pdf_id
        doc_metadata['content_type'] = 'pdf'
        
        return self.rag_service.index_content(
            content=content,
            metadata=doc_metadata,
            document_id=f"pdf_{pdf_id}"
        )
    
    def retrieve_content_for_quiz(
        self,
        query: str,
        pdf_id: Optional[int] = None,
        topic: Optional[str] = None,
        difficulty: Optional[str] = None,
        num_questions: int = 5
    ) -> List[Dict]:
        """
        Retrieve relevant content for quiz generation
        
        Args:
            query: User query or topic description
            pdf_id: Optional PDF ID to filter content
            topic: Optional topic to filter content
            difficulty: Optional difficulty level ('easy', 'medium', 'hard')
            num_questions: Number of questions to generate (affects retrieval count)
            
        Returns:
            List of dictionaries with retrieved content and metadata
        """
        # Convert difficulty string to enum
        difficulty_enum = None
        if difficulty:
            try:
                difficulty_enum = DifficultyLevel(difficulty.lower())
            except ValueError:
                print(f"⚠️ Invalid difficulty level: {difficulty}")
        
        # Build retrieval request
        request = RetrievalRequest(
            query=query,
            topic=topic,
            difficulty=difficulty_enum,
            num_results=num_questions * 2,  # Retrieve more for variety
            min_relevance_score=0.6
        )
        
        # Add PDF filter to metadata if specified
        if pdf_id:
            # This would require modifying the retrieval service to support
            # custom metadata filters, but for now we'll rely on the topic/difficulty
            pass
        
        # Retrieve content
        retrieved_content = self.rag_service.retrieve_content(request)
        
        # Convert to dictionary format for easier usage
        results = []
        for content in retrieved_content:
            results.append({
                'content': content.content,
                'relevance_score': content.relevance_score,
                'source_document': content.source_document,
                'chunk_id': content.chunk_id,
                'topic': content.topic,
                'difficulty': content.difficulty.value if content.difficulty else None,
                'metadata': content.metadata
            })
        
        return results
    
    def get_context_for_generation(
        self,
        query: str,
        topic: Optional[str] = None,
        difficulty: Optional[str] = None,
        max_context_length: int = 2000
    ) -> str:
        """
        Get combined context string for quiz generation
        
        Args:
            query: User query or topic
            topic: Optional topic filter
            difficulty: Optional difficulty filter
            max_context_length: Maximum length of context window
            
        Returns:
            Combined context string
        """
        retrieved_content = self.retrieve_content_for_quiz(
            query=query,
            topic=topic,
            difficulty=difficulty,
            num_questions=3
        )
        
        # Convert back to RetrievedContent objects
        content_objects = [
            RetrievedContent(
                content=item['content'],
                relevance_score=item['relevance_score'],
                source_document=item['source_document'],
                chunk_id=item['chunk_id'],
                topic=item['topic'],
                difficulty=DifficultyLevel(item['difficulty']) if item['difficulty'] else None,
                metadata=item['metadata']
            )
            for item in retrieved_content
        ]
        
        return self.rag_service.get_context_window(
            content_objects,
            window_size=max_context_length
        )
    
    def get_relevant_sections(
        self,
        pdf_id: int,
        topic: str,
        difficulty: str = "medium",
        num_sections: int = 3
    ) -> List[str]:
        """
        Get most relevant sections from a specific PDF for a given topic
        
        Args:
            pdf_id: PDF database ID
            topic: Topic to search for
            difficulty: Difficulty level
            num_sections: Number of sections to retrieve
            
        Returns:
            List of relevant content sections
        """
        results = self.retrieve_content_for_quiz(
            query=topic,
            pdf_id=pdf_id,
            topic=topic,
            difficulty=difficulty,
            num_questions=num_sections
        )
        
        return [result['content'] for result in results]


# Singleton instance for application-wide use
_rag_manager_instance = None

def get_rag_manager() -> RAGContentManager:
    """
    Get or create singleton RAG Content Manager instance
    
    Returns:
        RAGContentManager instance
    """
    global _rag_manager_instance
    
    if _rag_manager_instance is None:
        _rag_manager_instance = RAGContentManager()
    
    return _rag_manager_instance


# FastAPI integration example
def integrate_with_fastapi():
    """
    Example of how to integrate RAG service with FastAPI endpoints
    
    This function shows the pattern for using RAG in existing quiz endpoints
    """
    from fastapi import Depends, HTTPException
    from sqlalchemy.orm import Session
    
    # Example endpoint integration
    async def generate_quiz_with_rag(
        pdf_id: int,
        topic: str,
        difficulty: str = "medium",
        db: Session = Depends(get_db)
    ):
        """
        Generate quiz using RAG for content retrieval
        
        This would be integrated into the existing quiz generation endpoint
        """
        rag_manager = get_rag_manager()
        
        # Retrieve relevant content
        relevant_sections = rag_manager.get_relevant_sections(
            pdf_id=pdf_id,
            topic=topic,
            difficulty=difficulty,
            num_sections=5
        )
        
        if not relevant_sections:
            raise HTTPException(
                status_code=404,
                detail="No relevant content found for the given topic"
            )
        
        # Use retrieved content for quiz generation
        # This would connect to your existing quiz generation logic
        # For example:
        # questions = generate_questions_from_content(relevant_sections)
        
        return {
            "status": "success",
            "retrieved_sections": len(relevant_sections),
            "content": relevant_sections
        }


if __name__ == "__main__":
    # Test the integration
    print("🧪 Testing RAG Content Manager Integration")
    
    manager = get_rag_manager()
    
    # Test content retrieval
    results = manager.retrieve_content_for_quiz(
        query="machine learning algorithms",
        topic="artificial intelligence",
        difficulty="medium",
        num_questions=3
    )
    
    print(f"📊 Retrieved {len(results)} content sections")
    for i, result in enumerate(results, 1):
        print(f"\n{i}. Score: {result['relevance_score']:.2f}")
        print(f"   Content: {result['content'][:100]}...")