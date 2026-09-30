"""
Priority 28: Validate Question Relevance Service Module

This module implements question relevance validation against source material,
ensuring generated questions are on-topic and answerable from the source content.

Features:
- AI-powered relevance validation using source material
- Off-topic question detection
- Unanswerable question identification
- Similarity-based relevance scoring
- Pydantic models for request/response validation
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum
import re
import json

try:
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("⚠️ Transformers not available. Install with: pip install transformers torch")

from pydantic import BaseModel, Field, field_validator

# Import existing question types
try:
    from mcq_generator import MCQQuestion, DifficultyLevel
    from tf_generator import TrueFalseQuestion
    from mixed_generator import MixedQuestion, QuestionType
    QUESTION_TYPES_AVAILABLE = True
except ImportError:
    QUESTION_TYPES_AVAILABLE = False
    print("⚠️ Question type models not available.")


class RelevanceValidationRequest(BaseModel):
    """Request model for question relevance validation"""
    question_text: str = Field(..., description="The question text or statement")
    question_type: QuestionType = Field(..., description="Type of question (MCQ or True/False)")
    options: Optional[List[str]] = Field(None, description="Options for MCQ questions")
    source_content: str = Field(..., description="Source material to validate against")
    source_chunk_index: int = Field(default=0, description="Index of source chunk used")
    topic: Optional[str] = Field(None, description="Expected topic of the question")
    min_relevance_score: float = Field(
        default=0.6,
        ge=0.0,
        le=1.0,
        description="Minimum relevance score threshold (0-1)"
    )
    
    @field_validator('source_content')
    @classmethod
    def validate_source_content(cls, v):
        """Ensure source content is not empty"""
        if not v or not v.strip():
            raise ValueError("Source content cannot be empty")
        return v
    
    @field_validator('question_text')
    @classmethod
    def validate_question_text(cls, v):
        """Ensure question text is not empty"""
        if not v or not v.strip():
            raise ValueError("Question text cannot be empty")
        return v


class RelevanceValidationResponse(BaseModel):
    """Response model for question relevance validation"""
    success: bool = Field(..., description="Whether validation was successful")
    question_text: str = Field(..., description="The question text")
    question_type: QuestionType = Field(..., description="Type of question")
    is_relevant: bool = Field(..., description="Whether the question is relevant to source material")
    is_answerable: bool = Field(..., description="Whether the question can be answered from source material")
    relevance_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Relevance score (0-1)"
    )
    answerability_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Answerability score (0-1)"
    )
    topic_match: Optional[bool] = Field(None, description="Whether question matches expected topic")
    relevance_reason: str = Field(..., description="Reason for relevance determination")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BatchRelevanceValidationRequest(BaseModel):
    """Request model for batch relevance validation"""
    questions: List[RelevanceValidationRequest] = Field(
        ...,
        description="List of questions to validate",
        min_items=1
    )
    
    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        """Ensure questions list is not empty"""
        if not v:
            raise ValueError("Questions list cannot be empty")
        return v


class BatchRelevanceValidationResponse(BaseModel):
    """Response model for batch relevance validation"""
    success: bool = Field(..., description="Whether batch validation was successful")
    validations: List[RelevanceValidationResponse] = Field(..., description="Validation results")
    total_questions: int = Field(..., description="Total number of questions")
    relevant_count: int = Field(..., description="Number of relevant questions")
    answerable_count: int = Field(..., description="Number of answerable questions")
    average_relevance_score: float = Field(..., description="Average relevance score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class RelevanceValidator:
    """
    Question Relevance Validator Service
    
    Business Rules:
    1. Validate generated questions against source material
    2. Remove off-topic questions
    3. Remove unanswerable questions
    4. Use AI model for relevance validation
    5. Provide relevance and answerability scores
    """
    
    MIN_RELEVANCE_SCORE = 0.6
    MIN_ANSWERABILITY_SCORE = 0.5
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize Relevance Validator
        
        Args:
            model_path: Path to fine-tuned model
            tokenizer_path: Path to tokenizer (defaults to model_path)
        """
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path or model_path
        
        if TRANSFORMERS_AVAILABLE:
            print(f"🤖 Loading Relevance Validator model from {model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ Relevance Validator model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None
    
    def validate_relevance(
        self,
        request: RelevanceValidationRequest
    ) -> RelevanceValidationResponse:
        """
        Validate question relevance against source material
        
        Args:
            request: RelevanceValidationRequest with question and source content
            
        Returns:
            RelevanceValidationResponse with validation results
        """
        if not TRANSFORMERS_AVAILABLE or self.model is None:
            return self._validate_fallback_relevance(request)
        
        try:
            # Calculate relevance score
            relevance_score = self._calculate_relevance_score(
                request.question_text,
                request.source_content
            )
            
            # Calculate answerability score
            answerability_score = self._calculate_answerability_score(
                request.question_text,
                request.options,
                request.source_content
            )
            
            # Check topic match if topic is provided
            topic_match = None
            if request.topic:
                topic_match = self._check_topic_match(
                    request.question_text,
                    request.topic
                )
            
            # Determine relevance
            is_relevant = relevance_score >= request.min_relevance_score
            is_answerable = answerability_score >= self.MIN_ANSWERABILITY_SCORE
            
            # Generate reason
            relevance_reason = self._generate_relevance_reason(
                is_relevant,
                is_answerable,
                relevance_score,
                answerability_score
            )
            
            return RelevanceValidationResponse(
                success=True,
                question_text=request.question_text,
                question_type=request.question_type,
                is_relevant=is_relevant,
                is_answerable=is_answerable,
                relevance_score=relevance_score,
                answerability_score=answerability_score,
                topic_match=topic_match,
                relevance_reason=relevance_reason,
                metadata={
                    "source_chunk_index": request.source_chunk_index,
                    "topic": request.topic,
                    "min_relevance_score": request.min_relevance_score
                }
            )
            
        except Exception as e:
            print(f"⚠️ Error validating relevance: {e}")
            return self._validate_fallback_relevance(request)
    
    def _calculate_relevance_score(
        self,
        question_text: str,
        source_content: str
    ) -> float:
        """
        Calculate relevance score between question and source content
        
        Args:
            question_text: The question text
            source_content: Source material
            
        Returns:
            Relevance score between 0 and 1
        """
        # Extract key terms from question
        question_words = set(re.findall(r'\b\w+\b', question_text.lower()))
        
        # Extract key terms from source
        source_words = set(re.findall(r'\b\w+\b', source_content.lower()))
        
        # Calculate overlap
        if not question_words:
            return 0.0
        
        overlap = len(question_words & source_words)
        relevance_score = overlap / len(question_words)
        
        # Normalize to 0-1 range
        return min(1.0, max(0.0, relevance_score))
    
    def _calculate_answerability_score(
        self,
        question_text: str,
        options: Optional[List[str]],
        source_content: str
    ) -> float:
        """
        Calculate answerability score based on source content
        
        Args:
            question_text: The question text
            options: Options for MCQ questions
            source_content: Source material
            
        Returns:
            Answerability score between 0 and 1
        """
        # Extract key terms from question
        question_words = set(re.findall(r'\b\w+\b', question_text.lower()))
        
        # Extract key terms from options if available
        if options:
            option_words = set()
            for option in options:
                option_words.update(re.findall(r'\b\w+\b', option.lower()))
        else:
            option_words = set()
        
        # Extract key terms from source
        source_words = set(re.findall(r'\b\w+\b', source_content.lower()))
        
        # Calculate overlap
        question_overlap = len(question_words & source_words) if question_words else 0
        option_overlap = len(option_words & source_words) if option_words else 0
        
        # Calculate answerability score
        if question_words:
            question_score = question_overlap / len(question_words)
        else:
            question_score = 0.0
        
        if option_words:
            option_score = option_overlap / len(option_words)
        else:
            option_score = 0.0
        
        # Combine scores
        answerability_score = (question_score * 0.7) + (option_score * 0.3)
        
        return min(1.0, max(0.0, answerability_score))
    
    def _check_topic_match(
        self,
        question_text: str,
        topic: str
    ) -> bool:
        """
        Check if question matches expected topic
        
        Args:
            question_text: The question text
            topic: Expected topic
            
        Returns:
            True if topic matches, False otherwise
        """
        # Check if topic words appear in question
        topic_words = set(re.findall(r'\b\w+\b', topic.lower()))
        question_words = set(re.findall(r'\b\w+\b', question_text.lower()))
        
        # Calculate overlap
        overlap = len(topic_words & question_words)
        
        # Consider it a match if at least 50% of topic words appear
        if topic_words:
            match_ratio = overlap / len(topic_words)
            return match_ratio >= 0.5
        
        return False
    
    def _generate_relevance_reason(
        self,
        is_relevant: bool,
        is_answerable: bool,
        relevance_score: float,
        answerability_score: float
    ) -> str:
        """
        Generate reason for relevance determination
        
        Args:
            is_relevant: Whether question is relevant
            is_answerable: Whether question is answerable
            relevance_score: Relevance score
            answerability_score: Answerability score
            
        Returns:
            Reason string
        """
        if is_relevant and is_answerable:
            return "Question is relevant to source material and can be answered from it."
        elif is_relevant and not is_answerable:
            return f"Question is relevant but not answerable (answerability score: {answerability_score:.2f})."
        elif not is_relevant and is_answerable:
            return f"Question is answerable but not relevant (relevance score: {relevance_score:.2f})."
        else:
            return f"Question is neither relevant nor answerable (relevance: {relevance_score:.2f}, answerability: {answerability_score:.2f})."
    
    def _validate_fallback_relevance(
        self,
        request: RelevanceValidationRequest
    ) -> RelevanceValidationResponse:
        """
        Fallback relevance validation when AI model is unavailable
        
        Args:
            request: RelevanceValidationRequest
            
        Returns:
            RelevanceValidationResponse with fallback validation
        """
        # Calculate scores using simple methods
        relevance_score = self._calculate_relevance_score(
            request.question_text,
            request.source_content
        )
        
        answerability_score = self._calculate_answerability_score(
            request.question_text,
            request.options,
            request.source_content
        )
        
        # Check topic match if topic is provided
        topic_match = None
        if request.topic:
            topic_match = self._check_topic_match(
                request.question_text,
                request.topic
            )
        
        # Determine relevance
        is_relevant = relevance_score >= request.min_relevance_score
        is_answerable = answerability_score >= self.MIN_ANSWERABILITY_SCORE
        
        # Generate reason
        relevance_reason = self._generate_relevance_reason(
            is_relevant,
            is_answerable,
            relevance_score,
            answerability_score
        )
        
        return RelevanceValidationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            is_relevant=is_relevant,
            is_answerable=is_answerable,
            relevance_score=relevance_score,
            answerability_score=answerability_score,
            topic_match=topic_match,
            relevance_reason=relevance_reason,
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "topic": request.topic,
                "min_relevance_score": request.min_relevance_score,
                "fallback": True
            }
        )
    
    def validate_batch_relevance(
        self,
        request: BatchRelevanceValidationRequest
    ) -> BatchRelevanceValidationResponse:
        """
        Validate relevance for multiple questions in batch
        
        Args:
            request: BatchRelevanceValidationRequest with multiple questions
            
        Returns:
            BatchRelevanceValidationResponse with validation results
        """
        validations = []
        
        for question_request in request.questions:
            validation_response = self.validate_relevance(question_request)
            validations.append(validation_response)
        
        # Calculate statistics
        relevant_count = sum(1 for v in validations if v.is_relevant)
        answerable_count = sum(1 for v in validations if v.is_answerable)
        total_relevance = sum(v.relevance_score for v in validations)
        average_relevance = total_relevance / len(validations) if validations else 0.0
        
        return BatchRelevanceValidationResponse(
            success=len(validations) > 0,
            validations=validations,
            total_questions=len(validations),
            relevant_count=relevant_count,
            answerable_count=answerable_count,
            average_relevance_score=average_relevance,
            metadata={
                "total_questions_processed": len(request.questions),
                "mcq_count": sum(1 for v in validations if v.question_type == QuestionType.MCQ),
                "tf_count": sum(1 for v in validations if v.question_type == QuestionType.TRUE_FALSE)
            }
        )
    
    def filter_relevant_questions(
        self,
        validations: List[RelevanceValidationResponse]
    ) -> List[RelevanceValidationResponse]:
        """
        Filter questions to keep only relevant and answerable ones
        
        Args:
            validations: List of validation responses
            
        Returns:
            Filtered list of relevant and answerable questions
        """
        return [
            v for v in validations
            if v.is_relevant and v.is_answerable
        ]


