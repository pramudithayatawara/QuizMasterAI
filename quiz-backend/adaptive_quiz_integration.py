"""
Adaptive Quiz Integration Module for QuizMaster AI Backend

This module provides integration between the adaptive quiz generator and the existing
FastAPI backend system. It handles Priority 22 requirements for generating adaptive
quizzes based on user performance history.
"""

from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from adaptive_quiz_generator import (
    AdaptiveQuizGenerator,
    AdaptiveQuizRequest,
    AdaptiveQuiz,
    GeneratedQuestion,
    DifficultyLevel,
    QuestionType,
    UserPerformance,
    get_adaptive_generator
)

# Import your existing models with aliases to avoid naming conflicts
try:
    from models import User as UserModel, Quiz as QuizModel, Question as QuestionModel, QuizAttempt as QuizAttemptModel
    from database import get_db
    MODELS_AVAILABLE = True
except ImportError:
    MODELS_AVAILABLE = False
    print("⚠️ Database models not available. Install database integration.")


class AdaptiveQuizManager:
    """
    Manager class for adaptive quiz operations in the quiz system
    
    This class handles:
    - User performance analysis from database
    - Adaptive quiz generation with RAG content
    - Difficulty adjustment based on performance
    - Quiz persistence to database
    """
    
    def __init__(self, generator: Optional[AdaptiveQuizGenerator] = None):
        """
        Initialize Adaptive Quiz Manager
        
        Args:
            generator: Optional AdaptiveQuizGenerator instance
        """
        self.generator = generator or get_adaptive_generator()
    
    def get_user_performance_from_db(
        self,
        user_id: int,
        db: Session
    ) -> Dict:
        """
        Retrieve user performance history from database
        
        Args:
            user_id: User identifier
            db: Database session
            
        Returns:
            Dictionary with performance data
        """
        if not MODELS_AVAILABLE:
            return self._get_mock_performance(user_id)
        
        try:
            # Get user's quiz attempts
            attempts = db.query(QuizAttemptModel).filter(
                QuizAttemptModel.user_id == user_id
            ).all()
            
            if not attempts:
                return self._get_initial_performance(user_id)
            
            # Calculate performance metrics
            scores = [attempt.score for attempt in attempts if attempt.score is not None]
            completion_times = [
                (attempt.completed_at - attempt.started_at).total_seconds()
                for attempt in attempts
                if attempt.completed_at and attempt.started_at
            ]
            
            # Count questions by difficulty
            difficulty_distribution = {'easy': 0, 'medium': 0, 'hard': 0}
            for attempt in attempts:
                quiz = db.query(QuizModel).filter(QuizModel.id == attempt.quiz_id).first()
                if quiz:
                    # Since Quiz model doesn't have difficulty field, skip this for now
                    pass
            
            # Calculate topic performance (simplified)
            topic_performance = {}
            for attempt in attempts:
                quiz = db.query(QuizModel).filter(QuizModel.id == attempt.quiz_id).first()
                if quiz and quiz.category:  # Use category instead of topic
                    if quiz.category not in topic_performance:
                        topic_performance[quiz.category] = []
                    topic_performance[quiz.category].append(attempt.score if attempt.score else 0)
            
            # Average topic scores
            topic_performance_avg = {
                topic: sum(scores) / len(scores)
                for topic, scores in topic_performance.items()
            }
            
            # Get last quiz date
            last_quiz = max(attempts, key=lambda x: x.completed_at) if attempts else None
            last_quiz_date = last_quiz.completed_at.isoformat() if last_quiz and last_quiz.completed_at else None
            
            return {
                'total_quizzes_completed': len(attempts),
                'scores': scores,
                'completion_times': completion_times,
                'difficulty_distribution': difficulty_distribution,
                'topic_performance': topic_performance_avg,
                'last_quiz_date': last_quiz_date
            }
            
        except Exception as e:
            print(f"❌ Error fetching user performance: {e}")
            return self._get_initial_performance(user_id)
    
    def _get_initial_performance(self, user_id: int) -> Dict:
        """Get initial performance for new users"""
        return {
            'total_quizzes_completed': 0,
            'scores': [],
            'completion_times': [],
            'difficulty_distribution': {'easy': 0, 'medium': 0, 'hard': 0},
            'topic_performance': {},
            'last_quiz_date': None
        }
    
    def _get_mock_performance(self, user_id: int) -> Dict:
        """Get mock performance for testing without database"""
        return {
            'total_quizzes_completed': 3,
            'scores': [75, 80, 85],
            'completion_times': [300, 280, 290],
            'difficulty_distribution': {'easy': 5, 'medium': 15, 'hard': 5},
            'topic_performance': {
                'python': 80,
                'machine learning': 75,
                'data structures': 70
            },
            'last_quiz_date': datetime.now().isoformat()
        }
    
    def generate_adaptive_quiz_for_user(
        self,
        user_id: int,
        quiz_topic: str,
        retrieved_content: List[str],
        target_difficulty: Optional[str] = None,
        num_questions: int = 10,
        db: Optional[Session] = None
    ) -> AdaptiveQuiz:
        """
        Generate adaptive quiz for a specific user
        
        Args:
            user_id: User identifier
            quiz_topic: Quiz topic
            retrieved_content: Content from RAG service
            target_difficulty: Optional target difficulty override
            num_questions: Number of questions (minimum 10 enforced)
            db: Optional database session
            
        Returns:
            AdaptiveQuiz object
        """
        # Get user performance
        if db:
            performance_history = self.get_user_performance_from_db(user_id, db)
        else:
            performance_history = self._get_mock_performance(user_id)
        
        # Analyze performance
        user_performance = self.generator.analyze_user_performance(
            user_id,
            performance_history
        )
        
        # Convert target difficulty if provided
        target_diff_enum = None
        if target_difficulty:
            try:
                target_diff_enum = DifficultyLevel(target_difficulty.lower())
            except ValueError:
                print(f"⚠️ Invalid difficulty: {target_difficulty}")
        
        # Create quiz generation request
        request = AdaptiveQuizRequest(
            user_id=user_id,
            topic=quiz_topic,
            retrieved_content=retrieved_content,
            target_difficulty=target_diff_enum,
            num_questions=num_questions
        )
        
        # Generate adaptive quiz
        quiz = self.generator.generate_adaptive_quiz(request, user_performance)
        
        return quiz
    
    def save_adaptive_quiz_to_db(
        self,
        quiz: AdaptiveQuiz,
        db: Session
    ) -> int:
        """
        Save generated adaptive quiz to database
        
        Args:
            quiz: AdaptiveQuiz object (from adaptive_quiz_generator module)
            db: Database session
            
        Returns:
            Quiz ID
        """
        if not MODELS_AVAILABLE:
            print("⚠️ Cannot save to database: models not available")
            return None
        
        try:
            # Import models here to avoid naming conflicts
            from models import User as UserModel, Quiz as QuizModel, Question as QuestionModel
            
            # Check if user exists
            user = db.query(UserModel).filter(UserModel.id == quiz.user_id).first()
            if not user:
                print(f"⚠️ User {quiz.user_id} not found in database")
                # For testing, create a dummy user if needed
                user = UserModel(
                    username=f"user_{quiz.user_id}",
                    email=f"user_{quiz.user_id}@example.com",
                    hashed_password="dummy"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            
            # Create quiz record with existing schema
            new_quiz = QuizModel(
                title=quiz.title,
                description=quiz.description,
                category=quiz.topic,  # Use category field for topic
                creator_id=quiz.user_id,  # Use creator_id for user_id
            )
            
            db.add(new_quiz)
            db.commit()
            db.refresh(new_quiz)
            
            # Create question records
            for i, question in enumerate(quiz.questions):
                new_question = QuestionModel(
                    quiz_id=new_quiz.id,
                    question_text=question.question,
                    options=question.options,
                    correct_answer=question.correct_answer,
                    difficulty=question.difficulty.value,
                )
                
                db.add(new_question)
            
            db.commit()
            
            print(f"✅ Saved adaptive quiz {new_quiz.id} to database")
            return new_quiz.id
            
        except Exception as e:
            db.rollback()
            print(f"❌ Error saving quiz to database: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def adjust_quiz_difficulty_during_attempt(
        self,
        quiz_id: int,
        user_id: int,
        recent_answers: List[bool],
        db: Session
    ) -> Optional[DifficultyLevel]:
        """
        Adjust difficulty dynamically during quiz attempt
        
        Args:
            quiz_id: Quiz identifier
            user_id: User identifier
            recent_answers: List of recent correct/incorrect answers
            db: Database session
            
        Returns:
            New difficulty level or None if no adjustment needed
        """
        try:
            # Get current quiz
            quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                return None
            
            current_difficulty = DifficultyLevel(quiz.difficulty)
            
            # Adjust based on recent answers
            new_difficulty = self.generator.adjust_difficulty_during_quiz(
                current_difficulty,
                recent_answers
            )
            
            if new_difficulty != current_difficulty:
                # Update quiz difficulty in database
                quiz.difficulty = new_difficulty.value
                db.commit()
                print(f"🎯 Adjusted quiz {quiz_id} difficulty to {new_difficulty.value}")
                return new_difficulty
            
            return None
            
        except Exception as e:
            print(f"❌ Error adjusting difficulty: {e}")
            return None


# Singleton instance for application-wide use
_adaptive_manager_instance = None

def get_adaptive_manager() -> AdaptiveQuizManager:
    """
    Get or create singleton Adaptive Quiz Manager instance
    
    Returns:
        AdaptiveQuizManager instance
    """
    global _adaptive_manager_instance
    
    if _adaptive_manager_instance is None:
        _adaptive_manager_instance = AdaptiveQuizManager()
    
    return _adaptive_manager_instance


# FastAPI endpoint integration
def create_adaptive_quiz_endpoint():
    """
    Example FastAPI endpoint for adaptive quiz generation
    
    This shows how to integrate the adaptive quiz generator with FastAPI
    """
    from fastapi import APIRouter, Depends, HTTPException
    from pydantic import BaseModel
    
    router = APIRouter()
    
    class AdaptiveQuizRequestModel(BaseModel):
        user_id: int
        topic: str
        pdf_id: Optional[int] = None
        target_difficulty: Optional[str] = None
        num_questions: int = 10
    
    @router.post("/api/v1/quizzes/adaptive/generate")
    async def generate_adaptive_quiz(
        request: AdaptiveQuizRequestModel,
        db: Session = Depends(get_db)
    ):
        """
        Generate adaptive quiz based on user performance
        
        This endpoint:
        1. Retrieves user performance history
        2. Determines appropriate difficulty
        3. Generates questions from content
        4. Saves quiz to database
        """
        try:
            # Get RAG content (integrate with your RAG service)
            # For now, use placeholder content
            retrieved_content = [
                "Sample content for adaptive quiz generation",
                "This would come from your RAG service"
            ]
            
            # Generate adaptive quiz
            manager = get_adaptive_manager()
            quiz = manager.generate_adaptive_quiz_for_user(
                user_id=request.user_id,
                topic=request.topic,
                retrieved_content=retrieved_content,
                target_difficulty=request.target_difficulty,
                num_questions=request.num_questions,
                db=db
            )
            
            # Save to database
            quiz_id = manager.save_adaptive_quiz_to_db(quiz, db)
            
            if quiz_id:
                return {
                    "status": "success",
                    "quiz_id": quiz_id,
                    "title": quiz.title,
                    "difficulty": quiz.difficulty.value,
                    "num_questions": len(quiz.questions),
                    "time_limit": quiz.time_limit
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save quiz to database"
                )
                
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate adaptive quiz: {str(e)}"
            )
    
    return router


