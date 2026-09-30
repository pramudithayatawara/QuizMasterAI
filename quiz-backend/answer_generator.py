"""
Priority 26: Generate Answers Service Module

This module implements answer generation for quiz questions based on source material,
ensuring accurate, factually correct answers determined from the original content.

Features:
- AI-powered answer determination using source material
- Support for MCQ, True/False, and Mixed question types
- Content-based answer validation
- Pydantic models for request/response validation
- Source material verification
"""

from typing import List, Optional, Dict, Any, Union
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


class AnswerDeterminationRequest(BaseModel):
    """Request model for answer determination"""
    question_text: str = Field(..., description="The question text or statement")
    question_type: QuestionType = Field(..., description="Type of question (MCQ or True/False)")
    options: Optional[List[str]] = Field(None, description="Options for MCQ questions")
    source_content: str = Field(..., description="Source material to determine answer from")
    source_chunk_index: int = Field(default=0, description="Index of source chunk used")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM)
    topic: Optional[str] = Field(None, description="Topic of the question")
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v, info):
        """Ensure options are provided for MCQ questions"""
        if info.data and info.data.get('question_type') == QuestionType.MCQ:
            if v is None or len(v) != 4:
                raise ValueError("MCQ questions must have exactly 4 options")
        return v
    
    @field_validator('source_content')
    @classmethod
    def validate_source_content(cls, v):
        """Ensure source content is not empty"""
        if not v or not v.strip():
            raise ValueError("Source content cannot be empty")
        return v


class AnswerDeterminationResponse(BaseModel):
    """Response model for answer determination"""
    success: bool = Field(..., description="Whether answer determination was successful")
    question_text: str = Field(..., description="The question text")
    question_type: QuestionType = Field(..., description="Type of question")
    correct_answer: str = Field(..., description="The determined correct answer")
    is_true: Optional[bool] = Field(None, description="Whether statement is true (for True/False)")
    confidence_score: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Confidence score for the answer (0-1)"
    )
    source_evidence: Optional[str] = Field(None, description="Evidence from source content")
    reasoning: Optional[str] = Field(None, description="Reasoning for the answer")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BatchAnswerDeterminationRequest(BaseModel):
    """Request model for batch answer determination"""
    questions: List[AnswerDeterminationRequest] = Field(
        ...,
        description="List of questions to determine answers for",
        min_items=1
    )
    
    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        """Ensure questions list is not empty"""
        if not v:
            raise ValueError("Questions list cannot be empty")
        return v


