"""
Answer and Explanation Generator Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for the answer determination and explanation generation services,
implementing Priority 26 and Priority 27 requirements for accurate answer determination and educational
explanation generation based on source material.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback

from answer_generator import (
    AnswerGenerator,
    AnswerDeterminationRequest,
    AnswerDeterminationResponse,
    BatchAnswerDeterminationRequest,
    BatchAnswerDeterminationResponse,
    get_answer_generator
)

from explanation_generator import (
    ExplanationGenerator,
    ExplanationGenerationRequest,
    ExplanationGenerationResponse,
    BatchExplanationGenerationRequest,
    BatchExplanationGenerationResponse,
    get_explanation_generator
)

# Import your existing models
try:
    from models import User, Quiz, Question
    from database import get_db
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("⚠️ Database models not available. Install database integration.")


class AnswerExplanationService:
    """
    Service class for answer determination and explanation generation
    
    This class handles:
    - Answer determination from source material
    - Explanation generation for correct answers
    - Source content referencing
    - Integration with existing quiz system
    """
    
    def __init__(
        self,
        answer_generator: Optional[AnswerGenerator] = None,
        explanation_generator: Optional[ExplanationGenerator] = None
    ):
        """
        Initialize Answer Explanation Service
        
        Args:
            answer_generator: Optional AnswerGenerator instance
            explanation_generator: Optional ExplanationGenerator instance
        """
        self.answer_generator = answer_generator or get_answer_generator()
        self.explanation_generator = explanation_generator or get_explanation_generator()
    
    def determine_answer_with_explanation(
        self,
        question_text: str,
        question_type: str,
        options: Optional[List[str]],
        correct_answer: Optional[str],
        source_content: str,
        source_chunk_index: int = 0,
        difficulty: str = "medium",
        topic: Optional[str] = None,
        explanation_length: str = "medium"
    ) -> dict:
        """
        Determine answer and generate explanation in one call
        
        Args:
            question_text: The question text or statement
            question_type: Type of question (MCQ or True/False)
            options: Options for MCQ questions
            correct_answer: Known correct answer (optional, will be determined if not provided)
            source_content: Source material
            source_chunk_index: Index of source chunk used
            difficulty: Difficulty level
            topic: Topic of the question
            explanation_length: Length of explanation
            
        Returns:
            Dictionary with answer and explanation
        """
        from answer_generator import QuestionType as AnsQuestionType
        from explanation_generator import QuestionType as ExpQuestionType
        from answer_generator import DifficultyLevel as AnsDifficultyLevel
        from explanation_generator import DifficultyLevel as ExpDifficultyLevel
        
        # Convert string to enum
        question_type_enum = AnsQuestionType(question_type.lower())
        difficulty_enum = AnsDifficultyLevel(difficulty.lower())
        
        # Determine answer if not provided
        if correct_answer is None:
            answer_request = AnswerDeterminationRequest(
                question_text=question_text,
                question_type=question_type_enum,
                options=options,
                source_content=source_content,
                source_chunk_index=source_chunk_index,
                difficulty=difficulty_enum,
                topic=topic
            )
            answer_response = self.answer_generator.determine_answer(answer_request)
            determined_answer = answer_response.correct_answer
            is_true = answer_response.is_true
            confidence = answer_response.confidence_score
        else:
            determined_answer = correct_answer
            is_true = None
            confidence = 1.0
        
        # Generate explanation
        explanation_request = ExplanationGenerationRequest(
            question_text=question_text,
            question_type=ExpQuestionType(question_type.lower()),
            correct_answer=determined_answer,
            options=options,
            source_content=source_content,
            source_chunk_index=source_chunk_index,
            difficulty=ExpDifficultyLevel(difficulty.lower()),
            topic=topic,
            explanation_length=explanation_length
        )
        explanation_response = self.explanation_generator.generate_explanation(explanation_request)
        
        return {
            "question_text": question_text,
            "question_type": question_type,
            "correct_answer": determined_answer,
            "is_true": is_true,
            "confidence_score": confidence,
            "explanation": explanation_response.explanation,
            "source_reference": explanation_response.source_reference,
            "key_concepts": explanation_response.key_concepts,
            "difficulty": difficulty,
            "topic": topic
        }
    
    def update_question_with_answer_and_explanation(
        self,
        question_id: int,
        answer_determination: AnswerDeterminationResponse,
        explanation: str,
        db: Session
    ) -> bool:
        """
        Update a question record with determined answer and explanation
        
        Args:
            question_id: Question identifier
            answer_determination: Answer determination response
            explanation: Generated explanation
            db: Database session
            
        Returns:
            True if successful, False otherwise
        """
        if not MODELS_AVAILABLE:
            print("⚠️ Cannot update question: models not available")
            return False
        
        try:
            from models import Question as QuestionModel
            
            # Get question
            question = db.query(QuestionModel).filter(QuestionModel.id == question_id).first()
            if not question:
                print(f"⚠️ Question {question_id} not found in database")
                return False
            
            # Update question with explanation
            # Note: Depending on your schema, you may need to add an explanation field
            # For now, we'll update the question_text to include explanation
            if hasattr(question, 'explanation'):
                question.explanation = explanation
            else:
                # Store explanation in question_text if no separate field exists
                question.question_text = f"{question.question_text}\n\nExplanation: {explanation}"
            
            db.commit()
            
            print(f"✅ Updated question {question_id} with answer and explanation")
            return True
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error updating question: {e}")
            traceback.print_exc()
            return False


# Singleton instance for application-wide use
_answer_explanation_service_instance = None

def get_answer_explanation_service() -> AnswerExplanationService:
    """
    Get or create singleton Answer Explanation Service instance
    
    Returns:
        AnswerExplanationService instance
    """
    global _answer_explanation_service_instance
    
    if _answer_explanation_service_instance is None:
        _answer_explanation_service_instance = AnswerExplanationService()
    
    return _answer_explanation_service_instance


# FastAPI router for answer and explanation endpoints
def create_answer_explanation_router():
    """
    Create FastAPI router for answer determination and explanation generation endpoints
    
    Returns:
        FastAPI router with answer and explanation endpoints
    """
    router = APIRouter(prefix="/api/v1/answers", tags=["Answer & Explanation Generation"])
    
    @router.post("/determine", response_model=AnswerDeterminationResponse)
    async def determine_answer(request: AnswerDeterminationRequest):
        """
        Determine the correct answer for a question based on source material
        
        Business Rules:
        - Determine accurate, factually correct answers based on source material
        - Use AI model for answer determination
        - Validate answers against source content
        - Provide confidence scores
        """
        try:
            service = get_answer_explanation_service()
            response = service.answer_generator.determine_answer(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to determine answer: {str(e)}"
            )
    
    @router.post("/determine-batch", response_model=BatchAnswerDeterminationResponse)
    async def determine_batch_answers(request: BatchAnswerDeterminationRequest):
        """
        Determine answers for multiple questions in batch
        
        Args:
            request: BatchAnswerDeterminationRequest with multiple questions
            
        Returns:
            BatchAnswerDeterminationResponse with determined answers
        """
        try:
            service = get_answer_explanation_service()
            response = service.answer_generator.determine_batch_answers(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to determine batch answers: {str(e)}"
            )
    
    @router.post("/explain", response_model=ExplanationGenerationResponse)
    async def generate_explanation(request: ExplanationGenerationRequest):
        """
        Generate an explanation for the correct answer based on source content
        
        Business Rules:
        - Create clear, educational explanations for correct answers
        - Reference original source content
        - Use AI model for explanation generation
        - Support different explanation lengths
        """
        try:
            service = get_answer_explanation_service()
            response = service.explanation_generator.generate_explanation(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate explanation: {str(e)}"
            )
    
    @router.post("/explain-batch", response_model=BatchExplanationGenerationResponse)
    async def generate_batch_explanations(request: BatchExplanationGenerationRequest):
        """
        Generate explanations for multiple questions in batch
        
        Args:
            request: BatchExplanationGenerationRequest with multiple questions
            
        Returns:
            BatchExplanationGenerationResponse with generated explanations
        """
        try:
            service = get_answer_explanation_service()
            response = service.explanation_generator.generate_batch_explanations(request)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate batch explanations: {str(e)}"
            )
    
    @router.post("/determine-and-explain")
    async def determine_answer_with_explanation(
        question_text: str,
        question_type: str,
        options: Optional[List[str]] = None,
        correct_answer: Optional[str] = None,
        source_content: str = "",
        source_chunk_index: int = 0,
        difficulty: str = "medium",
        topic: Optional[str] = None,
        explanation_length: str = "medium"
    ):
        """
        Determine answer and generate explanation in one call
        
        This is a convenience endpoint that combines answer determination and explanation generation.
        
        Args:
            question_text: The question text or statement
            question_type: Type of question (MCQ or True/False)
            options: Options for MCQ questions
            correct_answer: Known correct answer (optional, will be determined if not provided)
            source_content: Source material
            source_chunk_index: Index of source chunk used
            difficulty: Difficulty level
            topic: Topic of the question
            explanation_length: Length of explanation
            
        Returns:
            Dictionary with answer and explanation
        """
        try:
            service = get_answer_explanation_service()
            result = service.determine_answer_with_explanation(
                question_text=question_text,
                question_type=question_type,
                options=options,
                correct_answer=correct_answer,
                source_content=source_content,
                source_chunk_index=source_chunk_index,
                difficulty=difficulty,
                topic=topic,
                explanation_length=explanation_length
            )
            return result
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to determine answer and generate explanation: {str(e)}"
            )
    
    return router


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Answer Explanation Service Integration")
    
    # Create service instance
    service = get_answer_explanation_service()
    
    # Test combined answer determination and explanation
    result = service.determine_answer_with_explanation(
        question_text="What is machine learning?",
        question_type="mcq",
        options=[
            "A subset of AI that learns from data",
            "A type of computer hardware",
            "A programming language",
            "A database system"
        ],
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        source_chunk_index=0,
        difficulty="medium",
        topic="artificial intelligence",
        explanation_length="medium"
    )
    
    print(f"\n📊 Combined Answer and Explanation:")
    print(f"   Question: {result['question_text']}")
    print(f"   Correct Answer: {result['correct_answer']}")
    print(f"   Confidence: {result['confidence_score']:.2f}")
    print(f"   Explanation: {result['explanation']}")
    print(f"   Source Reference: {result['source_reference']}")
    print(f"   Key Concepts: {result['key_concepts']}")