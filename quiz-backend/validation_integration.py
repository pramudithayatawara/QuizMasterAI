"""
Question Validation and Duplicate Prevention Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for the question relevance validation and duplicate
prevention services, implementing Priority 28 and Priority 29 requirements for question
quality control and deduplication.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback

from relevance_validator import (
    RelevanceValidator,
    RelevanceValidationRequest,
    RelevanceValidationResponse,
    BatchRelevanceValidationRequest,
    BatchRelevanceValidationResponse,
    get_relevance_validator
)

from duplicate_detector import (
    DuplicateDetector,
    DuplicationCheckRequest,
    DuplicationCheckResponse,
    QuestionData,
    SimilarityMethod,
    get_duplicate_detector
)

# Import your existing models
try:
    from models import User, Quiz, Question
    from database import get_db
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("⚠️ Database models not available. Install database integration.")


class QuestionValidationService:
    """
    Service class for question validation and duplicate prevention
    
    This class handles:
    - Question relevance validation against source material
    - Duplicate detection and removal
    - Combined validation pipeline
    - Integration with existing quiz system
    """
    
    def __init__(
        self,
        relevance_validator: Optional[RelevanceValidator] = None,
        duplicate_detector: Optional[DuplicateDetector] = None
    ):
        """
        Initialize Question Validation Service
        
        Args:
            relevance_validator: Optional RelevanceValidator instance
            duplicate_detector: Optional DuplicateDetector instance
        """
        self.relevance_validator = relevance_validator or get_relevance_validator()
        self.duplicate_detector = duplicate_detector or get_duplicate_detector()
    
    def validate_and_deduplicate(
        self,
        questions: List[dict],
        source_content: str,
        similarity_threshold: float = 0.8,
        relevance_threshold: float = 0.6,
        topic: Optional[str] = None
    ) -> dict:
        """
        Run complete validation pipeline: relevance check + duplicate removal
        
        Args:
            questions: List of question dictionaries
            source_content: Source material for relevance validation
            similarity_threshold: Maximum allowed similarity (0-1)
            relevance_threshold: Minimum relevance score (0-1)
            topic: Expected topic for questions
            
        Returns:
            Dictionary with validation results
        """
        from relevance_validator import QuestionType as RelQuestionType
        from duplicate_detector import QuestionType as DupQuestionType
        
        # Step 1: Validate relevance
        relevance_results = []
        for i, question in enumerate(questions):
            request = RelevanceValidationRequest(
                question_text=question.get('question_text', ''),
                question_type=RelQuestionType(question.get('question_type', 'mcq')),
                options=question.get('options'),
                source_content=source_content,
                source_chunk_index=question.get('source_chunk_index', 0),
                topic=topic,
                min_relevance_score=relevance_threshold
            )
            response = self.relevance_validator.validate_relevance(request)
            relevance_results.append(response)
        
        # Filter relevant questions
        relevant_questions = self.relevance_validator.filter_relevant_questions(relevance_results)
        relevant_indices = [
            i for i, r in enumerate(relevance_results)
            if r.is_relevant and r.is_answerable
        ]
        
        # Step 2: Check for duplicates among relevant questions
        if relevant_questions:
            # Convert to QuestionData format
            question_data_list = []
            for i, idx in enumerate(relevant_indices):
                question_data = QuestionData(
                    question_text=questions[idx].get('question_text', ''),
                    question_type=DupQuestionType(questions[idx].get('question_type', 'mcq')),
                    options=questions[idx].get('options'),
                    source_chunk_index=questions[idx].get('source_chunk_index', 0),
                    topic=questions[idx].get('topic'),
                    question_id=f"q_{idx}"
                )
                question_data_list.append(question_data)
            
            duplicate_request = DuplicationCheckRequest(
                questions=question_data_list,
                similarity_threshold=similarity_threshold,
                similarity_method=SimilarityMethod.HYBRID,
                check_options=True
            )
            
            duplicate_response = self.duplicate_detector.check_duplicates(duplicate_request)
            
            # Get final unique questions
            unique_questions_data = duplicate_response.unique_questions
            final_questions = [
                questions[relevant_indices[i]]
                for i, qd in enumerate(unique_questions_data)
            ]
        else:
            final_questions = []
            duplicate_response = None
        
        return {
            "original_count": len(questions),
            "relevant_count": len(relevant_questions),
            "unique_count": len(final_questions),
            "removed_count": len(questions) - len(final_questions),
            "final_questions": final_questions,
            "relevance_results": relevance_results,
            "duplicate_response": duplicate_response,
            "metadata": {
                "similarity_threshold": similarity_threshold,
                "relevance_threshold": relevance_threshold,
                "topic": topic
            }
        }
    
    def validate_quiz_questions(
        self,
        quiz_id: int,
        db: Session,
        source_content: Optional[str] = None
    ) -> dict:
        """
        Validate all questions in a quiz
        
        Args:
            quiz_id: Quiz identifier
            db: Database session
            source_content: Source material for relevance validation
            
        Returns:
            Dictionary with validation results
        """
        if not MODELS_AVAILABLE:
            return {
                "success": False,
                "error": "Database models not available"
            }
        
        try:
            from models import Quiz as QuizModel, Question as QuestionModel
            
            # Get quiz and questions
            quiz = db.query(QuizModel).filter(QuizModel.id == quiz_id).first()
            if not quiz:
                return {
                    "success": False,
                    "error": f"Quiz {quiz_id} not found"
                }
            
            questions = db.query(QuestionModel).filter(QuestionModel.quiz_id == quiz_id).all()
            
            # Convert to question dictionaries
            question_dicts = []
            for q in questions:
                question_dict = {
                    "question_text": q.question_text,
                    "question_type": "mcq" if q.options and len(q.options) > 2 else "true_false",
                    "options": q.options if q.options else None,
                    "source_chunk_index": 0,
                    "topic": quiz.category
                }
                question_dicts.append(question_dict)
            
            # Run validation if source content is provided
            if source_content:
                validation_result = self.validate_and_deduplicate(
                    questions=question_dicts,
                    source_content=source_content,
                    topic=quiz.category
                )
            else:
                # Only check for duplicates if no source content
                from duplicate_detector import QuestionType as DupQuestionType
                question_data_list = [
                    QuestionData(
                        question_text=q.question_text,
                        question_type=DupQuestionType("mcq" if q.options and len(q.options) > 2 else "true_false"),
                        options=q.options if q.options else None,
                        source_chunk_index=0,
                        topic=quiz.category,
                        question_id=f"q_{q.id}"
                    )
                    for q in questions
                ]
                
                duplicate_request = DuplicationCheckRequest(
                    questions=question_data_list,
                    similarity_threshold=0.8,
                    similarity_method=SimilarityMethod.HYBRID,
                    check_options=True
                )
                
                duplicate_response = self.duplicate_detector.check_duplicates(duplicate_request)
                validation_result = {
                    "original_count": len(questions),
                    "relevant_count": len(questions),
                    "unique_count": duplicate_response.filtered_count,
                    "removed_count": duplicate_response.duplicates_removed,
                    "final_questions": question_dicts,
                    "relevance_results": [],
                    "duplicate_response": duplicate_response,
                    "metadata": {
                        "source_content_provided": False
                    }
                }
            
            return {
                "success": True,
                "quiz_id": quiz_id,
                "validation_result": validation_result
            }
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error validating quiz questions: {e}")
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance for application-wide use
_question_validation_service_instance = None

def get_question_validation_service() -> QuestionValidationService:
    """
    Get or create singleton Question Validation Service instance
    
    Returns:
        QuestionValidationService instance
    """
    global _question_validation_service_instance
    
    if _question_validation_service_instance is None:
        _question_validation_service_instance = QuestionValidationService()
    
    return _question_validation_service_instance


# FastAPI router for validation endpoints
def create_validation_router():
    """
    Create FastAPI router for question validation endpoints
    
    Returns:
        FastAPI router with validation endpoints
    """
    router = APIRouter(prefix="/api/v1/validation", tags=["Question Validation"])
    
    @router.post("/relevance", response_model=RelevanceValidationResponse)
    async def validate_relevance(request: RelevanceValidationRequest):
        """
        Validate question relevance against source material
        
        Business Rules:
        - Validate generated questions against source material
        - Remove off-topic questions
        - Remove unanswerable questions
        """
        try:
            service = get_question_validation_service()
            response = service.relevance_validator.validate_relevance(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to validate relevance: {str(e)}"
            )
    
    @router.post("/relevance-batch", response_model=BatchRelevanceValidationResponse)
    async def validate_batch_relevance(request: BatchRelevanceValidationRequest):
        """
        Validate relevance for multiple questions in batch
        
        Args:
            request: BatchRelevanceValidationRequest with multiple questions
            
        Returns:
            BatchRelevanceValidationResponse with validation results
        """
        try:
            service = get_question_validation_service()
            response = service.relevance_validator.validate_batch_relevance(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to validate batch relevance: {str(e)}"
            )
    
    @router.post("/duplicates", response_model=DuplicationCheckResponse)
    async def check_duplicates(request: DuplicationCheckRequest):
        """
        Check for duplicate questions using similarity algorithms
        
        Business Rules:
        - Use similarity algorithms (cosine, SequenceMatcher, or hybrid)
        - Ensure maximum 80% similarity between questions
        - Automatically remove duplicates
        """
        try:
            service = get_question_validation_service()
            response = service.duplicate_detector.check_duplicates(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to check duplicates: {str(e)}"
            )
    
    @router.post("/validate-and-deduplicate")
    async def validate_and_deduplicate(
        questions: List[dict],
        source_content: str,
        similarity_threshold: float = 0.8,
        relevance_threshold: float = 0.6,
        topic: Optional[str] = None
    ):
        """
        Run complete validation pipeline: relevance check + duplicate removal
        
        This is a convenience endpoint that combines relevance validation and duplicate removal.
        
        Args:
            questions: List of question dictionaries
            source_content: Source material for relevance validation
            similarity_threshold: Maximum allowed similarity (0-1)
            relevance_threshold: Minimum relevance score (0-1)
            topic: Expected topic for questions
            
        Returns:
            Dictionary with validation results
        """
        try:
            service = get_question_validation_service()
            result = service.validate_and_deduplicate(
                questions=questions,
                source_content=source_content,
                similarity_threshold=similarity_threshold,
                relevance_threshold=relevance_threshold,
                topic=topic
            )
            return result
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to validate and deduplicate: {str(e)}"
            )
    
    @router.post("/validate-quiz/{quiz_id}")
    async def validate_quiz_questions(
        quiz_id: int,
        source_content: Optional[str] = None,
        db: Session = Depends(get_db)
    ):
        """
        Validate all questions in a quiz
        
        Args:
            quiz_id: Quiz identifier
            source_content: Source material for relevance validation (optional)
            db: Database session
            
        Returns:
            Dictionary with validation results
        """
        try:
            service = get_question_validation_service()
            result = service.validate_quiz_questions(
                quiz_id=quiz_id,
                db=db,
                source_content=source_content
            )
            return result
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to validate quiz questions: {str(e)}"
            )
    
    return router


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Question Validation Service Integration")
    
    # Create service instance
    service = get_question_validation_service()
    
    # Test combined validation
    questions = [
        {
            "question_text": "What is machine learning?",
            "question_type": "mcq",
            "options": ["A subset of AI", "A type of hardware", "A programming language", "A database"],
            "source_chunk_index": 0,
            "topic": "artificial intelligence"
        },
        {
            "question_text": "What is machine learning?",  # Duplicate
            "question_type": "mcq",
            "options": ["A subset of AI", "A type of hardware", "A programming language", "A database"],
            "source_chunk_index": 0,
            "topic": "artificial intelligence"
        },
        {
            "question_text": "What is cooking?",  # Off-topic
            "question_type": "mcq",
            "options": ["A culinary art", "A type of sport", "A programming language", "A database"],
            "source_chunk_index": 0,
            "topic": "artificial intelligence"
        }
    ]
    
    source_content = "Machine learning is a subset of artificial intelligence that enables systems to learn from data."
    
    result = service.validate_and_deduplicate(
        questions=questions,
        source_content=source_content,
        similarity_threshold=0.8,
        relevance_threshold=0.6,
        topic="artificial intelligence"
    )
    
    print(f"\n📊 Combined Validation Results:")
    print(f"   Original Count: {result['original_count']}")
    print(f"   Relevant Count: {result['relevant_count']}")
    print(f"   Unique Count: {result['unique_count']}")
    print(f"   Removed Count: {result['removed_count']}")
    
    print(f"\n✅ Final Questions ({len(result['final_questions'])}):")
    for i, question in enumerate(result['final_questions'], 1):
        print(f"   {i}. {question['question_text']}")