"""
True/False Question Generator Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for the True/False question generation service,
implementing Priority 24 requirements for generating clear, unambiguous True/False questions
from content chunks with strict business rules enforcement.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback

from tf_generator import (
    TrueFalseGenerator,
    TFGenerationRequest,
    TFGenerationResponse,
    TrueFalseQuestion,
    DifficultyLevel,
    get_tf_generator
)

# Import your existing models
try:
    from models import User, Quiz, Question
    from database import get_db
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("⚠️ Database models not available. Install database integration.")


class TFService:
    """
    Service class for True/False question operations in the quiz system
    
    This class handles:
    - True/False question generation from content chunks
    - Validation of business rules (clarity, unambiguous answers)
    - Database persistence
    - Integration with existing quiz system
    """
    
    def __init__(self, generator: Optional[TrueFalseGenerator] = None):
        """
        Initialize True/False Service
        
        Args:
            generator: Optional TrueFalseGenerator instance
        """
        self.generator = generator or get_tf_generator()
    
    def generate_tfs_from_pdf_content(
        self,
        pdf_content: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        topic: Optional[str] = None,
        verify_against_content: bool = True
    ) -> TFGenerationResponse:
        """
        Generate True/False questions from PDF content
        
        Args:
            pdf_content: Extracted text from PDF
            num_questions: Number of True/False questions to generate
            difficulty: Difficulty level (easy/medium/hard)
            topic: Optional topic for questions
            verify_against_content: Whether to verify answers against content
            
        Returns:
            TFGenerationResponse with generated questions
        """
        # Split content into chunks
        chunk_size = 500
        words = pdf_content.split()
        chunks = []
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
        
        # Create request
        difficulty_enum = DifficultyLevel(difficulty.lower())
        request = TFGenerationRequest(
            content_chunks=chunks,
            num_questions=num_questions,
            difficulty=difficulty_enum,
            topic=topic,
            require_content_verification=verify_against_content
        )
        
        # Generate True/False questions
        return self.generator.generate_tfs_from_chunks(request)
    
    def save_tfs_to_quiz(
        self,
        user_id: int,
        tf_response: TFGenerationResponse,
        quiz_title: str,
        quiz_description: str,
        db: Session
    ) -> Optional[int]:
        """
        Save generated True/False questions to database as a quiz
        
        Args:
            user_id: User identifier
            tf_response: TFGenerationResponse with questions
            quiz_title: Title for the quiz
            quiz_description: Description for the quiz
            db: Database session
            
        Returns:
            Quiz ID if successful, None otherwise
        """
        if not MODELS_AVAILABLE:
            print("⚠️ Cannot save to database: models not available")
            return None
        
        try:
            # Import models with aliases to avoid conflicts
            from models import User as UserModel, Quiz as QuizModel, Question as QuestionModel
            
            # Check if user exists
            user = db.query(UserModel).filter(UserModel.id == user_id).first()
            if not user:
                print(f"⚠️ User {user_id} not found in database")
                return None
            
            # Create quiz record
            first_difficulty = tf_response.questions[0].difficulty.value if tf_response.questions else "medium"
            new_quiz = QuizModel(
                title=quiz_title,
                description=quiz_description,
                category=tf_response.metadata.get("topic", "general"),
                creator_id=user_id
            )
            
            db.add(new_quiz)
            db.commit()
            db.refresh(new_quiz)
            
            # Create question records
            for i, tf in enumerate(tf_response.questions):
                # Convert True/False to MCQ format for storage
                # Format: ["True", "False"] as options
                options = ["True", "False"]
                correct_answer = "True" if tf.is_true else "False"
                
                new_question = QuestionModel(
                    quiz_id=new_quiz.id,
                    question_text=tf.statement,
                    options=options,
                    correct_answer=correct_answer,
                    difficulty=tf.difficulty.value
                )
                
                db.add(new_question)
            
            db.commit()
            
            print(f"✅ Saved True/False quiz {new_quiz.id} to database with {len(tf_response.questions)} questions")
            return new_quiz.id
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error saving True/False quiz to database: {e}")
            traceback.print_exc()
            return None
    
    def validate_tf_response(self, response: TFGenerationResponse) -> bool:
        """
        Validate True/False response against business rules
        
        Args:
            response: TFGenerationResponse to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            for tf in response.questions:
                self.generator._validate_tf_business_rules(tf)
            return True
        except ValueError as e:
            print(f"❌ True/False validation failed: {e}")
            return False


# Singleton instance for application-wide use
_tf_service_instance = None

def get_tf_service() -> TFService:
    """
    Get or create singleton True/False Service instance
    
    Returns:
        TFService instance
    """
    global _tf_service_instance
    
    if _tf_service_instance is None:
        _tf_service_instance = TFService()
    
    return _tf_service_instance