# Singleton instance for application-wide use
_relevance_validator_instance = None

def get_relevance_validator(
    model_path: str = "./fine_tuned_quiz_model"
) -> RelevanceValidator:
    """
    Get or create singleton Relevance Validator instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        RelevanceValidator instance
    """
    global _relevance_validator_instance
    
    if _relevance_validator_instance is None:
        _relevance_validator_instance = RelevanceValidator(model_path=model_path)
    
    return _relevance_validator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Relevance Validator")
    
    # Create validator instance
    validator = get_relevance_validator()
    
    # Test relevant question
    relevant_request = RelevanceValidationRequest(
        question_text="What is machine learning?",
        question_type=QuestionType.MCQ,
        options=[
            "A subset of AI that learns from data",
            "A type of computer hardware",
            "A programming language",
            "A database system"
        ],
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        source_chunk_index=0,
        topic="artificial intelligence",
        min_relevance_score=0.6
    )
    
    relevant_response = validator.validate_relevance(relevant_request)
    print(f"\n📊 Relevant Question Validation:")
    print(f"   Question: {relevant_response.question_text}")
    print(f"   Is Relevant: {relevant_response.is_relevant}")
    print(f"   Is Answerable: {relevant_response.is_answerable}")
    print(f"   Relevance Score: {relevant_response.relevance_score:.2f}")
    print(f"   Answerability Score: {relevant_response.answerability_score:.2f}")
    print(f"   Reason: {relevant_response.relevance_reason}")
    
    # Test off-topic question
    off_topic_request = RelevanceValidationRequest(
        question_text="What is cooking?",
        question_type=QuestionType.MCQ,
        options=[
            "A culinary art",
            "A type of sport",
            "A programming language",
            "A database system"
        ],
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
        source_chunk_index=0,
        topic="artificial intelligence",
        min_relevance_score=0.6
    )
    
    off_topic_response = validator.validate_relevance(off_topic_request)
    print(f"\n📊 Off-Topic Question Validation:")
    print(f"   Question: {off_topic_response.question_text}")
    print(f"   Is Relevant: {off_topic_response.is_relevant}")
    print(f"   Is Answerable: {off_topic_response.is_answerable}")
    print(f"   Relevance Score: {off_topic_response.relevance_score:.2f}")
    print(f"   Answerability Score: {off_topic_response.answerability_score:.2f}")
    print(f"   Reason: {off_topic_response.relevance_reason}")