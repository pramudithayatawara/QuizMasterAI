"""
Priority 31: Categorize Question Difficulty Service Module

This module implements question difficulty categorization based on complexity and depth,
categorizing questions into Easy (basic recall), Medium (application), or Hard (analysis/synthesis).

Features:
- AI-powered difficulty analysis using complexity metrics
- Question complexity scoring
- Depth assessment (recall, application, analysis, synthesis)
- Difficulty categorization (Easy, Medium, Hard)
- Configurable thresholds
- Pydantic models for request/response validation
"""

from typing import List, Optional, Dict, Any, Tuple
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


class DifficultyCategory(Enum):
    """Difficulty categories for questions"""
    EASY = "easy"  # Basic recall
    MEDIUM = "medium"  # Application
    HARD = "hard"  # Analysis/synthesis


class CognitiveLevel(Enum):
    """Bloom's Taxonomy cognitive levels"""
    REMEMBER = "remember"  # Basic recall
    UNDERSTAND = "understand"  # Comprehension
    APPLY = "apply"  # Application
    ANALYZE = "analyze"  # Analysis
    EVALUATE = "evaluate"  # Evaluation
    CREATE = "create"  # Synthesis/creation


class DifficultyCategorizationRequest(BaseModel):
    """Request model for difficulty categorization"""
    question_text: str = Field(..., description="The question text or statement")
    question_type: str = Field(..., description="Type of question (mcq, true_false, mixed)")
    options: Optional[List[str]] = Field(None, description="Options for MCQ questions")
    source_content: Optional[str] = Field(None, description="Source content for context")
    source_chunk_index: int = Field(default=0, description="Index of source chunk used")
    topic: Optional[str] = Field(None, description="Topic of the question")
    
    @field_validator('question_text')
    @classmethod
    def validate_question_text(cls, v):
        """Ensure question text is not empty"""
        if not v or not v.strip():
            raise ValueError("Question text cannot be empty")
        return v


class DifficultyCategorizationResponse(BaseModel):
    """Response model for difficulty categorization"""
    success: bool = Field(..., description="Whether categorization was successful")
    question_text: str = Field(..., description="The question text")
    question_type: str = Field(..., description="Type of question")
    difficulty: DifficultyCategory = Field(..., description="Categorized difficulty")
    cognitive_level: CognitiveLevel = Field(..., description="Bloom's taxonomy level")
    difficulty_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Numeric difficulty score (0-1)"
    )
    complexity_metrics: Dict[str, float] = Field(
        default_factory=dict,
        description="Complexity metrics breakdown"
    )
    reasoning: str = Field(..., description="Reasoning for difficulty categorization")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BatchDifficultyCategorizationRequest(BaseModel):
    """Request model for batch difficulty categorization"""
    questions: List[DifficultyCategorizationRequest] = Field(
        ...,
        description="List of questions to categorize",
        min_items=1
    )
    
    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        """Ensure questions list is not empty"""
        if not v:
            raise ValueError("Questions list cannot be empty")
        return v


