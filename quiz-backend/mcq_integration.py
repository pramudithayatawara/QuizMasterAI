"""
MCQ Generator Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for the MCQ generation service,
implementing Priority 23 requirements for generating Multiple Choice Questions
from content chunks with strict business rules enforcement.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback

from mcq_generator import (
    MCQGenerator,
    MCQGenerationRequest,
    MCQGenerationResponse,
    MCQQuestion,
    DifficultyLevel,
    get_mcq_generator
)

# Import your existing models
try:
    from models import User, Quiz, Question
    from database import get_db
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("⚠️ Database models not available. Install database integration.")


class MCQService:
    """
    Service class for MCQ operations in the quiz system
    
    This class handles:
    - MCQ generation from content chunks
    - Validation of business rules
    - Database persistence
    - Integration with existing quiz system
    """
    
    def __init__(self, generator: Optional[MCQGenerator] = None):
        """
        Initialize MCQ Service
        
        Args:
            generator: Optional MCQGenerator instance
        """
        self.generator = generator or get_mcq_generator()
    
    def generate_mcqs_from_pdf_content(
        self,
        pdf_content: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        topic: Optional[str] = None
    ) -> MCQGenerationResponse:
        """
        Generate MCQs from PDF content
        
        Args:
            pdf_content: Extracted text from PDF
            num_questions: Number of MCQs to generate
            difficulty: Difficulty level (easy/medium/hard)
            topic: Optional topic for questions
            
        Returns:
            MCQGenerationResponse with generated questions
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
        request = MCQGenerationRequest(
            content_chunks=chunks,
            num_questions=num_questions,
            difficulty=difficulty_enum,
            topic=topic
        )
        
        # Generate MCQs
        return self.generator.generate_mcqs_from_chunks(request)
    
    def save_mcqs_to_quiz(
        self,
        user_id: int,
        mcq_response: MCQGenerationResponse,
        quiz_title: str,
        quiz_description: str,
        db: Session
    ) -> Optional[int]:
        """
        Save generated MCQs to database as a quiz
        
        Args:
            user_id: User identifier
            mcq_response: MCQGenerationResponse with questions
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
            first_difficulty = mcq_response.questions[0].difficulty.value if mcq_response.questions else "medium"
            new_quiz = QuizModel(
                title=quiz_title,
                description=quiz_description,
                category=mcq_response.metadata.get("topic", "general"),
                creator_id=user_id
            )
            
            db.add(new_quiz)
            db.commit()
            db.refresh(new_quiz)
            
            # Create question records
            for i, mcq in enumerate(mcq_response.questions):
                # Extract option texts for JSON storage
                option_texts = [opt.option_text for opt in mcq.options]
                
                new_question = QuestionModel(
                    quiz_id=new_quiz.id,
                    question_text=mcq.question_text,
                    options=option_texts,
                    correct_answer=mcq.correct_answer,
                    difficulty=mcq.difficulty.value
                )
                
                db.add(new_question)
            
            db.commit()
            
            print(f"✅ Saved MCQ quiz {new_quiz.id} to database with {len(mcq_response.questions)} questions")
            return new_quiz.id
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error saving MCQ quiz to database: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def validate_mcq_response(self, response: MCQGenerationResponse) -> bool:
        """
        Validate MCQ response against business rules
        
        Args:
            response: MCQGenerationResponse to validate
            
        Returns:
            True if valid, False otherwise
        """
        try:
            for mcq in response.questions:
                self.generator._validate_mcq_business_rules(mcq)
            return True
        except ValueError as e:
            print(f"❌ MCQ validation failed: {e}")
            return False


# Singleton instance for application-wide use
_mcq_service_instance = None

def get_mcq_service() -> MCQService:
    """
    Get or create singleton MCQ Service instance
    
    Returns:
        MCQService instance
    """
    global _mcq_service_instance
    
    if _mcq_service_instance is None:
        _mcq_service_instance = MCQService()
    
    return _mcq_service_instance


# FastAPI router for MCQ endpoints
def create_mcq_router():
    """
    Create FastAPI router for MCQ generation endpoints
    
    Returns:
        FastAPI router with MCQ endpoints
    """
    router = APIRouter(prefix="/api/v1/mcq", tags=["MCQ Generation"])
    
    @router.post("/generate", response_model=MCQGenerationResponse)
    async def generate_mcqs(request: MCQGenerationRequest):
        """
        Generate Multiple Choice Questions from content chunks
        
        Business Rules:
        - Each question must have exactly 4 options
        - Only one correct answer per question
        - Questions generated from provided content chunks
        """
        try:
            service = get_mcq_service()
            response = service.generator.generate_mcqs_from_chunks(request)
            
            # Validate business rules
            if not service.validate_mcq_response(response):
                raise HTTPException(
                    status_code=500,
                    detail="Generated MCQs failed business rules validation"
                )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate MCQs: {str(e)}"
            )
    
    @router.post("/generate-from-pdf")
    async def generate_mcqs_from_pdf(
        pdf_content: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        topic: Optional[str] = None
    ):
        """
        Generate MCQs from PDF content
        
        Args:
            pdf_content: Extracted text from PDF
            num_questions: Number of MCQs to generate
            difficulty: Difficulty level (easy/medium/hard)
            topic: Optional topic for questions
            
        Returns:
            MCQGenerationResponse with generated questions
        """
        try:
            service = get_mcq_service()
            response = service.generate_mcqs_from_pdf_content(
                pdf_content=pdf_content,
                num_questions=num_questions,
                difficulty=difficulty,
                topic=topic
            )
            
            # Validate business rules
            if not service.validate_mcq_response(response):
                raise HTTPException(
                    status_code=500,
                    detail="Generated MCQs failed business rules validation"
                )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate MCQs from PDF: {str(e)}"
            )
    
    @router.post("/save-to-quiz")
    async def save_mcqs_to_quiz(
        user_id: int,
        mcq_response: MCQGenerationResponse,
        quiz_title: str,
        quiz_description: str,
        db: Session = Depends(get_db)
    ):
        """
        Save generated MCQs to database as a quiz
        
        Args:
            user_id: User identifier
            mcq_response: MCQGenerationResponse with questions
            quiz_title: Title for the quiz
            quiz_description: Description for the quiz
            db: Database session
            
        Returns:
            Quiz ID if successful
        """
        try:
            service = get_mcq_service()
            quiz_id = service.save_mcqs_to_quiz(
                user_id=user_id,
                mcq_response=mcq_response,
                quiz_title=quiz_title,
                quiz_description=quiz_description,
                db=db
            )
            
            if quiz_id:
                return {
                    "status": "success",
                    "quiz_id": quiz_id,
                    "questions_saved": len(mcq_response.questions)
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
                detail=f"Failed to save MCQ quiz: {str(e)}"
            )
    
    return router


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing MCQ Service Integration")
    
    # Create service instance
    service = get_mcq_service()
    
    # Test MCQ generation from PDF content
    pdf_content = """
    Machine learning is a subset of artificial intelligence that enables systems to learn from data.
    Deep learning uses neural networks with multiple layers to extract features from data.
    Natural language processing deals with the interaction between computers and human language.
    Computer vision enables machines to interpret and understand visual information from the world.
    """
    
    response = service.generate_mcqs_from_pdf_content(
        pdf_content=pdf_content,
        num_questions=3,
        difficulty="medium",
        topic="artificial intelligence"
    )
    
    print(f"\n📊 Generated {response.total_questions} MCQs:")
    print(f"   Success: {response.success}")
    print(f"   Metadata: {response.metadata}")
    
    print(f"\n📝 Sample MCQs:")
    for i, mcq in enumerate(response.questions, 1):
        print(f"\n{'='*50}")
        print(f"Question {i}:")
        print(service.generator.format_mcq_for_display(mcq))
    
    # Validate business rules
    print(f"\n✅ Business Rules Validation:")
    is_valid = service.validate_mcq_response(response)
    print(f"   All MCQs valid: {is_valid}")
    
    # Display validation results
    for i, mcq in enumerate(response.questions, 1):
        try:
            service.generator._validate_mcq_business_rules(mcq)
            print(f"   Question {i}: ✅ Valid (4 options, 1 correct answer)")
        except ValueError as e:
            print(f"   Question {i}: ❌ Invalid - {e}")