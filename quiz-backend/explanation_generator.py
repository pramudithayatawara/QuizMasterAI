"""
Priority 27: Generate Explanations Service Module

This module implements explanation generation for quiz answers, creating clear,
educational explanations that reference the original source content.

Features:
- AI-powered explanation generation using source material
- Support for MCQ, True/False, and Mixed question types
- Source content referencing
- Educational explanation formatting
- Pydantic models for request/response validation
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


class ExplanationGenerationRequest(BaseModel):
    """Request model for explanation generation"""
    question_text: str = Field(..., description="The question text or statement")
    question_type: QuestionType = Field(..., description="Type of question (MCQ or True/False)")
    correct_answer: str = Field(..., description="The correct answer")
    options: Optional[List[str]] = Field(None, description="Options for MCQ questions")
    source_content: str = Field(..., description="Source material to reference in explanation")
    source_chunk_index: int = Field(default=0, description="Index of source chunk used")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM)
    topic: Optional[str] = Field(None, description="Topic of the question")
    explanation_length: str = Field(
        default="medium",
        description="Length of explanation (short, medium, long)"
    )
    
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
    
    @field_validator('explanation_length')
    @classmethod
    def validate_explanation_length(cls, v):
        """Ensure explanation length is valid"""
        valid_lengths = ['short', 'medium', 'long']
        if v.lower() not in valid_lengths:
            raise ValueError(f"Explanation length must be one of: {valid_lengths}")
        return v.lower()


class ExplanationGenerationResponse(BaseModel):
    """Response model for explanation generation"""
    success: bool = Field(..., description="Whether explanation generation was successful")
    question_text: str = Field(..., description="The question text")
    question_type: QuestionType = Field(..., description="Type of question")
    correct_answer: str = Field(..., description="The correct answer")
    explanation: str = Field(..., description="The generated explanation")
    source_reference: Optional[str] = Field(None, description="Reference to source content")
    key_concepts: List[str] = Field(default_factory=list, description="Key concepts explained")
    difficulty_level: str = Field(default="medium", description="Difficulty level of explanation")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BatchExplanationGenerationRequest(BaseModel):
    """Request model for batch explanation generation"""
    questions: List[ExplanationGenerationRequest] = Field(
        ...,
        description="List of questions to generate explanations for",
        min_items=1
    )
    
    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        """Ensure questions list is not empty"""
        if not v:
            raise ValueError("Questions list cannot be empty")
        return v


class BatchExplanationGenerationResponse(BaseModel):
    """Response model for batch explanation generation"""
    success: bool = Field(..., description="Whether batch generation was successful")
    explanations: List[ExplanationGenerationResponse] = Field(..., description="Generated explanations")
    total_questions: int = Field(..., description="Total number of questions")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ExplanationGenerator:
    """
    Explanation Generator Service
    
    Business Rules:
    1. Create clear, educational explanations for correct answers
    2. Reference original source content
    3. Use AI model for explanation generation
    4. Support different explanation lengths
    5. Support MCQ and True/False question types
    """
    
    EXPLANATION_LENGTHS = {
        'short': 50,      # ~50 words
        'medium': 100,    # ~100 words
        'long': 200       # ~200 words
    }
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize Explanation Generator
        
        Args:
            model_path: Path to fine-tuned model
            tokenizer_path: Path to tokenizer (defaults to model_path)
        """
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path or model_path
        
        if TRANSFORMERS_AVAILABLE:
            print(f"🤖 Loading Explanation Generator model from {model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ Explanation Generator model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None
    
    def generate_explanation(
        self,
        request: ExplanationGenerationRequest
    ) -> ExplanationGenerationResponse:
        """
        Generate an explanation for the correct answer based on source content
        
        Args:
            request: ExplanationGenerationRequest with question and source content
            
        Returns:
            ExplanationGenerationResponse with generated explanation
        """
        if not TRANSFORMERS_AVAILABLE or self.model is None:
            return self._generate_fallback_explanation(request)
        
        try:
            if request.question_type == QuestionType.MCQ:
                return self._generate_mcq_explanation(request)
            elif request.question_type == QuestionType.TRUE_FALSE:
                return self._generate_tf_explanation(request)
            else:
                return self._generate_fallback_explanation(request)
                
        except Exception as e:
            print(f"⚠️ Error generating explanation: {e}")
            return self._generate_fallback_explanation(request)
    
    def _generate_mcq_explanation(
        self,
        request: ExplanationGenerationRequest
    ) -> ExplanationGenerationResponse:
        """
        Generate explanation for MCQ question using AI model
        
        Args:
            request: ExplanationGenerationRequest for MCQ question
            
        Returns:
            ExplanationGenerationResponse with generated explanation
        """
        # Format input for MCQ explanation generation
        options_text = "\n".join([f"{chr(65+i)}. {opt}" for i, opt in enumerate(request.options)])
        length_hint = self.EXPLANATION_LENGTHS.get(request.explanation_length, 100)
        
        input_text = (
            f"Question: {request.question_text}\n"
            f"Correct Answer: {request.correct_answer}\n"
            f"Options:\n{options_text}\n"
            f"Source: {request.source_content[:500]}\n"
            f"Generate a clear, educational explanation for why this is the correct answer. "
            f"Reference the source content. Keep it approximately {length_hint} words."
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
            max_length=200,
            num_beams=4,
            no_repeat_ngram_size=2,
            early_stopping=True,
            temperature=0.7,
            do_sample=True
        )
        
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse generated explanation
        explanation = self._parse_explanation(generated_text)
        
        # Extract source reference
        source_reference = self._extract_source_reference(
            request.question_text,
            request.correct_answer,
            request.source_content
        )
        
        # Extract key concepts
        key_concepts = self._extract_key_concepts(
            request.question_text,
            request.correct_answer,
            request.source_content
        )
        
        return ExplanationGenerationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            correct_answer=request.correct_answer,
            explanation=explanation,
            source_reference=source_reference,
            key_concepts=key_concepts,
            difficulty_level=request.difficulty.value,
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "topic": request.topic,
                "explanation_length": request.explanation_length
            }
        )
    
    def _generate_tf_explanation(
        self,
        request: ExplanationGenerationRequest
    ) -> ExplanationGenerationResponse:
        """
        Generate explanation for True/False question using AI model
        
        Args:
            request: ExplanationGenerationRequest for True/False question
            
        Returns:
            ExplanationGenerationResponse with generated explanation
        """
        # Format input for True/False explanation generation
        length_hint = self.EXPLANATION_LENGTHS.get(request.explanation_length, 100)
        
        input_text = (
            f"Statement: {request.question_text}\n"
            f"Answer: {request.correct_answer}\n"
            f"Source: {request.source_content[:500]}\n"
            f"Generate a clear, educational explanation for why this statement is {request.correct_answer}. "
            f"Reference the source content. Keep it approximately {length_hint} words."
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
            max_length=200,
            num_beams=4,
            no_repeat_ngram_size=2,
            early_stopping=True,
            temperature=0.7,
            do_sample=True
        )
        
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Parse generated explanation
        explanation = self._parse_explanation(generated_text)
        
        # Extract source reference
        source_reference = self._extract_source_reference(
            request.question_text,
            request.correct_answer,
            request.source_content
        )
        
        # Extract key concepts
        key_concepts = self._extract_key_concepts(
            request.question_text,
            request.correct_answer,
            request.source_content
        )
        
        return ExplanationGenerationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            correct_answer=request.correct_answer,
            explanation=explanation,
            source_reference=source_reference,
            key_concepts=key_concepts,
            difficulty_level=request.difficulty.value,
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "topic": request.topic,
                "explanation_length": request.explanation_length
            }
        )
    
    def _parse_explanation(self, generated_text: str) -> str:
        """
        Parse generated text to extract explanation
        
        Args:
            generated_text: Text generated by AI model
            
        Returns:
            The parsed explanation
        """
        # Remove common prefixes
        prefixes_to_remove = [
            "Explanation:",
            "The explanation is:",
            "Here is the explanation:",
            "Answer explanation:",
            "Correct answer explanation:"
        ]
        
        explanation = generated_text.strip()
        for prefix in prefixes_to_remove:
            if explanation.lower().startswith(prefix.lower()):
                explanation = explanation[len(prefix):].strip()
        
        # Ensure explanation is not empty
        if not explanation:
            explanation = "This answer is correct based on the source material provided."
        
        return explanation
    
    def _extract_source_reference(
        self,
        question: str,
        answer: str,
        source_content: str
    ) -> Optional[str]:
        """
        Extract relevant reference from source content
        
        Args:
            question: The question text
            answer: The correct answer
            source_content: Source material
            
        Returns:
            Reference snippet from source content
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
        
        # Return first sentence if no specific reference found
        if sentences:
            return sentences[0].strip()
        
        return None
    
    def _extract_key_concepts(
        self,
        question: str,
        answer: str,
        source_content: str
    ) -> List[str]:
        """
        Extract key concepts from question, answer, and source content
        
        Args:
            question: The question text
            answer: The correct answer
            source_content: Source material
            
        Returns:
            List of key concepts
        """
        # Extract important terms (words with 3+ characters)
        all_text = f"{question} {answer} {source_content}"
        words = re.findall(r'\b[a-zA-Z]{3,}\b', all_text.lower())
        
        # Count word frequency
        word_counts = {}
        for word in words:
            word_counts[word] = word_counts.get(word, 0) + 1
        
        # Sort by frequency and get top concepts
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Filter out common words
        common_words = {
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
            'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'this',
            'that', 'with', 'they', 'from', 'will', 'would', 'there', 'their',
            'what', 'about', 'which', 'when', 'make', 'like', 'into', 'year',
            'your', 'just', 'over', 'also', 'such', 'because', 'these', 'first'
        }
        
        key_concepts = []
        for word, count in sorted_words:
            if word not in common_words and count >= 2:
                key_concepts.append(word.capitalize())
                if len(key_concepts) >= 5:  # Limit to top 5 concepts
                    break
        
        return key_concepts
    
    def _generate_fallback_explanation(
        self,
        request: ExplanationGenerationRequest
    ) -> ExplanationGenerationResponse:
        """
        Fallback explanation generation when AI model is unavailable
        
        Args:
            request: ExplanationGenerationRequest
            
        Returns:
            ExplanationGenerationResponse with fallback explanation
        """
        # Generate simple explanation based on source content
        source_reference = self._extract_source_reference(
            request.question_text,
            request.correct_answer,
            request.source_content
        )
        
        key_concepts = self._extract_key_concepts(
            request.question_text,
            request.correct_answer,
            request.source_content
        )
        
        # Build fallback explanation
        if request.question_type == QuestionType.MCQ:
            explanation = (
                f"The correct answer is '{request.correct_answer}'. "
                f"This is supported by the source material, which states that "
                f"{source_reference[:100] if source_reference else 'relevant information is provided in the content'}."
            )
        else:  # True/False
            explanation = (
                f"The statement is {request.correct_answer}. "
                f"This is confirmed by the source material, which indicates that "
                f"{source_reference[:100] if source_reference else 'relevant information is provided in the content'}."
            )
        
        return ExplanationGenerationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            correct_answer=request.correct_answer,
            explanation=explanation,
            source_reference=source_reference,
            key_concepts=key_concepts,
            difficulty_level=request.difficulty.value,
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "topic": request.topic,
                "explanation_length": request.explanation_length,
                "fallback": True
            }
        )
    
    def generate_batch_explanations(
        self,
        request: BatchExplanationGenerationRequest
    ) -> BatchExplanationGenerationResponse:
        """
        Generate explanations for multiple questions in batch
        
        Args:
            request: BatchExplanationGenerationRequest with multiple questions
            
        Returns:
            BatchExplanationGenerationResponse with generated explanations
        """
        explanations = []
        
        for question_request in request.questions:
            explanation_response = self.generate_explanation(question_request)
            explanations.append(explanation_response)
        
        return BatchExplanationGenerationResponse(
            success=len(explanations) > 0,
            explanations=explanations,
            total_questions=len(explanations),
            metadata={
                "total_questions_processed": len(request.questions),
                "mcq_count": sum(1 for e in explanations if e.question_type == QuestionType.MCQ),
                "tf_count": sum(1 for e in explanations if e.question_type == QuestionType.TRUE_FALSE)
            }
        )


# Singleton instance for application-wide use
_explanation_generator_instance = None

def get_explanation_generator(
    model_path: str = "./fine_tuned_quiz_model"
) -> ExplanationGenerator:
    """
    Get or create singleton Explanation Generator instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        ExplanationGenerator instance
    """
    global _explanation_generator_instance
    
    if _explanation_generator_instance is None:
        _explanation_generator_instance = ExplanationGenerator(model_path=model_path)
    
    return _explanation_generator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Explanation Generator")
    
    # Create generator instance
    generator = get_explanation_generator()
    
    # Test MCQ explanation generation
    mcq_request = ExplanationGenerationRequest(
        question_text="What is machine learning?",
        question_type=QuestionType.MCQ,
        correct_answer="A subset of AI that learns from data",
        options=[
            "A subset of AI that learns from data",
            "A type of computer hardware",
            "A programming language",
            "A database system"
        ],
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data without being explicitly programmed.",
        source_chunk_index=0,
        difficulty=DifficultyLevel.MEDIUM,
        topic="artificial intelligence",
        explanation_length="medium"
    )
    
    mcq_response = generator.generate_explanation(mcq_request)
    print(f"\n📊 MCQ Explanation Generation:")
    print(f"   Question: {mcq_response.question_text}")
    print(f"   Correct Answer: {mcq_response.correct_answer}")
    print(f"   Explanation: {mcq_response.explanation}")
    print(f"   Source Reference: {mcq_response.source_reference}")
    print(f"   Key Concepts: {mcq_response.key_concepts}")
    
    # Test True/False explanation generation
    tf_request = ExplanationGenerationRequest(
        question_text="Machine learning is a subset of artificial intelligence.",
        question_type=QuestionType.TRUE_FALSE,
        correct_answer="True",
        source_content="Machine learning is a subset of artificial intelligence that enables systems to learn from data without being explicitly programmed.",
        source_chunk_index=0,
        difficulty=DifficultyLevel.MEDIUM,
        topic="artificial intelligence",
        explanation_length="medium"
    )
    
    tf_response = generator.generate_explanation(tf_request)
    print(f"\n📊 True/False Explanation Generation:")
    print(f"   Statement: {tf_response.question_text}")
    print(f"   Correct Answer: {tf_response.correct_answer}")
    print(f"   Explanation: {tf_response.explanation}")
    print(f"   Source Reference: {tf_response.source_reference}")
    print(f"   Key Concepts: {tf_response.key_concepts}")
    
    # Test batch explanation generation
    batch_request = BatchExplanationGenerationRequest(
        questions=[mcq_request, tf_request]
    )
    
    batch_response = generator.generate_batch_explanations(batch_request)
    print(f"\n📊 Batch Explanation Generation:")
    print(f"   Total Questions: {batch_response.total_questions}")
    print(f"   Metadata: {batch_response.metadata}")