class BatchDifficultyCategorizationResponse(BaseModel):
    """Response model for batch difficulty categorization"""
    success: bool = Field(..., description="Whether batch categorization was successful")
    categorizations: List[DifficultyCategorizationResponse] = Field(..., description="Categorization results")
    total_questions: int = Field(..., description="Total number of questions")
    easy_count: int = Field(..., description="Number of easy questions")
    medium_count: int = Field(..., description="Number of medium questions")
    hard_count: int = Field(..., description="Number of hard questions")
    average_difficulty_score: float = Field(..., description="Average difficulty score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class DifficultyCategorizer:
    """
    Question Difficulty Categorizer Service
    
    Business Rules:
    1. Analyze question complexity and depth
    2. Categorize into Easy (basic recall), Medium (application), or Hard (analysis/synthesis)
    3. Use complexity metrics for categorization
    4. Provide cognitive level based on Bloom's taxonomy
    5. Support configurable thresholds
    """
    
    # Difficulty thresholds (can be configured)
    EASY_THRESHOLD = 0.33
    MEDIUM_THRESHOLD = 0.66
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize Difficulty Categorizer
        
        Args:
            model_path: Path to fine-tuned model
            tokenizer_path: Path to tokenizer (defaults to model_path)
        """
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path or model_path
        
        if TRANSFORMERS_AVAILABLE:
            print(f"🤖 Loading Difficulty Categorizer model from {model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ Difficulty Categorizer model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None
    
    def categorize_difficulty(
        self,
        request: DifficultyCategorizationRequest
    ) -> DifficultyCategorizationResponse:
        """
        Categorize question difficulty based on complexity and depth
        
        Args:
            request: DifficultyCategorizationRequest with question details
            
        Returns:
            DifficultyCategorizationResponse with categorization results
        """
        # Calculate complexity metrics
        complexity_metrics = self._calculate_complexity_metrics(
            request.question_text,
            request.options,
            request.source_content
        )
        
        # Calculate overall difficulty score
        difficulty_score = self._calculate_difficulty_score(complexity_metrics)
        
        # Categorize difficulty
        difficulty = self._categorize_from_score(difficulty_score)
        
        # Determine cognitive level
        cognitive_level = self._determine_cognitive_level(
            request.question_text,
            difficulty
        )
        
        # Generate reasoning
        reasoning = self._generate_reasoning(
            difficulty,
            cognitive_level,
            complexity_metrics
        )
        
        return DifficultyCategorizationResponse(
            success=True,
            question_text=request.question_text,
            question_type=request.question_type,
            difficulty=difficulty,
            cognitive_level=cognitive_level,
            difficulty_score=difficulty_score,
            complexity_metrics=complexity_metrics,
            reasoning=reasoning,
            metadata={
                "source_chunk_index": request.source_chunk_index,
                "topic": request.topic,
                "thresholds": {
                    "easy": self.EASY_THRESHOLD,
                    "medium": self.MEDIUM_THRESHOLD
                }
            }
        )
    
    def _calculate_complexity_metrics(
        self,
        question_text: str,
        options: Optional[List[str]],
        source_content: Optional[str]
    ) -> Dict[str, float]:
        """
        Calculate complexity metrics for the question
        
        Args:
            question_text: The question text
            options: Options for MCQ questions
            source_content: Source content for context
            
        Returns:
            Dictionary of complexity metrics
        """
        metrics = {}
        
        # Metric 1: Question length (longer questions tend to be more complex)
        question_words = re.findall(r'\b\w+\b', question_text)
        metrics['question_length'] = len(question_words)
        metrics['length_score'] = min(1.0, len(question_words) / 20.0)  # Normalize to 0-1
        
        # Metric 2: Vocabulary complexity (number of unique words)
        unique_words = set(word.lower() for word in question_words)
        metrics['vocabulary_complexity'] = len(unique_words) / len(question_words) if question_words else 0
        
        # Metric 3: Sentence complexity (number of sentences)
        sentences = re.split(r'[.!?]+', question_text)
        metrics['sentence_count'] = len([s for s in sentences if s.strip()])
        metrics['sentence_complexity'] = min(1.0, metrics['sentence_count'] / 3.0)
        
        # Metric 4: Option complexity (for MCQ)
        if options:
            option_words = [len(re.findall(r'\b\w+\b', opt)) for opt in options]
            metrics['option_complexity'] = sum(option_words) / len(option_words) / 10.0  # Normalize
        else:
            metrics['option_complexity'] = 0.5  # Default for True/False
        
        # Metric 5: Cognitive complexity indicators
        cognitive_indicators = [
            'analyze', 'evaluate', 'compare', 'contrast', 'synthesize',
            'critique', 'assess', 'justify', 'explain', 'interpret',
            'apply', 'demonstrate', 'calculate', 'predict', 'estimate'
        ]
        question_lower = question_text.lower()
        cognitive_count = sum(1 for indicator in cognitive_indicators if indicator in question_lower)
        metrics['cognitive_complexity'] = min(1.0, cognitive_count / 3.0)
        
        # Metric 6: Abstract concept presence
        abstract_terms = [
            'concept', 'theory', 'principle', 'framework', 'model',
            'algorithm', 'methodology', 'paradigm', 'hypothesis'
        ]
        abstract_count = sum(1 for term in abstract_terms if term in question_lower)
        metrics['abstract_complexity'] = min(1.0, abstract_count / 2.0)
        
        return metrics
    
    def _calculate_difficulty_score(self, metrics: Dict[str, float]) -> float:
        """
        Calculate overall difficulty score from complexity metrics
        
        Args:
            metrics: Dictionary of complexity metrics
            
        Returns:
            Overall difficulty score (0-1)
        """
        # Weight different metrics
        weights = {
            'length_score': 0.15,
            'vocabulary_complexity': 0.15,
            'sentence_complexity': 0.10,
            'option_complexity': 0.15,
            'cognitive_complexity': 0.25,
            'abstract_complexity': 0.20
        }
        
        # Calculate weighted score
        weighted_score = sum(
            metrics.get(key, 0.5) * weight
            for key, weight in weights.items()
        )
        
        return min(1.0, max(0.0, weighted_score))
    
    def _categorize_from_score(self, score: float) -> DifficultyCategory:
        """
        Categorize difficulty from numeric score
        
        Args:
            score: Numeric difficulty score (0-1)
            
        Returns:
            DifficultyCategory
        """
        if score < self.EASY_THRESHOLD:
            return DifficultyCategory.EASY
        elif score < self.MEDIUM_THRESHOLD:
            return DifficultyCategory.MEDIUM
        else:
            return DifficultyCategory.HARD
    
    def _determine_cognitive_level(
        self,
        question_text: str,
        difficulty: DifficultyCategory
    ) -> CognitiveLevel:
        """
        Determine Bloom's taxonomy cognitive level based on question and difficulty
        
        Args:
            question_text: The question text
            difficulty: Categorized difficulty
            
        Returns:
            CognitiveLevel based on Bloom's taxonomy
        """
        question_lower = question_text.lower()
        
        # Check for higher-order thinking skills
        analyze_keywords = ['analyze', 'evaluate', 'critique', 'assess', 'compare', 'contrast']
        create_keywords = ['create', 'design', 'develop', 'formulate', 'construct', 'synthesize']
        apply_keywords = ['apply', 'use', 'implement', 'demonstrate', 'calculate']
        understand_keywords = ['explain', 'describe', 'summarize', 'interpret', 'classify']
        
        # Check for create/evaluate keywords (highest level)
        if any(keyword in question_lower for keyword in create_keywords + analyze_keywords):
            return CognitiveLevel.ANALYZE if difficulty == DifficultyCategory.HARD else CognitiveLevel.EVALUATE
        
        # Check for apply keywords
        if any(keyword in question_lower for keyword in apply_keywords):
            return CognitiveLevel.APPLY
        
        # Check for understand keywords
        if any(keyword in question_lower for keyword in understand_keywords):
            return CognitiveLevel.UNDERSTAND
        
        # Default based on difficulty
        if difficulty == DifficultyCategory.EASY:
            return CognitiveLevel.REMEMBER
        elif difficulty == DifficultyCategory.MEDIUM:
            return CognitiveLevel.UNDERSTAND
        else:
            return CognitiveLevel.ANALYZE
    
    def _generate_reasoning(
        self,
        difficulty: DifficultyCategory,
        cognitive_level: CognitiveLevel,
        metrics: Dict[str, float]
    ) -> str:
        """
        Generate reasoning for difficulty categorization
        
        Args:
            difficulty: Categorized difficulty
            cognitive_level: Cognitive level
            metrics: Complexity metrics
            
        Returns:
            Reasoning string
        """
        difficulty_descriptions = {
            DifficultyCategory.EASY: "Basic recall question requiring simple memorization",
            DifficultyCategory.MEDIUM: "Application question requiring understanding and application",
            DifficultyCategory.HARD: "Analysis/synthesis question requiring critical thinking"
        }
        
        cognitive_descriptions = {
            CognitiveLevel.REMEMBER: "Basic recall",
            CognitiveLevel.UNDERSTAND: "Comprehension",
            CognitiveLevel.APPLY: "Application",
            CognitiveLevel.ANALYZE: "Analysis",
            CognitiveLevel.EVALUATE: "Evaluation",
            CognitiveLevel.CREATE: "Synthesis/Creation"
        }
        
        return (
            f"Question categorized as {difficulty.value} based on complexity metrics. "
            f"Requires {cognitive_descriptions[cognitive_level]} level cognitive processing. "
            f"Complexity score based on vocabulary, sentence structure, and cognitive indicators."
        )
    
    def categorize_batch_difficulty(
        self,
        request: BatchDifficultyCategorizationRequest
    ) -> BatchDifficultyCategorizationResponse:
        """
        Categorize difficulty for multiple questions in batch
        
        Args:
            request: BatchDifficultyCategorizationRequest with multiple questions
            
        Returns:
            BatchDifficultyCategorizationResponse with categorization results
        """
        categorizations = []
        
        for question_request in request.questions:
            categorization = self.categorize_difficulty(question_request)
            categorizations.append(categorization)
        
        # Calculate statistics
        easy_count = sum(1 for c in categorizations if c.difficulty == DifficultyCategory.EASY)
        medium_count = sum(1 for c in categorizations if c.difficulty == DifficultyCategory.MEDIUM)
        hard_count = sum(1 for c in categorizations if c.difficulty == DifficultyCategory.HARD)
        total_difficulty = sum(c.difficulty_score for c in categorizations)
        average_difficulty = total_difficulty / len(categorizations) if categorizations else 0.0
        
        return BatchDifficultyCategorizationResponse(
            success=len(categorizations) > 0,
            categorizations=categorizations,
            total_questions=len(categorizations),
            easy_count=easy_count,
            medium_count=medium_count,
            hard_count=hard_count,
            average_difficulty_score=average_difficulty,
            metadata={
                "total_questions_processed": len(request.questions),
                "thresholds": {
                    "easy": self.EASY_THRESHOLD,
                    "medium": self.MEDIUM_THRESHOLD
                }
            }
        )


# Singleton instance for application-wide use
_difficulty_categorizer_instance = None

def get_difficulty_categorizer(
    model_path: str = "./fine_tuned_quiz_model"
) -> DifficultyCategorizer:
    """
    Get or create singleton Difficulty Categorizer instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        DifficultyCategorizer instance
    """
    global _difficulty_categorizer_instance
    
    if _difficulty_categorizer_instance is None:
        _difficulty_categorizer_instance = DifficultyCategorizer(model_path=model_path)
    
    return _difficulty_categorizer_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Difficulty Categorizer")
    
    # Create categorizer instance
    categorizer = get_difficulty_categorizer()
    
    # Test easy question (basic recall)
    easy_request = DifficultyCategorizationRequest(
        question_text="What is machine learning?",
        question_type="mcq",
        options=["A subset of AI", "A type of hardware", "A programming language", "A database"],
        source_content="Machine learning is a subset of artificial intelligence.",
        topic="artificial intelligence"
    )
    
    easy_response = categorizer.categorize_difficulty(easy_request)
    print(f"\n📊 Easy Question Categorization:")
    print(f"   Question: {easy_response.question_text}")
    print(f"   Difficulty: {easy_response.difficulty.value}")
    print(f"   Cognitive Level: {easy_response.cognitive_level.value}")
    print(f"   Difficulty Score: {easy_response.difficulty_score:.2f}")
    print(f"   Reasoning: {easy_response.reasoning}")
    
    # Test hard question (analysis)
    hard_request = DifficultyCategorizationRequest(
        question_text="Analyze the trade-offs between using supervised learning versus unsupervised learning for a dataset with partially labeled data.",
        question_type="mcq",
        options=["Supervised is always better", "Unsupervised is always better", "Depends on data quality and labeling ratio", "Neither should be used"],
        source_content="Supervised learning requires labeled data, while unsupervised learning can work with unlabeled data. The choice depends on the specific use case.",
        topic="machine learning"
    )
    
    hard_response = categorizer.categorize_difficulty(hard_request)
    print(f"\n📊 Hard Question Categorization:")
    print(f"   Question: {hard_response.question_text}")
    print(f"   Difficulty: {hard_response.difficulty.value}")
    print(f"   Cognitive Level: {hard_response.cognitive_level.value}")
    print(f"   Difficulty Score: {hard_response.difficulty_score:.2f}")
    print(f"   Reasoning: {hard_response.reasoning}")