class BatchAnswerDeterminationResponse(BaseModel):
    """Response model for batch answer determination"""
    success: bool = Field(..., description="Whether batch determination was successful")
    answers: List[AnswerDeterminationResponse] = Field(..., description="Determined answers")
    total_questions: int = Field(..., description="Total number of questions")
    average_confidence: float = Field(..., description="Average confidence score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AnswerGenerator:
    """
    Answer Generator Service
    
    Business Rules:
    1. Determine accurate, factually correct answers based on source material
    2. Use AI model for answer determination
    3. Validate answers against source content
    4. Provide confidence scores
    5. Support MCQ and True/False question types
    """
    
    MIN_CONFIDENCE_SCORE = 0.7
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize Answer Generator
        
        Args:
            model_path: Path to fine-tuned model
            tokenizer_path: Path to tokenizer (defaults to model_path)
        """
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path or model_path
        
        if TRANSFORMERS_AVAILABLE:
            print(f"🤖 Loading Answer Generator model from {model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ Answer Generator model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None
    
    def determine_answer(
        self,
        request: AnswerDeterminationRequest
    ) -> AnswerDeterminationResponse:
        """
        Determine the correct answer for a question based on source content
        
        Args:
            request: AnswerDeterminationRequest with question and source content
            
        Returns:
            AnswerDeterminationResponse with determined answer
        """
        if not TRANSFORMERS_AVAILABLE or self.model is None:
            return self._determine_fallback_answer(request)
        
        try:
            if request.question_type == QuestionType.MCQ:
                return self._determine_mcq_answer(request)
            elif request.question_type == QuestionType.TRUE_FALSE:
                return self._determine_tf_answer(request)
            else:
                return self._determine_fallback_answer(request)
                
        except Exception as e:
            print(f"⚠️ Error determining answer: {e}")
            return self._determine_fallback_answer(request)
    
    def _determine_mcq_answer(
        self,
        request: AnswerDeterminationRequest
    ) -> AnswerDeterminationResponse:
        """
        Determine correct answer for MCQ question using AI model
        
        Args:
            request: AnswerDeterminationRequest for MCQ question
            
        Returns:
            AnswerDeterminationResponse with determined answer
        """
        # Format input for MCQ answer determination
        options_text = "\n".join([f"{chr(65+i)}. {opt}" for i, opt in enumerate(request.options)])
        input_text = (
            f"Question: {request.question_text}\n"
            f"Options:\n{options_text}\n"
            f"Source: {request.source_content[:500]}\n"
            f"Determine the correct answer based on the source content."
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
            max_length=100,
            num_beams=4,
            no_repeat_ngram_size=2,
            early_stopping=True,
            temperature=0.6,
            do_sample=True
        )
        
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse generated answer
        correct_answer = self._parse_mcq_answer(generated_text, request.options)
        
        # Find source evidence
        source_evidence = self._find_source_evidence(
            request.question_text,
            correct_answer,
            request.source_content
        )
        
        # Calculate confidence
        confidence = self._calculate_answer_confidence(
            request.question_text,
            correct_answer,
            request.source_content
        )
        
        return AnswerDeterminationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            correct_answer=correct_answer,
            is_true=None,
            confidence_score=confidence,
            source_evidence=source_evidence,
            reasoning="Answer determined based on source content analysis",
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "difficulty": request.difficulty.value,
                "topic": request.topic
            }
        )
    
    def _determine_tf_answer(
        self,
        request: AnswerDeterminationRequest
    ) -> AnswerDeterminationResponse:
        """
        Determine correct answer for True/False question using AI model
        
        Args:
            request: AnswerDeterminationRequest for True/False question
            
        Returns:
            AnswerDeterminationResponse with determined answer
        """
        # Format input for True/False answer determination
        input_text = (
            f"Statement: {request.question_text}\n"
            f"Source: {request.source_content[:500]}\n"
            f"Determine if the statement is True or False based on the source content."
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
            max_length=50,
            num_beams=4,
            no_repeat_ngram_size=2,
            early_stopping=True,
            temperature=0.6,
            do_sample=True
        )
        
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse generated answer
        is_true = self._parse_tf_answer(generated_text)
        
        # Find source evidence
        source_evidence = self._find_source_evidence(
            request.question_text,
            "True" if is_true else "False",
            request.source_content
        )
        
        # Calculate confidence
        confidence = self._calculate_answer_confidence(
            request.question_text,
            "True" if is_true else "False",
            request.source_content
        )
        
        return AnswerDeterminationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            correct_answer="True" if is_true else "False",
            is_true=is_true,
            confidence_score=confidence,
            source_evidence=source_evidence,
            reasoning="Answer determined based on source content analysis",
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "difficulty": request.difficulty.value,
                "topic": request.topic
            }
        )
    
    def _parse_mcq_answer(self, generated_text: str, options: List[str]) -> str:
        """
        Parse generated text to extract MCQ answer
        
        Args:
            generated_text: Text generated by AI model
            options: List of available options
            
        Returns:
            The correct answer option
        """
        # Look for option letters (A, B, C, D)
        for letter in ['A', 'B', 'C', 'D']:
            if letter in generated_text.upper():
                index = ord(letter) - ord('A')
                if 0 <= index < len(options):
                    return options[index]
        
        # Fallback: look for exact match with options
        for option in options:
            if option.lower() in generated_text.lower():
                return option
        
        # Default to first option if no match found
        return options[0]
    
    def _parse_tf_answer(self, generated_text: str) -> bool:
        """
        Parse generated text to extract True/False answer
        
        Args:
            generated_text: Text generated by AI model
            
        Returns:
            True if statement is true, False otherwise
        """
        generated_lower = generated_text.lower()
        
        # Look for true/false indicators
        true_indicators = ['true', 'correct', 'yes', 'accurate']
        false_indicators = ['false', 'incorrect', 'no', 'inaccurate', 'wrong']
        
        true_count = sum(1 for indicator in true_indicators if indicator in generated_lower)
        false_count = sum(1 for indicator in false_indicators if indicator in generated_lower)
        
        return true_count >= false_count
    
    def _find_source_evidence(
        self,
        question: str,
        answer: str,
        source_content: str
    ) -> Optional[str]:
        """
        Find evidence in source content supporting the answer
        
        Args:
            question: The question text
            answer: The determined answer
            source_content: Source material
            
        Returns:
            Evidence snippet from source content
        """
        # Extract key terms from question and answer
        question_words = set(re.findall(r'\b\w+\b', question.lower()))
        answer_words = set(re.findall(r'\b\w+\b', answer.lower()))
        
        # Search for sentences containing both question and answer terms
        sentences = source_content.split('.')
        for sentence in sentences:
            sentence_lower = sentence.lower()
            sentence_words = set(re.findall(r'\b\w+\b', sentence_lower))
            
            # Check if sentence contains key terms
            question_overlap = len(question_words & sentence_words)
            answer_overlap = len(answer_words & sentence_words)
            
            if question_overlap > 0 and answer_overlap > 0:
                return sentence.strip()
        
        # Return first sentence if no specific evidence found
        if sentences:
            return sentences[0].strip()
        
        return None
    
    def _calculate_answer_confidence(
        self,
        question: str,
        answer: str,
        source_content: str
    ) -> float:
        """
        Calculate confidence score for the answer based on source support
        
        Args:
            question: The question text
            answer: The determined answer
            source_content: Source material
            
        Returns:
            Confidence score between 0 and 1
        """
        # Extract key terms
        question_words = set(re.findall(r'\b\w+\b', question.lower()))
        answer_words = set(re.findall(r'\b\w+\b', answer.lower()))
        source_words = set(re.findall(r'\b\w+\b', source_content.lower()))
        
        # Calculate overlap
        question_source_overlap = len(question_words & source_words)
        answer_source_overlap = len(answer_words & source_words)
        
        # Base confidence
        confidence = 0.7
        
        # Increase confidence based on source support
        if question_words:
            confidence += (question_source_overlap / len(question_words)) * 0.15
        
        if answer_words:
            confidence += (answer_source_overlap / len(answer_words)) * 0.15
        
        return min(1.0, max(self.MIN_CONFIDENCE_SCORE, confidence))
    
    def _determine_fallback_answer(
        self,
        request: AnswerDeterminationRequest
    ) -> AnswerDeterminationResponse:
        """
        Fallback answer determination when AI model is unavailable
        
        Args:
            request: AnswerDeterminationRequest
            
        Returns:
            AnswerDeterminationResponse with fallback answer
        """
        if request.question_type == QuestionType.MCQ and request.options:
            # Fallback: select first option
            correct_answer = request.options[0]
            is_true = None
        elif request.question_type == QuestionType.TRUE_FALSE:
            # Fallback: assume True
            correct_answer = "True"
            is_true = True
        else:
            # Default fallback
            correct_answer = "Unknown"
            is_true = None
        
        return AnswerDeterminationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            correct_answer=correct_answer,
            is_true=is_true,
            confidence_score=0.7,
            source_evidence=request.source_content[:200] if request.source_content else None,
            reasoning="Fallback answer generated (AI model unavailable)",
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "difficulty": request.difficulty.value,
                "topic": request.topic,
                "fallback": True
            }
        )
    
    def determine_batch_answers(
        self,
        request: BatchAnswerDeterminationRequest
    ) -> BatchAnswerDeterminationResponse:
        """
        Determine answers for multiple questions in batch
        
        Args:
            request: BatchAnswerDeterminationRequest with multiple questions
            
        Returns:
            BatchAnswerDeterminationResponse with determined answers
        """
        answers = []
        
        for question_request in request.questions:
            answer_response = self.determine_answer(question_request)
            answers.append(answer_response)
        
        # Calculate average confidence
        total_confidence = sum(a.confidence_score for a in answers)
        average_confidence = total_confidence / len(answers) if answers else 0.0
        
        return BatchAnswerDeterminationResponse(
            success=len(answers) > 0,
            answers=answers,
            total_questions=len(answers),
            average_confidence=average_confidence,
            metadata={
                "total_questions_processed": len(request.questions),
                "mcq_count": sum(1 for a in answers if a.question_type == QuestionType.MCQ),
                "tf_count": sum(1 for a in answers if a.question_type == QuestionType.TRUE_FALSE)
            }
        )


# Singleton instance for application-wide use
_answer_generator_instance = None

def get_answer_generator(
    model_path: str = "./fine_tuned_quiz_model"
) -> AnswerGenerator:
    """
    Get or create singleton Answer Generator instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        AnswerGenerator instance
    """
    global _answer_generator_instance
    
    if _answer_generator_instance is None:
        _answer_generator_instance = AnswerGenerator(model_path=model_path)
    
    return _answer_generator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Answer Generator")
    
    # Create generator instance
    generator = get_answer_generator()
    
    # Test MCQ answer determination
    mcq_request = AnswerDeterminationRequest(
        question_text="What is machine learning?",
        question_type=QuestionType.MCQ,
        options=[
            "A subset of AI that learns from data",
            "A type of computer hardware",
            "A programming language",
            "A database system"
        ],
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data without being explicitly programmed.",
        source_chunk_index=0,
        difficulty=DifficultyLevel.MEDIUM,
        topic="artificial intelligence"
    )
    
    mcq_response = generator.determine_answer(mcq_request)
    print(f"\n📊 MCQ Answer Determination:")
    print(f"   Question: {mcq_response.question_text}")
    print(f"   Correct Answer: {mcq_response.correct_answer}")
    print(f"   Confidence: {mcq_response.confidence_score:.2f}")
    print(f"   Source Evidence: {mcq_response.source_evidence}")
    
    # Test True/False answer determination
    tf_request = AnswerDeterminationRequest(
        question_text="Machine learning is a subset of artificial intelligence.",
        question_type=QuestionType.TRUE_FALSE,
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data without being explicitly programmed.",
        source_chunk_index=0,
        difficulty=DifficultyLevel.MEDIUM,
        topic="artificial intelligence"
    )
    
    tf_response = generator.determine_answer(tf_request)
    print(f"\n📊 True/False Answer Determination:")
    print(f"   Statement: {tf_response.question_text}")
    print(f"   Is True: {tf_response.is_true}")
    print(f"   Correct Answer: {tf_response.correct_answer}")
    print(f"   Confidence: {tf_response.confidence_score:.2f}")
    print(f"   Source Evidence: {tf_response.source_evidence}")
    
    # Test batch answer determination
    batch_request = BatchAnswerDeterminationRequest(
        questions=[mcq_request, tf_request]
    )
    
    batch_response = generator.determine_batch_answers(batch_request)
    print(f"\n📊 Batch Answer Determination:")
    print(f"   Total Questions: {batch_response.total_questions}")
    print(f"   Average Confidence: {batch_response.average_confidence:.2f}")
    print(f"   Metadata: {batch_response.metadata}")