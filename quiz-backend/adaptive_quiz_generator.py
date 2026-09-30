"""
Priority 22: Generate Adaptive Quiz Service Module

This module implements adaptive quiz generation that adjusts difficulty based on
user performance history while ensuring minimum question requirements.

Features:
- AI-powered question generation using fine-tuned model
- Difficulty adaptation based on user performance
- Minimum 10 questions per quiz enforcement
- Content-aware generation from retrieved RAG content
- Performance history analysis
"""

import os
import random
import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import numpy as np
from datetime import datetime, timedelta

try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("⚠️ Transformers not available. Install with: pip install transformers torch")


class DifficultyLevel(Enum):
    """Difficulty levels for adaptive quiz generation"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class QuestionType(Enum):
    """Types of questions that can be generated"""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    FILL_BLANK = "fill_blank"


@dataclass
class UserPerformance:
    """Model for user performance history"""
    user_id: int
    total_quizzes_completed: int
    average_score: float
    average_time_per_question: float
    difficulty_distribution: Dict[str, int]  # easy/medium/hard counts
    recent_scores: List[float]  # Last 10 quiz scores
    strong_topics: List[str]
    weak_topics: List[str]
    last_quiz_date: Optional[datetime]


@dataclass
class AdaptiveQuizRequest:
    """Request model for adaptive quiz generation"""
    user_id: int
    topic: str
    retrieved_content: List[str]  # Content from RAG service
    target_difficulty: Optional[DifficultyLevel] = None
    num_questions: int = 10
    question_types: List[QuestionType] = None
    time_limit: Optional[int] = None  # minutes


@dataclass
class GeneratedQuestion:
    """Model for generated quiz question"""
    question: str
    options: List[str]  # For multiple choice
    correct_answer: str
    difficulty: DifficultyLevel
    question_type: QuestionType
    topic: str
    context: str
    estimated_time: int  # seconds
    explanation: Optional[str] = None


@dataclass
class AdaptiveQuiz:
    """Model for complete adaptive quiz"""
    quiz_id: Optional[int]
    user_id: int
    title: str
    description: str
    questions: List[GeneratedQuestion]
    difficulty: DifficultyLevel
    topic: str
    time_limit: int  # minutes
    created_at: datetime
    metadata: Dict


class AdaptiveQuizGenerator:
    """
    Adaptive Quiz Generator Service
    
    Business Rules:
    1. Difficulty must adapt to user level based on performance history
    2. Minimum 10 questions per quiz
    3. Questions generated from retrieved RAG content
    4. AI model used for question generation
    """
    
    MIN_QUESTIONS = 10
    DEFAULT_TIME_LIMIT = 20  # minutes
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize Adaptive Quiz Generator
        
        Args:
            model_path: Path to fine-tuned model
            tokenizer_path: Path to tokenizer (defaults to model_path)
        """
        candidate_paths = [
            model_path,
            os.path.abspath(model_path),
            os.path.join(os.path.dirname(__file__), "fine_tuned_quiz_model"),
            os.path.abspath(os.path.join(os.getcwd(), "quiz-backend", "fine_tuned_quiz_model")),
            os.path.abspath(os.path.join(os.getcwd(), "fine_tuned_quiz_model")),
        ]
        resolved_path = None
        for cp in candidate_paths:
            if os.path.exists(cp):
                resolved_path = os.path.abspath(cp)
                break
        
        self.model_path = resolved_path or model_path
        self.tokenizer_path = tokenizer_path or self.model_path
        
        if TRANSFORMERS_AVAILABLE and os.path.exists(self.model_path):
            print(f"🤖 Loading adaptive quiz model from {self.model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ Adaptive quiz model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None
    
    def analyze_user_performance(
        self,
        user_id: int,
        performance_history: Dict
    ) -> UserPerformance:
        """
        Analyze user performance history to determine skill level
        
        Args:
            user_id: User identifier
            performance_history: Dictionary with performance data
            
        Returns:
            UserPerformance object with analyzed data
        """
        # Extract performance data
        total_quizzes = performance_history.get('total_quizzes_completed', 0)
        scores = performance_history.get('scores', [])
        times = performance_history.get('completion_times', [])
        difficulty_dist = performance_history.get('difficulty_distribution', {})
        
        # Calculate average score
        avg_score = np.mean(scores) if scores else 0.0
        
        # Calculate average time per question
        avg_time = np.mean(times) if times else 0.0
        
        # Get recent scores (last 10)
        recent_scores = scores[-10:] if len(scores) > 10 else scores
        
        # Determine strong and weak topics
        topic_performance = performance_history.get('topic_performance', {})
        strong_topics = [
            topic for topic, score in topic_performance.items() 
            if score >= 80
        ]
        weak_topics = [
            topic for topic, score in topic_performance.items() 
            if score < 60
        ]
        
        # Get last quiz date
        last_quiz_str = performance_history.get('last_quiz_date')
        last_quiz_date = datetime.fromisoformat(last_quiz_str) if last_quiz_str else None
        
        return UserPerformance(
            user_id=user_id,
            total_quizzes_completed=total_quizzes,
            average_score=avg_score,
            average_time_per_question=avg_time,
            difficulty_distribution=difficulty_dist,
            recent_scores=recent_scores,
            strong_topics=strong_topics,
            weak_topics=weak_topics,
            last_quiz_date=last_quiz_date
        )
    
    def determine_adaptive_difficulty(
        self,
        user_performance: UserPerformance,
        target_difficulty: Optional[DifficultyLevel] = None
    ) -> DifficultyLevel:
        """
        Determine appropriate difficulty based on user performance
        
        Business Rule: Difficulty must adapt to user level
        
        Args:
            user_performance: User's performance history
            target_difficulty: Optional target difficulty override
            
        Returns:
            Recommended difficulty level
        """
        # If target difficulty is specified, use it
        if target_difficulty:
            return target_difficulty
        
        # If user has no history, start with medium
        if user_performance.total_quizzes_completed == 0:
            return DifficultyLevel.MEDIUM
        
        # Analyze recent performance
        recent_avg = np.mean(user_performance.recent_scores) if user_performance.recent_scores else 0
        
        # Difficulty adaptation logic
        if recent_avg >= 85:
            # High performer - challenge with hard questions
            return DifficultyLevel.HARD
        elif recent_avg >= 70:
            # Good performer - maintain medium difficulty
            return DifficultyLevel.MEDIUM
        elif recent_avg >= 50:
            # Average performer - mix of easy and medium
            return DifficultyLevel.MEDIUM
        else:
            # Struggling - use easy questions to build confidence
            return DifficultyLevel.EASY
    
    def generate_question_from_content(
        self,
        content: str,
        difficulty: DifficultyLevel,
        question_type: QuestionType = QuestionType.MULTIPLE_CHOICE,
        topic: str = "general"
    ) -> GeneratedQuestion:
        """
        Generate a single question from content using AI model
        
        Args:
            content: Content text to generate question from
            difficulty: Difficulty level for the question
            question_type: Type of question to generate
            topic: Topic of the question
            
        Returns:
            GeneratedQuestion object
        """
        if not TRANSFORMERS_AVAILABLE or self.model is None:
            return self._generate_fallback_question(content, difficulty, topic)
        
        try:
            # Format input based on difficulty and question type
            difficulty_prompt = {
                DifficultyLevel.EASY: "basic",
                DifficultyLevel.MEDIUM: "intermediate",
                DifficultyLevel.HARD: "advanced"
            }
            
            type_prompt = {
                QuestionType.MULTIPLE_CHOICE: "multiple choice",
                QuestionType.TRUE_FALSE: "true or false",
                QuestionType.SHORT_ANSWER: "short answer",
                QuestionType.FILL_BLANK: "fill in the blank"
            }
            
            input_text = (
                f"Generate a {difficulty_prompt[difficulty]} {type_prompt[question_type]} "
                f"question about {topic}: {content[:500]}"
            )
            
            # Tokenize and generate
            inputs = self.tokenizer(
                input_text,
                return_tensors="pt",
                max_length=512,
                truncation=True
            )
            
            outputs = self.model.generate(
                inputs["input_ids"],
                max_length=150,
                num_beams=4,
                no_repeat_ngram_size=2,
                early_stopping=True,
                temperature=0.7,
                do_sample=True
            )
            
            generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Parse generated text into question components
            question_components = self._parse_generated_question(
                generated_text,
                difficulty,
                question_type,
                topic,
                content
            )
            
            return question_components
            
        except Exception as e:
            print(f"⚠️ Error generating question: {e}")
            return self._generate_fallback_question(content, difficulty, topic)
    
    def _parse_generated_question(
        self,
        generated_text: str,
        difficulty: DifficultyLevel,
        question_type: QuestionType,
        topic: str,
        context: str
    ) -> GeneratedQuestion:
        """
        Parse generated text into structured question components
        
        Args:
            generated_text: Raw text from AI model
            difficulty: Difficulty level
            question_type: Type of question
            topic: Question topic
            context: Original content context
            
        Returns:
            GeneratedQuestion object
        """
        # Simple parsing - in production, use more sophisticated parsing
        lines = generated_text.strip().split('\n')
        
        # Extract question (first non-empty line)
        question = lines[0] if lines else "What is the main concept?"
        if not question.endswith('?'):
            question += '?'
        
        # Generate realistic options from context
        if question_type == QuestionType.MULTIPLE_CHOICE:
            candidates = []
            for m in re.findall(r'([A-Z][a-zA-Z0-9_\-\s]{2,30}?)\s+(?:is|are|was|were|refers to|means)', context):
                c = m.strip().rstrip('.,;:')
                if len(c) > 2 and c not in candidates:
                    candidates.append(c)
            for m in re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', context):
                c = m.strip()
                if len(c) > 3 and c not in candidates:
                    candidates.append(c)
            
            correct_answer = candidates[0] if candidates else (topic.title() if topic else "Key Concept")
            distractors = [c for c in candidates if c.lower() != correct_answer.lower()]
            fallbacks = ["Primary Mechanism", "Secondary Factor", "Alternative Variable", "Environmental Cause"]
            for fb in fallbacks:
                if len(distractors) >= 3:
                    break
                if fb not in distractors and fb.lower() != correct_answer.lower():
                    distractors.append(fb)
            
            options = [correct_answer] + distractors[:3]
            random.shuffle(options)
        elif question_type == QuestionType.TRUE_FALSE:
            options = ["True", "False"]
            correct_answer = "True"
        else:
            options = []
            correct_answer = "Short answer"
        
        # Estimate time based on difficulty
        time_estimates = {
            DifficultyLevel.EASY: 30,
            DifficultyLevel.MEDIUM: 45,
            DifficultyLevel.HARD: 60
        }
        
        return GeneratedQuestion(
            question=question,
            options=options,
            correct_answer=correct_answer,
            difficulty=difficulty,
            question_type=question_type,
            topic=topic,
            context=context[:200],
            estimated_time=time_estimates[difficulty],
            explanation="Generated from course content"
        )
    
    def _generate_fallback_question(
        self,
        content: str,
        difficulty: DifficultyLevel,
        topic: str
    ) -> GeneratedQuestion:
        """
        Generate fallback question when AI model is unavailable
        
        Args:
            content: Content text
            difficulty: Difficulty level
            topic: Question topic
            
        Returns:
            GeneratedQuestion object
        """
        # Extract first sentence as question
        sentences = content.split('.')
        question = sentences[0] if sentences else f"What is the main concept in {topic}?"
        
        return GeneratedQuestion(
            question=f"{question.strip()}?",
            options=["A", "B", "C", "D"],
            correct_answer="A",
            difficulty=difficulty,
            question_type=QuestionType.MULTIPLE_CHOICE,
            topic=topic,
            context=content[:200],
            estimated_time=30,
            explanation="Fallback question generated"
        )
    
    def generate_adaptive_quiz(
        self,
        request: AdaptiveQuizRequest,
        user_performance: UserPerformance
    ) -> AdaptiveQuiz:
        """
        Generate complete adaptive quiz based on user performance
        
        Business Rules:
        1. Difficulty adapts to user level
        2. Minimum 10 questions per quiz
        
        Args:
            request: Quiz generation request
            user_performance: User's performance history
            
        Returns:
            Complete AdaptiveQuiz object
        """
        # Ensure minimum question count
        num_questions = max(request.num_questions, self.MIN_QUESTIONS)
        
        # Determine adaptive difficulty
        adaptive_difficulty = self.determine_adaptive_difficulty(
            user_performance,
            request.target_difficulty
        )
        
        # Determine question types (default to multiple choice)
        question_types = request.question_types or [QuestionType.MULTIPLE_CHOICE]
        
        # Generate questions from retrieved content
        questions = []
        content_index = 0
        
        for i in range(num_questions):
            # Cycle through content if not enough
            content = request.retrieved_content[content_index % len(request.retrieved_content)]
            content_index += 1
            
            # Alternate question types if multiple types specified
            question_type = question_types[i % len(question_types)]
            
            # Generate question
            question = self.generate_question_from_content(
                content=content,
                difficulty=adaptive_difficulty,
                question_type=question_type,
                topic=request.topic
            )
            
            questions.append(question)
        
        # Calculate time limit based on question count and difficulty
        if request.time_limit:
            time_limit = request.time_limit
        else:
            total_estimated_time = sum(q.estimated_time for q in questions)
            time_limit = max(
                self.DEFAULT_TIME_LIMIT,
                int(total_estimated_time / 60) + 5  # Add buffer
            )
        
        # Create quiz title
        title = f"Adaptive Quiz: {request.topic}"
        if adaptive_difficulty != DifficultyLevel.MEDIUM:
            title += f" ({adaptive_difficulty.value.capitalize()} Level)"
        
        # Create quiz description
        description = (
            f"Adaptive quiz on {request.topic} tailored to your performance level. "
            f"Difficulty: {adaptive_difficulty.value}. "
            f"Questions: {len(questions)}."
        )
        
        return AdaptiveQuiz(
            quiz_id=None,  # Will be assigned when saved to database
            user_id=request.user_id,
            title=title,
            description=description,
            questions=questions,
            difficulty=adaptive_difficulty,
            topic=request.topic,
            time_limit=time_limit,
            created_at=datetime.now(),
            metadata={
                "adaptive": True,
                "performance_based": True,
                "user_level": adaptive_difficulty.value,
                "question_count": len(questions),
                "content_sources": len(request.retrieved_content)
            }
        )
    
    def adjust_difficulty_during_quiz(
        self,
        current_difficulty: DifficultyLevel,
        recent_answers: List[bool],
        adjustment_threshold: int = 3
    ) -> DifficultyLevel:
        """
        Adjust difficulty dynamically during quiz based on recent answers
        
        Args:
            current_difficulty: Current difficulty level
            recent_answers: List of recent correct/incorrect answers
            adjustment_threshold: Number of consecutive answers needed for adjustment
            
        Returns:
            Adjusted difficulty level
        """
        if len(recent_answers) < adjustment_threshold:
            return current_difficulty
        
        # Check recent performance
        recent_correct = sum(recent_answers[-adjustment_threshold:])
        
        if recent_correct == adjustment_threshold:
            # All correct - increase difficulty
            if current_difficulty == DifficultyLevel.EASY:
                return DifficultyLevel.MEDIUM
            elif current_difficulty == DifficultyLevel.MEDIUM:
                return DifficultyLevel.HARD
            else:
                return DifficultyLevel.HARD
        elif recent_correct == 0:
            # All incorrect - decrease difficulty
            if current_difficulty == DifficultyLevel.HARD:
                return DifficultyLevel.MEDIUM
            elif current_difficulty == DifficultyLevel.MEDIUM:
                return DifficultyLevel.EASY
            else:
                return DifficultyLevel.EASY
        
        return current_difficulty


# Singleton instance for application-wide use
_adaptive_generator_instance = None

def get_adaptive_generator(
    model_path: str = "./fine_tuned_quiz_model"
) -> AdaptiveQuizGenerator:
    """
    Get or create singleton Adaptive Quiz Generator instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        AdaptiveQuizGenerator instance
    """
    global _adaptive_generator_instance
    
    if _adaptive_generator_instance is None:
        _adaptive_generator_instance = AdaptiveQuizGenerator(model_path=model_path)
    
    return _adaptive_generator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Adaptive Quiz Generator")
    
    # Create generator instance
    generator = get_adaptive_generator()
    
    # Mock user performance
    performance_history = {
        'total_quizzes_completed': 5,
        'scores': [75, 80, 85, 82, 88],
        'completion_times': [300, 280, 290, 270, 285],
        'difficulty_distribution': {'easy': 10, 'medium': 30, 'hard': 10},
        'topic_performance': {
            'python': 85,
            'machine learning': 78,
            'data structures': 72
        },
        'last_quiz_date': datetime.now().isoformat()
    }
    
    # Analyze performance
    user_performance = generator.analyze_user_performance(1, performance_history)
    print(f"📊 User Performance Analysis:")
    print(f"   Average Score: {user_performance.average_score}")
    print(f"   Strong Topics: {user_performance.strong_topics}")
    print(f"   Weak Topics: {user_performance.weak_topics}")
    
    # Determine adaptive difficulty
    adaptive_difficulty = generator.determine_adaptive_difficulty(user_performance)
    print(f"🎯 Adaptive Difficulty: {adaptive_difficulty.value}")
    
    # Mock retrieved content
    retrieved_content = [
        "Machine learning is a subset of artificial intelligence.",
        "Deep learning uses neural networks with multiple layers.",
        "Natural language processing deals with human language interaction.",
        "Computer vision enables machines to interpret visual information.",
        "Data structures organize data for efficient access and modification."
    ]
    
    # Generate adaptive quiz
    request = AdaptiveQuizRequest(
        user_id=1,
        topic="artificial intelligence",
        retrieved_content=retrieved_content,
        num_questions=10
    )
    
    quiz = generator.generate_adaptive_quiz(request, user_performance)
    
    print(f"\n📝 Generated Quiz: {quiz.title}")
    print(f"   Difficulty: {quiz.difficulty.value}")
    print(f"   Questions: {len(quiz.questions)}")
    print(f"   Time Limit: {quiz.time_limit} minutes")
    
    print(f"\n📋 Sample Questions:")
    for i, question in enumerate(quiz.questions[:3], 1):
        print(f"\n{i}. {question.question}")
        print(f"   Difficulty: {question.difficulty.value}")
        print(f"   Type: {question.question_type.value}")
        print(f"   Options: {question.options}")
        print(f"   Correct: {question.correct_answer}")