# FastAPI router for True/False endpoints
def create_tf_router():
    """
    Create FastAPI router for True/False question generation endpoints
    
    Returns:
        FastAPI router with True/False endpoints
    """
    router = APIRouter(prefix="/api/v1/tf", tags=["True/False Generation"])
    
    @router.post("/generate", response_model=TFGenerationResponse)
    async def generate_tfs(request: TFGenerationRequest):
        """
        Generate True/False questions from content chunks
        
        Business Rules:
        - Questions must have clear true/false answers
        - No ambiguous statements allowed
        - Answers verified against source content when possible
        """
        try:
            service = get_tf_service()
            response = service.generator.generate_tfs_from_chunks(request)
            
            # Validate business rules
            if not service.validate_tf_response(response):
                raise HTTPException(
                    status_code=500,
                    detail="Generated True/False questions failed business rules validation"
                )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate True/False questions: {str(e)}"
            )
    
    @router.post("/generate-from-pdf")
    async def generate_tfs_from_pdf(
        pdf_content: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        topic: Optional[str] = None,
        verify_against_content: bool = True
    ):
        """
        Generate True/False questions from PDF content
        
        Args:
            pdf_content: Extracted text from PDF
            num_questions: Number of True/False questions to generate
            difficulty: Difficulty level (easy/medium/hard)
            topic: Optional topic for questions
            verify_against_content: Whether to verify answers against content
            
        Returns:
            TFGenerationResponse with generated questions
        """
        try:
            service = get_tf_service()
            response = service.generate_tfs_from_pdf_content(
                pdf_content=pdf_content,
                num_questions=num_questions,
                difficulty=difficulty,
                topic=topic,
                verify_against_content=verify_against_content
            )
            
            # Validate business rules
            if not service.validate_tf_response(response):
                raise HTTPException(
                    status_code=500,
                    detail="Generated True/False questions failed business rules validation"
                )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate True/False questions from PDF: {str(e)}"
            )
    
    @router.post("/save-to-quiz")
    async def save_tfs_to_quiz(
        user_id: int,
        tf_response: TFGenerationResponse,
        quiz_title: str,
        quiz_description: str,
        db: Session = Depends(get_db)
    ):
        """
        Save generated True/False questions to database as a quiz
        
        Args:
            user_id: User identifier
            tf_response: TFGenerationResponse with questions
            quiz_title: Title for the quiz
            quiz_description: Description for the quiz
            db: Database session
            
        Returns:
            Quiz ID if successful
        """
        try:
            service = get_tf_service()
            quiz_id = service.save_tfs_to_quiz(
                user_id=user_id,
                tf_response=tf_response,
                quiz_title=quiz_title,
                quiz_description=quiz_description,
                db=db
            )
            
            if quiz_id:
                return {
                    "status": "success",
                    "quiz_id": quiz_id,
                    "questions_saved": len(tf_response.questions)
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save quiz to database"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save True/False quiz: {str(e)}"
            )
    
    return router


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing True/False Service Integration")
    
    # Create service instance
    service = get_tf_service()
    
    # Test True/False generation from PDF content
    pdf_content = """
    Machine learning is a subset of artificial intelligence that enables systems to learn from data.
    Deep learning uses neural networks with multiple layers to extract features from data.
    Natural language processing deals with the interaction between computers and human language.
    Computer vision enables machines to interpret and understand visual information from the world.
    """
    
    response = service.generate_tfs_from_pdf_content(
        pdf_content=pdf_content,
        num_questions=3,
        difficulty="medium",
        topic="artificial intelligence",
        verify_against_content=True
    )
    
    print(f"\n📊 Generated {response.total_questions} True/False questions:")
    print(f"   Success: {response.success}")
    print(f"   Metadata: {response.metadata}")
    
    print(f"\n📝 Sample True/False Questions:")
    for i, tf in enumerate(response.questions, 1):
        print(f"\n{'='*50}")
        print(f"Question {i}:")
        print(service.generator.format_tf_for_display(tf))
    
    # Validate business rules
    print(f"\n✅ Business Rules Validation:")
    is_valid = service.validate_tf_response(response)
    print(f"   All True/False questions valid: {is_valid}")
    
    # Display validation results
    for i, tf in enumerate(response.questions, 1):
        try:
            service.generator._validate_tf_business_rules(tf)
            print(f"   Question {i}: ✅ Valid (clear statement, confidence: {tf.confidence_score:.2f})")
        except ValueError as e:
            print(f"   Question {i}: ❌ Invalid - {e}")