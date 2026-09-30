"""
Quiz Storage and Difficulty Categorization Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for quiz storage with PDF/user linking (Priority 30)
and difficulty categorization (Priority 31), implementing comprehensive quiz management with
secure database operations.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback
from datetime import datetime

from difficulty_categorizer import (
    DifficultyCategorizer,
    DifficultyCategorizationRequest,
    DifficultyCategorizationResponse,
    BatchDifficultyCategorizationRequest,
    BatchDifficultyCategorizationResponse,
    DifficultyCategory,
    CognitiveLevel,
    get_difficulty_categorizer
)

# Local imports to avoid circular dependencies
def get_models():
    """Import models locally to avoid circular imports"""
    try:
        from models import User, Quiz, Question, QuizAttempt, PDF
        return User, Quiz, Question, QuizAttempt, PDF
    except ImportError:
        return None, None, None, None, None

def get_db_dependency():
    """Import get_db locally to avoid circular imports"""
    try:
        from database import get_db
        return get_db
    except ImportError:
        return None


class QuizStorageService:
    """
    Service class for quiz storage with PDF/user linking (Priority 30)
    
    This class handles:
    - Saving generated quizzes with metadata
    - Linking quizzes to source PDFs
    - Linking quizzes to user accounts
    - Timestamp management
    - Secure database operations
    """
    
    def __init__(self):
        """Initialize Quiz Storage Service"""
        pass
    
    def store_quiz(
        self,
        user_id: int,
        quiz_title: str,
        quiz_description: str,
        questions: List[Dict[str, Any]],
        pdf_id: Optional[int] = None,
        category: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        db: Session = None
    ) -> Optional[int]:
        """
        Store a generated quiz with PDF and user linking
        
        Args:
            user_id: User identifier
            quiz_title: Title for the quiz
            quiz_description: Description for the quiz
            questions: List of question dictionaries
            pdf_id: Source PDF identifier (optional)
            category: Quiz category (optional)
            metadata: Quiz metadata (generation config, etc.)
            tags: Quiz tags for categorization
            db: Database session
            
        Returns:
            Quiz ID if successful, None otherwise
        """
        User, Quiz, Question, QuizAttempt, PDF = get_models()
        if not User:
            print("⚠️ Cannot store quiz: models not available")
            return None
        
        try:
            # Check if user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                print(f"⚠️ User {user_id} not found in database")
                return None
            
            # Verify PDF exists if provided
            if pdf_id:
                pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
                if not pdf:
                    print(f"⚠️ PDF {pdf_id} not found in database")
                    return None
            
            # Create quiz record with timestamps
            new_quiz = Quiz(
                title=quiz_title,
                description=quiz_description,
                category=category or "general",
                creator_id=user_id,
                pdf_id=pdf_id,
                total_questions=len(questions),
                quiz_metadata=metadata or {},
                tags=tags or [],
                is_active=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            db.add(new_quiz)
            db.commit()
            db.refresh(new_quiz)
            
            # Create question records with timestamps
            for i, question_data in enumerate(questions):
                # Ensure difficulty is set
                difficulty = question_data.get('difficulty', 'medium')
                if difficulty not in ['easy', 'medium', 'hard']:
                    difficulty = 'medium'
                
                new_question = Question(
                    quiz_id=new_quiz.id,
                    question_text=question_data.get('question_text', ''),
                    question_type=question_data.get('question_type', 'mcq'),
                    options=question_data.get('options', []),
                    correct_answer=question_data.get('correct_answer', ''),
                    difficulty=difficulty,
                    difficulty_score=question_data.get('difficulty_score', 0.5),
                    explanation=question_data.get('explanation'),
                    source_chunk_index=question_data.get('source_chunk_index', 0),
                    confidence_score=question_data.get('confidence_score', 0.8),
                    question_metadata=question_data.get('metadata', {}),
                    tags=question_data.get('tags', []),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(new_question)
            
            db.commit()
            
            print(f"✅ Stored quiz {new_quiz.id} to database with {len(questions)} questions")
            print(f"   Linked to user: {user_id}")
            print(f"   Linked to PDF: {pdf_id}")
            return new_quiz.id
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error storing quiz to database: {e}")
            traceback.print_exc()
            return None


class DifficultyCategorizationService:
    """
    Service class for difficulty categorization (Priority 31)
    
    This class handles:
    - Question difficulty analysis
    - Complexity and depth assessment
    - Difficulty categorization (Easy, Medium, Hard)
    - Integration with quiz storage
    """
    
    def __init__(self, categorizer: Optional[DifficultyCategorizer] = None):
        """
        Initialize Difficulty Categorization Service
        
        Args:
            categorizer: Optional DifficultyCategorizer instance
        """
        self.categorizer = categorizer or get_difficulty_categorizer()
    
    def categorize_quiz_questions(
        self,
        quiz_id: int,
        db: Session = None
    ) -> Optional[Dict[str, Any]]:
        """
        Categorize difficulty for all questions in a quiz
        
        Args:
            quiz_id: Quiz identifier
            db: Database session
            
        Returns:
            Dictionary with categorization results, None if not found
        """
        User, Quiz, Question, QuizAttempt, PDF = get_models()
        if not Question:
            print("⚠️ Cannot categorize quiz: models not available")
            return None
        
        try:
            # Get quiz questions
            questions = db.query(Question).filter(Question.quiz_id == quiz_id).all()
            if not questions:
                print(f"⚠️ No questions found for quiz {quiz_id}")
                return None
            
            # Categorize each question
            categorizations = []
            for question in questions:
                request = DifficultyCategorizationRequest(
                    question_text=question.question_text,
                    question_type=question.question_type,
                    options=question.options,
                    source_content=None,  # Could be stored in metadata
                    source_chunk_index=question.source_chunk_index,
                    topic=question.question_metadata.get('topic') if question.question_metadata else None
                )
                
                categorization = self.categorizer.categorize_difficulty(request)
                categorizations.append(categorization)
                
                # Update question in database
                question.difficulty = categorization.difficulty.value
                question.difficulty_score = categorization.difficulty_score
                question.question_metadata = question.question_metadata or {}
                question.question_metadata['cognitive_level'] = categorization.cognitive_level.value
                question.question_metadata['complexity_metrics'] = categorization.complexity_metrics
                question.updated_at = datetime.utcnow()
            
            db.commit()
            
            # Calculate statistics
            easy_count = sum(1 for c in categorizations if c.difficulty == DifficultyCategory.EASY)
            medium_count = sum(1 for c in categorizations if c.difficulty == DifficultyCategory.MEDIUM)
            hard_count = sum(1 for c in categorizations if c.difficulty == DifficultyCategory.HARD)
            total_difficulty = sum(c.difficulty_score for c in categorizations)
            average_difficulty = total_difficulty / len(categorizations) if categorizations else 0.0
            
            return {
                "quiz_id": quiz_id,
                "total_questions": len(categorizations),
                "easy_count": easy_count,
                "medium_count": medium_count,
                "hard_count": hard_count,
                "average_difficulty_score": average_difficulty,
                "categorizations": [
                    {
                        "question_id": questions[i].id,
                        "difficulty": c.difficulty.value,
                        "cognitive_level": c.cognitive_level.value,
                        "difficulty_score": c.difficulty_score,
                        "complexity_metrics": c.complexity_metrics
                    }
                    for i, c in enumerate(categorizations)
                ]
            }
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error categorizing quiz questions: {e}")
            traceback.print_exc()
            return None


# Singleton instances for application-wide use
_quiz_storage_service_instance = None
_difficulty_categorization_service_instance = None

def get_quiz_storage_service() -> QuizStorageService:
    """
    Get or create singleton Quiz Storage Service instance
    
    Returns:
        QuizStorageService instance
    """
    global _quiz_storage_service_instance
    
    if _quiz_storage_service_instance is None:
        _quiz_storage_service_instance = QuizStorageService()
    
    return _quiz_storage_service_instance

def get_difficulty_categorization_service() -> DifficultyCategorizationService:
    """
    Get or create singleton Difficulty Categorization Service instance
    
    Returns:
        DifficultyCategorizationService instance
    """
    global _difficulty_categorization_service_instance
    
    if _difficulty_categorization_service_instance is None:
        _difficulty_categorization_service_instance = DifficultyCategorizationService()
    
    return _difficulty_categorization_service_instance


# FastAPI router for quiz storage and difficulty categorization endpoints
def create_quiz_storage_router():
    """
    Create FastAPI router for quiz storage and difficulty categorization endpoints
    
    Returns:
        FastAPI router with quiz storage and difficulty categorization endpoints
    """
    router = APIRouter(prefix="/api/v1/quizzes", tags=["Quiz Storage & Difficulty"])
    
    get_db = get_db_dependency()
    
    @router.post("/store")
    async def store_quiz(
        payload: Dict[str, Any],
        db: Session = Depends(get_db)
    ):
        """
        Store a generated quiz with PDF and user linking (Priority 30)
        
        Business Rules:
        - Save generated quiz with metadata and timestamps
        - Link securely to source PDF
        - Link securely to user account
        - Maintain data integrity
        """
        try:
            service = get_quiz_storage_service()
            user_id = payload.get("user_id", 1)
            quiz_title = payload.get("quiz_title", "Untitled Quiz")
            quiz_description = payload.get("quiz_description", "")
            questions = payload.get("questions", [])
            pdf_id = payload.get("pdf_id")
            category = payload.get("category")
            metadata = payload.get("quiz_metadata") or payload.get("metadata")
            tags = payload.get("tags")

            quiz_id = service.store_quiz(
                user_id=int(user_id) if user_id else 1,
                quiz_title=quiz_title,
                quiz_description=quiz_description,
                questions=questions,
                pdf_id=int(pdf_id) if pdf_id else None,
                category=category,
                metadata=metadata,
                tags=tags,
                db=db
            )
            
            if quiz_id:
                return {
                    "status": "success",
                    "quiz_id": quiz_id,
                    "questions_saved": len(questions),
                    "linked_to_user": user_id,
                    "linked_to_pdf": pdf_id
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to store quiz to database"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store quiz: {str(e)}"
            )
    
    @router.post("/{quiz_id}/categorize-difficulty")
    async def categorize_quiz_difficulty(quiz_id: int, db: Session = Depends(get_db)):
        """
        Categorize difficulty for all questions in a quiz (Priority 31)
        
        Business Rules:
        - Analyze question complexity and depth
        - Categorize into Easy (basic recall), Medium (application), or Hard (analysis/synthesis)
        - Update database with categorization results
        """
        try:
            service = get_difficulty_categorization_service()
            result = service.categorize_quiz_questions(quiz_id, db)
            
            if result:
                return result
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Quiz {quiz_id} not found or has no questions"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to categorize quiz difficulty: {str(e)}"
            )
    
    return router