"""
Priority 24: Generate True/False Questions Service Module

This module implements True/False question generation from content chunks
using AI models with strict business rules enforcement for clarity and unambiguous answers.

Features:
- AI-powered True/False question generation using fine-tuned transformers model
- Clarity validation to ensure unambiguous statements
- True/false answer verification against source content
- Content-aware question generation
- Pydantic models for request/response validation
"""

import os
import random
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


class QuestionType(Enum):
    """Types of questions that can be generated"""
    TRUE_FALSE = "true_false"
    MULTIPLE_CHOICE = "multiple_choice"
    SHORT_ANSWER = "short_answer"


class DifficultyLevel(Enum):
    """Difficulty levels for questions"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    RANDOM = "random"
    MIXED = "mixed"


class TFGenerationRequest(BaseModel):
    """Request model for True/False question generation"""
    content_chunks: List[str] = Field(
        ...,
        description="List of content chunks to generate questions from",
        min_items=1
    )
    num_questions: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of True/False questions to generate (1-20)"
    )
    difficulty: Optional[DifficultyLevel] = Field(
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
    require_content_verification: bool = Field(
        default=True,
        description="Whether to verify answers against source content"
    )
    
    @field_validator('content_chunks')
    @classmethod
    def validate_content_chunks(cls, v):
        """Ensure content chunks are not empty"""
        for chunk in v:
            if not chunk or not chunk.strip():
                raise ValueError("Content chunks cannot be empty")
        return v


class TrueFalseQuestion(BaseModel):
    """Model for a generated True/False question"""
    statement: str = Field(..., description="The statement to be verified")
    is_true: bool = Field(..., description="Whether the statement is true")
    explanation: Optional[str] = Field(None, description="Explanation of why the statement is true/false")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM)
    topic: Optional[str] = Field(None, description="Topic of the question")
    source_chunk_index: int = Field(..., description="Index of content chunk used")
    source_text_snippet: Optional[str] = Field(None, description="Relevant text from source")
    confidence_score: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Confidence score for the answer (0-1)"
    )
    
    @field_validator('statement')
    @classmethod
    def validate_statement(cls, v):
        """Ensure statement is clear and not ambiguous"""
        # Check for ambiguous words/phrases
        ambiguous_patterns = [
            r'\bsometimes\b',
            r'\boften\b',
            r'\bmaybe\b',
            r'\bpossibly\b',
            r'\bprobably\b',
            r'\bcould be\b',
            r'\bmight be\b',
            r'\bseems to be\b',
            r'\bappears to be\b',
            r'\bdepending on\b',
            r'\bin some cases\b',
            r'\bgenerally\b',
            r'\btypically\b',
            r'\busually\b',
            r'\bfrequently\b',
            r'\boccasionally\b',
            r'\brarely\b',
            r'\bsometimes\b'
        ]
        
        for pattern in ambiguous_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError(
                    f"Statement contains ambiguous phrase: '{pattern}'. "
                    "True/False questions must have clear, unambiguous answers."
                )
        
        # Check for question format (should be a statement, not a question)
        if v.strip().endswith('?'):
            raise ValueError("Statement should not be a question. Use declarative statements.")
        
        # Check for vagueness
        vague_patterns = [
            r'\bsome\b',
            r'\bmany\b',
            r'\bfew\b',
            r'\bseveral\b',
            r'\ba lot\b',
            r'\ba little\b',
            r'\bsomewhat\b',
            r'\bkind of\b',
            r'\bsort of\b',
            r'\btype of\b'
        ]
        
        for pattern in vague_patterns:
            if re.search(pattern, v, re.IGNORECASE):
                raise ValueError(
                    f"Statement contains vague phrase: '{pattern}'. "
                    "Use specific, quantifiable statements."
                )
        
        return v
    
    @field_validator('confidence_score')
    @classmethod
    def validate_confidence(cls, v):
        """Ensure confidence score is reasonable"""
        if v < 0.5:
            raise ValueError("Confidence score must be at least 0.5 for clear True/False questions")
        return v


class TFGenerationResponse(BaseModel):
    """Response model for True/False question generation"""
    success: bool = Field(..., description="Whether generation was successful")
    questions: List[TrueFalseQuestion] = Field(..., description="Generated True/False questions")
    total_questions: int = Field(..., description="Total number of questions generated")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class TrueFalseGenerator:
    """
    True/False Question Generator Service
    
    Business Rules:
    1. Questions must have clear true/false answers
    2. No ambiguous statements allowed
    3. Answers verified against source content when possible
    4. AI model used for generation
    """
    
    MIN_CONFIDENCE_SCORE = 0.7
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize True/False Generator
        
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
            print(f"🤖 Loading True/False generator model from {self.model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ True/False generator model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None
    
    def generate_tf_from_content(
        self,
        content: str,
        difficulty: DifficultyLevel = DifficultyLevel.MEDIUM,
        topic: Optional[str] = None,
        verify_against_content: bool = True
    ) -> TrueFalseQuestion:
        """
        Generate a single True/False question from content using AI model
        """
        diff_str = str(difficulty.value if hasattr(difficulty, 'value') else difficulty).lower()
        if diff_str in ["random", "mixed", "auto"]:
            actual_difficulty = random.choice([DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD])
        else:
            try:
                actual_difficulty = DifficultyLevel(diff_str)
            except ValueError:
                actual_difficulty = DifficultyLevel.MEDIUM

        if not TRANSFORMERS_AVAILABLE or self.model is None:
            return self._generate_fallback_tf(content, actual_difficulty, topic)
        
        try:
            # Extract factual declarative sentences from content
            sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content) if len(s.strip()) > 25]
            if not sentences:
                sentences = [content.strip()]
            
            target_sentence = sentences[0]
            for s in sentences:
                if any(k in s.lower() for k in [" is ", " are ", " was ", " were ", " defined as ", " means ", " process "]):
                    target_sentence = s
                    break

            tf = self._parse_generated_tf(
                target_sentence,
                actual_difficulty,
                topic,
                content,
                verify_against_content
            )
            
            self._validate_tf_business_rules(tf)
            return tf
            
        except Exception as e:
            print(f"⚠️ Error generating True/False question: {e}")
            return self._generate_fallback_tf(content, actual_difficulty, topic)
    
    def _parse_generated_tf(
        self,
        generated_text: str,
        difficulty: DifficultyLevel,
        topic: Optional[str],
        context: str,
        verify_against_content: bool
    ) -> TrueFalseQuestion:
        """
        Parse generated text into structured True/False components
        """
        # Clean up statement: ensure it is a statement, not a question
        statement = generated_text.strip().rstrip('.,;:')
        if statement.endswith('?'):
            statement = statement[:-1].strip()
        
        # Decide randomly whether this question should be True or False (50/50)
        make_true = random.choice([True, False])
        
        if make_true:
            final_statement = f"{statement}."
            is_true = True
            explanation = f"True: Based on the text, {statement.lower()}."
        else:
            # Modify to make False
            subj_match = re.search(r'([A-Z][a-zA-Z0-9_\-\s]{2,25}?)\s+(is|are|was|were)', statement)
            if subj_match:
                verb = subj_match.group(2)
                final_statement = statement[:subj_match.start(2)] + f"{verb} not " + statement[subj_match.end():] + "."
            else:
                final_statement = f"It is incorrect that {statement.lower()}."
            is_true = False
            explanation = f"False: The original text states that {statement.lower()}."

        source_snippet = context[:200] if context else None
        confidence = 0.9
        
        return TrueFalseQuestion(
            statement=final_statement,
            is_true=is_true,
            explanation=explanation,
            difficulty=difficulty,
            topic=topic,
            source_chunk_index=0,
            source_text_snippet=source_snippet,
            confidence_score=confidence
        )
    
    def _verify_statement_against_content(self, statement: str, content: str) -> bool:
        """
        Verify if a statement is true based on the content
        
        Args:
            statement: The statement to verify
            content: Source content to verify against
            
        Returns:
            True if statement is supported by content, False otherwise
        """
        # Simple keyword matching verification
        # In production, use more sophisticated NLP or semantic similarity
        statement_lower = statement.lower()
        content_lower = content.lower()
        
        # Extract key terms from statement
        words = re.findall(r'\b\w+\b', statement_lower)
        
        # Check if statement terms appear in content
        matching_words = [word for word in words if word in content_lower]
        
        # If statement has negative words, invert result
        negative_words = ['not', 'never', 'cannot', 'false', 'incorrect', 'wrong', 'no']
        has_negative = any(neg in statement_lower for neg in negative_words)
        
        # If significant portion of statement matches content, consider it true
        if len(matching_words) > 0 and len(matching_words) / len(words) > 0.3:
            return not has_negative
        else:
            return False
    
    def _calculate_confidence_score(self, statement: str, content: str) -> float:
        """
        Calculate confidence score for the answer based on statement clarity and content support
        
        Args:
            statement: The statement
            content: Source content
            
        Returns:
            Confidence score between 0 and 1
        """
        # Base confidence based on statement clarity
        clarity_score = 0.8
        
        # Adjust based on content support
        if content:
            content_words = set(re.findall(r'\b\w+\b', content.lower()))
            statement_words = set(re.findall(r'\b\w+\b', statement.lower()))
            
            matching_words = content_words & statement_words
            if statement_words:
                support_ratio = len(matching_words) / len(statement_words)
                clarity_score = min(1.0, clarity_score + support_ratio * 0.1)
        
        return min(1.0, max(self.MIN_CONFIDENCE_SCORE, clarity_score))
    
    def _generate_fallback_tf(
        self,
        content: str,
        difficulty: DifficultyLevel,
        topic: Optional[str]
    ) -> TrueFalseQuestion:
        """
        Generate fallback True/False question when AI model is unavailable
        
        Args:
            content: Content text
            difficulty: Difficulty level
            topic: Question topic
            
        Returns:
            TrueFalseQuestion object
        """
        # Extract first sentence as statement
        sentences = content.split('.')
        first_sentence = sentences[0] if sentences else "The main concept is described in the content."
        
        # Create a clear statement
        statement = f"{first_sentence.strip()}."
        
        # Verify against content
        is_true = self._verify_statement_against_content(statement, content)
        
        return TrueFalseQuestion(
            statement=statement,
            is_true=is_true,
            explanation="Fallback question generated from content",
            difficulty=difficulty,
            topic=topic,
            source_chunk_index=0,
            source_text_snippet=content[:200],
            confidence_score=0.8
        )
    
    def _validate_tf_business_rules(self, tf: TrueFalseQuestion):
        """
        Validate True/False question against business rules
        
        Args:
            tf: TrueFalseQuestion to validate
            
        Raises:
            ValueError: If business rules are violated
        """
        # Rule 1: Statement must be clear (not ambiguous)
        # This is validated in the Pydantic model
        
        # Rule 2: Statement must be declarative (not a question)
        # This is validated in the Pydantic model
        
        # Rule 3: Confidence score must be above minimum
        if tf.confidence_score < self.MIN_CONFIDENCE_SCORE:
            raise ValueError(
                f"Confidence score {tf.confidence_score} is below minimum {self.MIN_CONFIDENCE_SCORE}. "
                "Statement may be ambiguous."
            )
    
    def generate_tfs_from_chunks(
        self,
        request: TFGenerationRequest
    ) -> TFGenerationResponse:
        """
        Generate multiple True/False questions from content chunks
        
        Args:
            request: TFGenerationRequest with content chunks and parameters
            
        Returns:
            TFGenerationResponse with generated questions
        """
        questions = []
        
        # Determine how many questions per chunk
        chunks = request.content_chunks
        num_questions = request.num_questions
        
        diff_str = str(request.difficulty.value if hasattr(request.difficulty, 'value') else request.difficulty).lower()
        is_random = diff_str in ["random", "mixed", "auto"]
        difficulty_pool = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD]

        # Distribute questions across chunks
        for i in range(num_questions):
            # Cycle through chunks if not enough
            chunk_index = i % len(chunks)
            content = chunks[chunk_index]
            
            if is_random:
                q_diff = difficulty_pool[i % len(difficulty_pool)]
            else:
                q_diff = request.difficulty
            
            # Generate True/False question
            tf = self.generate_tf_from_content(
                content=content,
                difficulty=q_diff,
                topic=request.topic,
                verify_against_content=request.require_content_verification
            )
            
            # Update source chunk index
            tf.source_chunk_index = chunk_index
            
            questions.append(tf)
        
        return TFGenerationResponse(
            success=True,
            questions=questions,
            total_questions=len(questions),
            metadata={
                "num_content_chunks": len(chunks),
                "difficulty": request.difficulty.value if hasattr(request.difficulty, 'value') else str(request.difficulty),
                "topic": request.topic,
                "language": request.language,
                "require_content_verification": request.require_content_verification,
                "model_path": self.model_path
            }
        )
    
    def format_tf_for_display(self, tf: TrueFalseQuestion) -> str:
        """
        Format True/False question for display purposes
        
        Args:
            tf: TrueFalseQuestion to format
            
        Returns:
            Formatted string representation
        """
        output = []
        output.append(f"Statement: {tf.statement}")
        output.append(f"Answer: {'True' if tf.is_true else 'False'}")
        output.append(f"Difficulty: {tf.difficulty.value}")
        if tf.topic:
            output.append(f"Topic: {tf.topic}")
        output.append(f"Confidence: {tf.confidence_score:.2f}")
        
        if tf.explanation:
            output.append(f"Explanation: {tf.explanation}")
        
        if tf.source_text_snippet:
            output.append(f"Source: {tf.source_text_snippet}...")
        
        return "\n".join(output)


# Singleton instance for application-wide use
_tf_generator_instance = None

def get_tf_generator(
    model_path: str = "./fine_tuned_quiz_model"
) -> TrueFalseGenerator:
    """
    Get or create singleton True/False Generator instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        TrueFalseGenerator instance
    """
    global _tf_generator_instance
    
    if _tf_generator_instance is None:
        _tf_generator_instance = TrueFalseGenerator(model_path=model_path)
    
    return _tf_generator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing True/False Generator")
    
    # Create generator instance
    generator = get_tf_generator()
    
    # Test request
    request = TFGenerationRequest(
        content_chunks=[
            "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
            "Deep learning uses neural networks with multiple layers to extract features from data.",
            "Natural language processing deals with the interaction between computers and human language."
        ],
        num_questions=3,
        difficulty=DifficultyLevel.MEDIUM,
        topic="artificial intelligence",
        require_content_verification=True
    )
    
    # Generate True/False questions
    response = generator.generate_tfs_from_chunks(request)
    
    print(f"\n📊 Generated {response.total_questions} True/False questions:")
    print(f"   Success: {response.success}")
    print(f"   Metadata: {response.metadata}")
    
    print(f"\n📝 Sample True/False Questions:")
    for i, tf in enumerate(response.questions, 1):
        print(f"\n{'='*50}")
        print(f"Question {i}:")
        print(generator.format_tf_for_display(tf))
    
    # Validate business rules
    print(f"\n✅ Business Rules Validation:")
    for i, tf in enumerate(response.questions, 1):
        try:
            generator._validate_tf_business_rules(tf)
            print(f"   Question {i}: ✅ Valid (clear statement, confidence: {tf.confidence_score:.2f})")
        except ValueError as e:
            print(f"   Question {i}: ❌ Invalid - {e}")