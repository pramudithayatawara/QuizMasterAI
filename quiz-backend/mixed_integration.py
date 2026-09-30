"""
Mixed Question Type Generator Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for the mixed question type generation service,
implementing Priority 25 requirements for generating balanced mixtures of MCQ and True/False
questions with strict business rules enforcement (at least 60% MCQs).
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback
from pydantic import BaseModel, Field

# Pydantic model for PDF generation request
class PDFGenerationRequest(BaseModel):
    """Request model for PDF-based question generation"""
    pdf_content: str = Field(..., description="Extracted text content from PDF")
    total_questions: int = Field(default=10, ge=5, le=50, description="Total number of questions to generate")
    mcq_percentage: float = Field(default=0.7, ge=0.6, le=1.0, description="Percentage of MCQ questions (0.6-1.0)")
    difficulty: str = Field(default="random", description="Difficulty level (easy/medium/hard/random/mixed)")
    topic: Optional[str] = Field(None, description="Optional topic for questions")
    enable_content_verification: bool = Field(default=True, description="Verify True/False answers against content")
from pydantic import BaseModel, Field

from mixed_generator import (
    MixedQuestionGenerator,
    MixedGenerationRequest,
    MixedGenerationResponse,
    MixedQuestion,
    QuizConfiguration,
    DifficultyLevel,
    get_mixed_generator
)

# Import existing generators
try:
    from mcq_generator import get_mcq_generator
    MCQ_AVAILABLE = True
except ImportError:
    MCQ_AVAILABLE = False
    print("⚠️ MCQ generator not available.")

try:
    from tf_generator import get_tf_generator
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠️ True/False generator not available.")

# Import your existing models
try:
    from models import User, Quiz, Question
    from database import get_db
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("⚠️ Database models not available. Install database integration.")


class MixedService:
    """
    Service class for mixed question type operations in the quiz system
    
    This class handles:
    - Mixed question generation from content chunks
    - Validation of business rules (at least 60% MCQs)
    - Database persistence
    - Integration with existing quiz system
    """
    
    def __init__(self, generator: Optional[MixedQuestionGenerator] = None):
        """
        Initialize Mixed Service
        
        Args:
            generator: Optional MixedQuestionGenerator instance
        """
        self.generator = generator or get_mixed_generator()
    
    def generate_mixed_from_pdf_content(
        self,
        pdf_content: str,
        total_questions: int = 10,
        mcq_percentage: float = 0.7,
        difficulty: str = "medium",
        topic: Optional[str] = None,
        enable_content_verification: bool = True
    ) -> MixedGenerationResponse:
        """
        Generate mixed question types from PDF content
        
        Args:
            pdf_content: Extracted text from PDF
            total_questions: Total number of questions to generate
            mcq_percentage: Percentage of MCQ questions (0.6 to 1.0)
            difficulty: Difficulty level (easy/medium/hard)
            topic: Optional topic for questions
            enable_content_verification: Whether to verify True/False answers against content
            
        Returns:
            MixedGenerationResponse with generated questions
        """
        # Split content into chunks
        chunk_size = 500
        words = pdf_content.split()
        chunks = []
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
        
        # Create configuration
        diff_str = (difficulty or "random").lower()
        try:
            difficulty_enum = DifficultyLevel(diff_str)
        except ValueError:
            difficulty_enum = DifficultyLevel.RANDOM
        configuration = QuizConfiguration(
            total_questions=total_questions,
            mcq_percentage=mcq_percentage,
            difficulty=difficulty_enum,
            topic=topic,
            enable_content_verification=enable_content_verification
        )
        
        # Create request
        request = MixedGenerationRequest(
            content_chunks=chunks,
            configuration=configuration
        )
        
        # Generate mixed questions
        return self.generator.generate_mixed_questions(request)
    
    def save_mixed_to_quiz(
        self,
        user_id: int,
        mixed_response: MixedGenerationResponse,
        quiz_title: str,
        quiz_description: str,
        db: Session
    ) -> Optional[int]:
        """
        Save generated mixed questions to database as a quiz
        
        Args:
            user_id: User identifier
            mixed_response: MixedGenerationResponse with questions
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
            first_difficulty = mixed_response.questions[0].difficulty.value if mixed_response.questions else "medium"
            new_quiz = QuizModel(
                title=quiz_title,
                description=quiz_description,
                category=mixed_response.metadata.get("topic", "general"),
                creator_id=user_id
            )
            
            db.add(new_quiz)
            db.commit()
            db.refresh(new_quiz)
            
            # Create question records
            for i, mixed_q in enumerate(mixed_response.questions):
                # Determine options based on question type
                if mixed_q.question_type.value == "multiple_choice":
                    options = mixed_q.options
                    correct_answer = mixed_q.correct_answer
                else:  # True/False
                    options = ["True", "False"]
                    correct_answer = mixed_q.correct_answer
                
                new_question = QuestionModel(
                    quiz_id=new_quiz.id,
                    question_text=mixed_q.question_text,
                    options=options,
                    correct_answer=correct_answer,
                    difficulty=mixed_q.difficulty.value
                )
                
                db.add(new_question)
            
            db.commit()
            
            print(f"✅ Saved mixed quiz {new_quiz.id} to database with {len(mixed_response.questions)} questions")
            print(f"   MCQ Count: {mixed_response.mcq_count}")
            print(f"   True/False Count: {mixed_response.tf_count}")
            print(f"   MCQ Percentage: {mixed_response.mcq_percentage:.2%}")
            return new_quiz.id
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error saving mixed quiz to database: {e}")
            traceback.print_exc()
            return None
    
    def validate_mixed_response(self, response: MixedGenerationResponse) -> bool:
        """
        Validate mixed response against business rules
        
        Args:
            response: MixedGenerationResponse to validate
            
        Returns:
            True if valid, False otherwise
        """
        return self.generator.validate_business_rules(response)