if __name__ == "__main__":
    # Test the integration
    print("🧪 Testing Adaptive Quiz Manager Integration")
    
    manager = get_adaptive_manager()
    
    # Test adaptive quiz generation
    quiz = manager.generate_adaptive_quiz_for_user(
        user_id=1,
        topic="python programming",
        retrieved_content=[
            "Python is a high-level programming language",
            "Lists and dictionaries are key data structures",
            "Functions allow code reuse and modularity",
            "Classes enable object-oriented programming",
            "Error handling makes code robust"
        ],
        num_questions=10
    )
    
    print(f"📝 Generated Adaptive Quiz: {quiz.title}")
    print(f"   Difficulty: {quiz.difficulty.value}")
    print(f"   Questions: {len(quiz.questions)}")
    print(f"   Adaptive: {quiz.metadata.get('adaptive')}")
    
    # Test difficulty adjustment
    current_difficulty = DifficultyLevel.MEDIUM
    recent_answers = [True, True, True]  # 3 consecutive correct
    
    new_difficulty = manager.generator.adjust_difficulty_during_quiz(
        current_difficulty,
        recent_answers
    )
    
    print(f"\n🎯 Difficulty Adjustment:")
    print(f"   Current: {current_difficulty.value}")
    print(f"   Recent Answers: {recent_answers}")
    print(f"   New: {new_difficulty.value}")