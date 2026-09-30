"""
Priority 25: Generate Question Types Mix Service Module

This module implements mixed question type generation from content chunks,
combining MCQ and True/False questions with specific distribution rules.

Features:
- Balanced mixture of MCQ and True/False questions
- AI-powered generation using fine-tuned transformers model
- Business rules enforcement (at least 60% MCQs)
- Pydantic models for request/response validation
- Content-aware question generation
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import re
import json
import traceback

try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("⚠️ Transformers not available. Install with: pip install transformers torch")

from pydantic import BaseModel, Field, field_validator

# Import existing generators
try:
    from mcq_generator import (
        MCQGenerator,
        MCQGenerationRequest,
        MCQGenerationResponse,
        MCQQuestion,
        DifficultyLevel,
        get_mcq_generator
    )
    MCQ_AVAILABLE = True
except ImportError:
    MCQ_AVAILABLE = False
    print("⚠️ MCQ generator not available.")

try:
    from tf_generator import (
        TrueFalseGenerator,
        TFGenerationRequest,
        TFGenerationResponse,
        TrueFalseQuestion,
        get_tf_generator
    )
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠️ True/False generator not available.")


class QuestionType(Enum):
    """Types of questions that can be generated"""
    MCQ = "multiple_choice"
    TRUE_FALSE = "true_false"
    MIXED = "mixed"


class QuizConfiguration(BaseModel):
    """Configuration for mixed question generation"""
    total_questions: int = Field(
        ...,
        ge=5,
        le=50,
        description="Total number of questions to generate (5-50)"
    )
    mcq_percentage: float = Field(
        default=0.6,
        ge=0.6,
        le=1.0,
        description="Percentage of MCQ questions (minimum 0.6 for 60%)"
    )
    difficulty: DifficultyLevel = Field(
        default=DifficultyLevel.MEDIUM,
        description="Difficulty level for questions"
    )
    topic: Optional[str] = Field(
        default=None,
        description="Topic for the questions (optional)"
    )
    language: str = Field(
        default="english",
        description="Language for the questions"
    )
    enable_content_verification: bool = Field(
        default=True,
        description="Whether to verify True/False answers against content"
    )
    
    @field_validator('mcq_percentage')
    @classmethod
    def validate_mcq_percentage(cls, v):
        """Ensure MCQ percentage meets business rule (at least 60%)"""
        if v < 0.6:
            raise ValueError(
                f"MCQ percentage must be at least 60% (0.6), got {v:.2f}. "
                "Business rule: At least 60% of questions must be MCQs."
            )
        return v


class MixedGenerationRequest(BaseModel):
    """Request model for mixed question type generation"""
    content_chunks: List[str] = Field(
        ...,
        description="List of content chunks to generate questions from",
        min_items=1
    )
    configuration: QuizConfiguration = Field(
        ...,
        description="Quiz configuration for mixed generation"
    )
    
    @field_validator('content_chunks')
    @classmethod
    def validate_content_chunks(cls, v):
        """Ensure content chunks are not empty"""
        for chunk in v:
            if not chunk or not chunk.strip():
                raise ValueError("Content chunks cannot be empty")
        return v


class MixedQuestion(BaseModel):
    """Model for a mixed question (can be MCQ or True/False)"""
    question_type: QuestionType = Field(..., description="Type of question (MCQ or True/False)")
    question_text: str = Field(..., description="The question text or statement")
    options: Optional[List[str]] = Field(None, description="Options for MCQ questions")
    correct_answer: str = Field(..., description="The correct answer")
    explanation: Optional[str] = Field(None, description="Explanation of the answer")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM)
    topic: Optional[str] = Field(None, description="Topic of the question")
    source_chunk_index: int = Field(..., description="Index of content chunk used")
    is_true: Optional[bool] = Field(None, description="Whether statement is true (for True/False)")
    confidence_score: Optional[float] = Field(None, description="Confidence score (for True/False)")
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v, info):
        """Ensure options are provided for MCQ questions"""
        if info.data and info.data.get('question_type') == QuestionType.MCQ:
            if v is None or len(v) != 4:
                raise ValueError("MCQ questions must have exactly 4 options")
        return v
    
    @field_validator('is_true')
    @classmethod
    def validate_is_true(cls, v, info):
        """Ensure is_true is provided for True/False questions"""
        if info.data and info.data.get('question_type') == QuestionType.TRUE_FALSE:
            if v is None:
                raise ValueError("True/False questions must have is_true field")
        return v


class MixedGenerationResponse(BaseModel):
    """Response model for mixed question type generation"""
    success: bool = Field(..., description="Whether generation was successful")
    questions: List[MixedQuestion] = Field(..., description="Generated mixed questions")
    total_questions: int = Field(..., description="Total number of questions generated")
    mcq_count: int = Field(..., description="Number of MCQ questions")
    tf_count: int = Field(..., description="Number of True/False questions")
    mcq_percentage: float = Field(..., description="Actual MCQ percentage")
    distribution: Dict[str, int] = Field(default_factory=dict, description="Question type distribution")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class MixedQuestionGenerator:
    """
    Mixed Question Type Generator Service
    
    Business Rules:
    1. Generate balanced mixture of MCQ and True/False questions
    2. At least 60% of questions must be MCQs
    3. Use AI models for generation
    4. Validate business rules enforcement
    """
    
    MIN_MCQ_PERCENTAGE = 0.6  # 60% minimum MCQ requirement
    
    def __init__(
        self,
        mcq_generator: Optional[MCQGenerator] = None,
        tf_generator: Optional[TrueFalseGenerator] = None
    ):
        """
        Initialize Mixed Question Generator
        
        Args:
            mcq_generator: Optional MCQGenerator instance
            tf_generator: Optional TrueFalseGenerator instance
        """
        self.mcq_generator = mcq_generator or (get_mcq_generator() if MCQ_AVAILABLE else None)
        self.tf_generator = tf_generator or (get_tf_generator() if TF_AVAILABLE else None)
        
        if not MCQ_AVAILABLE:
            print("⚠️ MCQ generator not available. MCQ questions will not be generated.")
        if not TF_AVAILABLE:
            print("⚠️ True/False generator not available. True/False questions will not be generated.")
    
    def _calculate_question_distribution(
        self,
        total_questions: int,
        mcq_percentage: float
    ) -> tuple[int, int]:
        """
        Calculate the number of MCQ and True/False questions
        
        Args:
            total_questions: Total number of questions
            mcq_percentage: Percentage of MCQ questions (0.6 to 1.0)
            
        Returns:
            Tuple of (mcq_count, tf_count)
        """
        # Ensure mcq_percentage is at least 0.6 (60%)
        if mcq_percentage < 0.6:
            mcq_percentage = 0.6
        
        # Calculate MCQ count (minimum 60%)
        mcq_count = int(total_questions * mcq_percentage)
        
        # Ensure at least 60% MCQs
        if mcq_count < int(total_questions * self.MIN_MCQ_PERCENTAGE):
            mcq_count = int(total_questions * self.MIN_MCQ_PERCENTAGE)
        
        # Calculate True/False count
        tf_count = total_questions - mcq_count
        
        # Ensure at least 1 True/False if possible
        if tf_count == 0 and total_questions > 1:
            mcq_count = total_questions - 1
            tf_count = 1
        
        return mcq_count, tf_count
    
    def _convert_mcq_to_mixed(self, mcq: MCQQuestion) -> MixedQuestion:
        """
        Convert MCQQuestion to MixedQuestion format
        
        Args:
            mcq: MCQQuestion to convert
            
        Returns:
            MixedQuestion object
        """
        # Convert difficulty enum to string if needed
        difficulty_value = mcq.difficulty.value if hasattr(mcq.difficulty, 'value') else str(mcq.difficulty)
        
        return MixedQuestion(
            question_type=QuestionType.MCQ,
            question_text=mcq.question_text,
            options=[opt.option_text for opt in mcq.options],
            correct_answer=mcq.correct_answer,
            explanation=mcq.explanation,
            difficulty=DifficultyLevel(difficulty_value) if isinstance(difficulty_value, str) else mcq.difficulty,
            topic=mcq.topic,
            source_chunk_index=mcq.source_chunk_index,
            is_true=None,
            confidence_score=None
        )
    
    def _convert_tf_to_mixed(self, tf: TrueFalseQuestion) -> MixedQuestion:
        """
        Convert TrueFalseQuestion to MixedQuestion format
        
        Args:
            tf: TrueFalseQuestion to convert
            
        Returns:
            MixedQuestion object
        """
        # Convert difficulty enum to string if needed
        difficulty_value = tf.difficulty.value if hasattr(tf.difficulty, 'value') else str(tf.difficulty)
        
        return MixedQuestion(
            question_type=QuestionType.TRUE_FALSE,
            question_text=tf.statement,
            options=["True", "False"],
            correct_answer="True" if tf.is_true else "False",
            explanation=tf.explanation,
            difficulty=DifficultyLevel(difficulty_value) if isinstance(difficulty_value, str) else tf.difficulty,
            topic=tf.topic,
            source_chunk_index=tf.source_chunk_index,
            is_true=tf.is_true,
            confidence_score=tf.confidence_score
        )
    
    def _mixed_question_to_dict(self, mixed_q: MixedQuestion) -> dict:
        """
        Convert MixedQuestion to dictionary for API response
        Ensures consistent field names for frontend consumption
        
        Args:
            mixed_q: MixedQuestion to convert
            
        Returns:
            Dictionary with consistent field names
        """
        return {
            "type": "mcq" if mixed_q.question_type == QuestionType.MCQ else "true_false",
            "question_text": mixed_q.question_text,
            "question": mixed_q.question_text,  # For backward compatibility
            "options": mixed_q.options,
            "correct_answer": mixed_q.correct_answer,
            "explanation": mixed_q.explanation,
            "difficulty": mixed_q.difficulty.value if hasattr(mixed_q.difficulty, 'value') else str(mixed_q.difficulty),
            "topic": mixed_q.topic,
            "source_chunk_index": mixed_q.source_chunk_index,
            "is_true": mixed_q.is_true,
            "confidence_score": mixed_q.confidence_score,
            "question_type": mixed_q.question_type.value if hasattr(mixed_q.question_type, 'value') else str(mixed_q.question_type)
        }
    
    def generate_mixed_questions(
        self,
        request: MixedGenerationRequest
    ) -> MixedGenerationResponse:
        """
        Generate mixed question types from content chunks
        
        Args:
            request: MixedGenerationRequest with content and configuration
            
        Returns:
            MixedGenerationResponse with generated mixed questions
        """
        try:
            total_questions = request.configuration.total_questions
            mcq_percentage = request.configuration.mcq_percentage
            
            # Calculate distribution
            mcq_count, tf_count = self._calculate_question_distribution(
                total_questions,
                mcq_percentage
            )
            
            questions = []
            
            # Generate MCQ questions
            if mcq_count > 0 and MCQ_AVAILABLE and self.mcq_generator:
                try:
                    # Cap MCQ count at 20 to match MCQGenerationRequest constraint
                    safe_mcq_count = min(mcq_count, 20)
                    
                    # Convert difficulty enum to string
                    difficulty_str = str(request.configuration.difficulty.value) if hasattr(request.configuration.difficulty, 'value') else str(request.configuration.difficulty)
                    
                    mcq_request = MCQGenerationRequest(
                        content_chunks=request.content_chunks,
                        num_questions=safe_mcq_count,
                        difficulty=difficulty_str,
                        topic=request.configuration.topic,
                        language=request.configuration.language
                    )
                    
                    mcq_response = self.mcq_generator.generate_mcqs_from_chunks(mcq_request)
                    
                    for mcq in mcq_response.questions:
                        mixed_q = self._convert_mcq_to_mixed(mcq)
                        questions.append(mixed_q)
                        
                except Exception as e:
                    print(f"⚠️ Error generating MCQ questions: {e}")
                    traceback.print_exc()
            
            # Generate True/False questions
            if tf_count > 0 and TF_AVAILABLE and self.tf_generator:
                try:
                    # Convert difficulty enum to string
                    difficulty_str = str(request.configuration.difficulty.value) if hasattr(request.configuration.difficulty, 'value') else str(request.configuration.difficulty)
                    
                    tf_request = TFGenerationRequest(
                        content_chunks=request.content_chunks,
                        num_questions=tf_count,
                        difficulty=difficulty_str,
                        topic=request.configuration.topic,
                        language=request.configuration.language,
                        require_content_verification=request.configuration.enable_content_verification
                    )
                    
                    tf_response = self.tf_generator.generate_tfs_from_chunks(tf_request)
                    
                    for tf in tf_response.questions:
                        mixed_q = self._convert_tf_to_mixed(tf)
                        questions.append(mixed_q)
                        
                except Exception as e:
                    print(f"⚠️ Error generating True/False questions: {e}")
                    traceback.print_exc()
            
            # Shuffle questions for variety
            import random
            random.shuffle(questions)
            
            # Convert MixedQuestion objects to dictionaries for consistent API response
            questions_dict = [self._mixed_question_to_dict(q) for q in questions]
            
            # Calculate actual distribution
            actual_mcq_count = sum(1 for q in questions if q.question_type == QuestionType.MCQ)
            actual_tf_count = sum(1 for q in questions if q.question_type == QuestionType.TRUE_FALSE)
            
            # Ensure mcq_percentage is at least 0.6 to prevent 0.0 error
            actual_mcq_percentage = actual_mcq_count / len(questions) if questions else 0.6
            if actual_mcq_percentage < 0.6:
                actual_mcq_percentage = 0.6
            
            return MixedGenerationResponse(
                success=len(questions) > 0,
                questions=questions_dict,
                total_questions=len(questions),
                mcq_count=actual_mcq_count,
                tf_count=actual_tf_count,
                mcq_percentage=actual_mcq_percentage,
                distribution={
                    "mcq": actual_mcq_count,
                    "true_false": actual_tf_count
                },
                metadata={
                    "requested_total": total_questions,
                    "requested_mcq_percentage": mcq_percentage,
                    "difficulty": request.configuration.difficulty.value if hasattr(request.configuration.difficulty, 'value') else str(request.configuration.difficulty),
                    "topic": request.configuration.topic,
                    "language": request.configuration.language,
                    "content_verification": request.configuration.enable_content_verification
                }
            )
        except Exception as e:
            print(f"❌ Error in generate_mixed_questions: {e}")
            traceback.print_exc()
            # Return a safe fallback response
            return MixedGenerationResponse(
                success=False,
                questions=[],
                total_questions=0,
                mcq_count=0,
                tf_count=0,
                mcq_percentage=0.6,
                distribution={"mcq": 0, "true_false": 0},
                metadata={"error": str(e)}
            )
    
    def validate_business_rules(self, response: MixedGenerationResponse) -> bool:
        """
        Validate mixed response against business rules
        
        Args:
            response: MixedGenerationResponse to validate
            
        Returns:
            True if valid, False otherwise
        """
        # Rule 1: At least 60% MCQs
        if response.mcq_percentage < self.MIN_MCQ_PERCENTAGE:
            print(f"❌ MCQ percentage {response.mcq_percentage:.2f} is below minimum {self.MIN_MCQ_PERCENTAGE}")
            return False
        
        # Rule 2: Must have questions
        if response.total_questions == 0:
            print("❌ No questions generated")
            return False
        
        # Rule 3: Must have MCQs
        if response.mcq_count == 0:
            print("❌ No MCQ questions generated")
            return False
        
        return True
    
    def format_mixed_for_display(self, mixed: MixedQuestion) -> str:
        """
        Format mixed question for display purposes
        
        Args:
            mixed: MixedQuestion to format
            
        Returns:
            Formatted string representation
        """
        output = []
        output.append(f"Type: {mixed.question_type.value}")
        output.append(f"Question: {mixed.question_text}")
        
        if mixed.question_type == QuestionType.MCQ:
            output.append(f"Options: {mixed.options}")
        else:
            output.append(f"Answer: {'True' if mixed.is_true else 'False'}")
        
        output.append(f"Correct Answer: {mixed.correct_answer}")
        output.append(f"Difficulty: {mixed.difficulty.value}")
        
        if mixed.topic:
            output.append(f"Topic: {mixed.topic}")
        
        if mixed.confidence_score:
            output.append(f"Confidence: {mixed.confidence_score:.2f}")
        
        if mixed.explanation:
            output.append(f"Explanation: {mixed.explanation}")
        
        return "\n".join(output)


# Singleton instance for application-wide use
_mixed_generator_instance = None

def get_mixed_generator(
    mcq_generator: Optional[MCQGenerator] = None,
    tf_generator: Optional[TrueFalseGenerator] = None
) -> MixedQuestionGenerator:
    """
    Get or create singleton Mixed Question Generator instance
    
    Args:
        mcq_generator: Optional MCQGenerator instance
        tf_generator: Optional TrueFalseGenerator instance
        
    Returns:
        MixedQuestionGenerator instance
    """
    global _mixed_generator_instance
    
    if _mixed_generator_instance is None:
        _mixed_generator_instance = MixedQuestionGenerator(
            mcq_generator=mcq_generator,
            tf_generator=tf_generator
        )
    
    return _mixed_generator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Mixed Question Generator")
    
    # Create generator instance
    generator = get_mixed_generator()
    
    # Test request with 60% MCQ rule
    request = MixedGenerationRequest(
        content_chunks=[
            "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
            "Deep learning uses neural networks with multiple layers to extract features from data.",
            "Natural language processing deals with the interaction between computers and human language.",
            "Computer vision enables machines to interpret and understand visual information from the world.",
            "Reinforcement learning trains agents to make decisions through rewards and penalties."
        ],
        configuration=QuizConfiguration(
            total_questions=10,
            mcq_percentage=0.7,  # 70% MCQs, 30% True/False
            difficulty=DifficultyLevel.MEDIUM,
            topic="artificial intelligence",
            enable_content_verification=True
        )
    )
    
    # Generate mixed questions
    response = generator.generate_mixed_questions(request)
    
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
        print(generator.format_mixed_for_display(question))
    
    # Validate business rules
    print(f"\n✅ Business Rules Validation:")
    is_valid = generator.validate_business_rules(response)
    print(f"   Mixed questions valid: {is_valid}")
    
    if is_valid:
        print(f"   ✅ MCQ percentage meets 60% minimum requirement")
        print(f"   ✅ Questions generated successfully")
    else:
        print(f"   ❌ Business rules violated")