# Singleton instance for application-wide use
_mixed_service_instance = None

def get_mixed_service() -> MixedService:
    """
    Get or create singleton Mixed Service instance
    
    Returns:
        MixedService instance
    """
    global _mixed_service_instance
    
    if _mixed_service_instance is None:
        _mixed_service_instance = MixedService()
    
    return _mixed_service_instance


# FastAPI router for mixed question endpoints
def create_mixed_router():
    """
    Create FastAPI router for mixed question type generation endpoints
    
    Returns:
        FastAPI router with mixed question endpoints
    """
    router = APIRouter(prefix="/api/v1/mixed", tags=["Mixed Question Generation"])
    
    @router.post("/generate", response_model=MixedGenerationResponse)
    async def generate_mixed(request: MixedGenerationRequest):
        """
        Generate mixed question types from content chunks
        
        Business Rules:
        - Generate balanced mixture of MCQ and True/False questions
        - At least 60% of questions must be MCQs
        - Use AI models for generation
        """
        try:
            service = get_mixed_service()
            response = service.generator.generate_mixed_questions(request)
            
            # Validate business rules
            if not service.validate_mixed_response(response):
                raise HTTPException(
                    status_code=500,
                    detail="Generated mixed questions failed business rules validation"
                )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate mixed questions: {str(e)}"
            )
    
    @router.post("/generate-from-pdf")
    async def generate_mixed_from_pdf(request: PDFGenerationRequest):
        """
        Generate mixed question types from PDF content
        
        Args:
            request: PDFGenerationRequest with generation parameters
            
        Returns:
            MixedGenerationResponse with generated questions
        """
        try:
            service = get_mixed_service()
            response = service.generate_mixed_from_pdf_content(
                pdf_content=request.pdf_content,
                total_questions=request.total_questions,
                mcq_percentage=request.mcq_percentage,
                difficulty=request.difficulty,
                topic=request.topic,
                enable_content_verification=request.enable_content_verification
            )
            
            # Validate business rules
            if not service.validate_mixed_response(response):
                raise HTTPException(
                    status_code=500,
                    detail="Generated mixed questions failed business rules validation"
                )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate mixed questions from PDF: {str(e)}"
            )
    
    @router.post("/save-to-quiz")
    async def save_mixed_to_quiz(
        user_id: int,
        mixed_response: MixedGenerationResponse,
        quiz_title: str,
        quiz_description: str,
        db: Session = Depends(get_db)
    ):
        """
        Save generated mixed questions to database as a quiz
        
        Args:
            user_id: User identifier
            mixed_response: MixedGenerationResponse with questions
            quiz_title: Title for the quiz
            quiz_description: Description for the quiz
            db: Database session
            
        Returns:
            Quiz ID if successful
        """
        try:
            service = get_mixed_service()
            quiz_id = service.save_mixed_to_quiz(
                user_id=user_id,
                mixed_response=mixed_response,
                quiz_title=quiz_title,
                quiz_description=quiz_description,
                db=db
            )
            
            if quiz_id:
                return {
                    "status": "success",
                    "quiz_id": quiz_id,
                    "questions_saved": len(mixed_response.questions),
                    "mcq_count": mixed_response.mcq_count,
                    "tf_count": mixed_response.tf_count,
                    "mcq_percentage": mixed_response.mcq_percentage
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
                detail=f"Failed to save mixed quiz: {str(e)}"
            )
    
    return router


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Mixed Service Integration")
    
    # Create service instance
    service = get_mixed_service()
    
    # Test mixed generation from PDF content
    pdf_content = """
    Machine learning is a subset of artificial intelligence that enables systems to learn from data.
    Deep learning uses neural networks with multiple layers to extract features from data.
    Natural language processing deals with the interaction between computers and human language.
    Computer vision enables machines to interpret and understand visual information from the world.
    Reinforcement learning trains agents to make decisions through rewards and penalties.
    """
    
    response = service.generate_mixed_from_pdf_content(
        pdf_content=pdf_content,
        total_questions=10,
        mcq_percentage=0.7,  # 70% MCQs, 30% True/False
        difficulty="medium",
        topic="artificial intelligence",
        enable_content_verification=True
    )
    
    print(f"\n📊 Generated {response.total_questions} mixed questions:")
    print(f"   Success: {response.success}")
    print(f"   MCQ Count: {response.mcq_count}")
    print(f"   True/False Count: {response.tf_count}")
    print(f"   MCQ Percentage: {response.mcq_percentage:.2%}")
    print(f"   Distribution: {response.distribution}")
    print(f"   Metadata: {response.metadata}")
    
    print(f"\n📝 Sample Mixed Questions:")
    for i, question in enumerate(response.questions, 1):
        print(f"\n{'='*50}")
        print(f"Question {i}:")
        print(service.generator.format_mixed_for_display(question))
    
    # Validate business rules
    print(f"\n✅ Business Rules Validation:")
    is_valid = service.validate_mixed_response(response)
    print(f"   Mixed questions valid: {is_valid}")
    
    if is_valid:
        print(f"   ✅ MCQ percentage meets 60% minimum requirement")
        print(f"   ✅ Questions generated successfully")
    else:
        print(f"   ❌ Business rules violated")