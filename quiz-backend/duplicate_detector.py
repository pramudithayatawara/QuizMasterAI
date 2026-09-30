"""
Priority 29: Prevent Question Duplication Service Module

This module implements question duplication prevention using similarity algorithms,
ensuring maximum 80% similarity between questions and automatically removing duplicates.

Features:
- Cosine similarity for text comparison
- SequenceMatcher for string similarity
- Automatic duplicate detection and removal
- Configurable similarity threshold
- Pydantic models for request/response validation
"""

from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import re
import json
from difflib import SequenceMatcher

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("⚠️ Scikit-learn not available. Install with: pip install scikit-learn")

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


class SimilarityMethod(Enum):
    """Methods for calculating similarity"""
    COSINE = "cosine"
    SEQUENCE_MATCHER = "sequence_matcher"
    HYBRID = "hybrid"


class QuestionData(BaseModel):
    """Model for question data"""
    question_text: str = Field(..., description="The question text or statement")
    question_type: QuestionType = Field(..., description="Type of question (MCQ or True/False)")
    options: Optional[List[str]] = Field(None, description="Options for MCQ questions")
    source_chunk_index: int = Field(default=0, description="Index of source chunk used")
    topic: Optional[str] = Field(None, description="Topic of the question")
    question_id: Optional[str] = Field(None, description="Optional question identifier")
    
    @field_validator('question_text')
    @classmethod
    def validate_question_text(cls, v):
        """Ensure question text is not empty"""
        if not v or not v.strip():
            raise ValueError("Question text cannot be empty")
        return v


class DuplicationCheckRequest(BaseModel):
    """Request model for duplication check"""
    questions: List[QuestionData] = Field(
        ...,
        description="List of questions to check for duplicates",
        min_items=1
    )
    similarity_threshold: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Maximum allowed similarity threshold (0-1)"
    )
    similarity_method: SimilarityMethod = Field(
        default=SimilarityMethod.HYBRID,
        description="Method for calculating similarity"
    )
    check_options: bool = Field(
        default=True,
        description="Whether to include options in similarity calculation"
    )
    
    @field_validator('questions')
    @classmethod
    def validate_questions(cls, v):
        """Ensure questions list is not empty"""
        if not v:
            raise ValueError("Questions list cannot be empty")
        return v


class DuplicationCheckResponse(BaseModel):
    """Response model for duplication check"""
    success: bool = Field(..., description="Whether duplication check was successful")
    original_count: int = Field(..., description="Original number of questions")
    filtered_count: int = Field(..., description="Number of questions after duplicate removal")
    duplicates_removed: int = Field(..., description="Number of duplicates removed")
    similarity_threshold: float = Field(..., description="Similarity threshold used")
    similarity_method: str = Field(..., description="Similarity method used")
    unique_questions: List[QuestionData] = Field(..., description="List of unique questions")
    duplicate_pairs: List[Dict[str, Any]] = Field(default_factory=list, description="List of duplicate pairs found")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class DuplicateDetector:
    """
    Question Duplicate Detector Service
    
    Business Rules:
    1. Use similarity algorithms to detect duplicates
    2. Ensure maximum 80% similarity between questions
    3. Automatically remove duplicates
    4. Support cosine similarity and SequenceMatcher
    5. Configurable similarity threshold
    """
    
    DEFAULT_SIMILARITY_THRESHOLD = 0.8
    
    def __init__(self):
        """Initialize Duplicate Detector"""
        self.vectorizer = None
        if SKLEARN_AVAILABLE:
            self.vectorizer = TfidfVectorizer(stop_words='english')
    
    def check_duplicates(
        self,
        request: DuplicationCheckRequest
    ) -> DuplicationCheckResponse:
        """
        Check for duplicates in a list of questions
        
        Args:
            request: DuplicationCheckRequest with questions and parameters
            
        Returns:
            DuplicationCheckResponse with duplicate check results
        """
        try:
            # Prepare question texts for comparison
            question_texts = self._prepare_question_texts(
                request.questions,
                request.check_options
            )
            
            # Calculate similarity matrix
            similarity_matrix = self._calculate_similarity_matrix(
                question_texts,
                request.similarity_method
            )
            
            # Find duplicates
            duplicates_info = self._find_duplicates(
                request.questions,
                similarity_matrix,
                request.similarity_threshold
            )
            
            # Filter unique questions
            unique_questions = self._filter_unique_questions(
                request.questions,
                duplicates_info
            )
            
            return DuplicationCheckResponse(
                success=True,
                original_count=len(request.questions),
                filtered_count=len(unique_questions),
                duplicates_removed=len(request.questions) - len(unique_questions),
                similarity_threshold=request.similarity_threshold,
                similarity_method=request.similarity_method.value,
                unique_questions=unique_questions,
                duplicate_pairs=duplicates_info['duplicate_pairs'],
                metadata={
                    "check_options": request.check_options,
                    "similarity_method": request.similarity_method.value,
                    "total_comparisons": duplicates_info['total_comparisons']
                }
            )
            
        except Exception as e:
            print(f"⚠️ Error checking duplicates: {e}")
            # Return original questions if error occurs
            return DuplicationCheckResponse(
                success=False,
                original_count=len(request.questions),
                filtered_count=len(request.questions),
                duplicates_removed=0,
                similarity_threshold=request.similarity_threshold,
                similarity_method=request.similarity_method.value,
                unique_questions=request.questions,
                duplicate_pairs=[],
                metadata={"error": str(e)}
            )
    
    def _prepare_question_texts(
        self,
        questions: List[QuestionData],
        check_options: bool
    ) -> List[str]:
        """
        Prepare question texts for similarity comparison
        
        Args:
            questions: List of questions
            check_options: Whether to include options in comparison
            
        Returns:
            List of prepared question texts
        """
        prepared_texts = []
        
        for question in questions:
            # Start with question text
            text = question.question_text
            
            # Add options if requested and available
            if check_options and question.options:
                options_text = " ".join(question.options)
                text = f"{text} {options_text}"
            
            # Normalize text
            text = self._normalize_text(text)
            prepared_texts.append(text)
        
        return prepared_texts
    
    def _normalize_text(self, text: str) -> str:
        """
        Normalize text for comparison
        
        Args:
            text: Text to normalize
            
        Returns:
            Normalized text
        """
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove punctuation (optional, adjust as needed)
        # text = re.sub(r'[^\w\s]', '', text)
        
        return text.strip()
    
    def _calculate_similarity_matrix(
        self,
        texts: List[str],
        method: SimilarityMethod
    ) -> List[List[float]]:
        """
        Calculate similarity matrix between texts
        
        Args:
            texts: List of texts to compare
            method: Similarity method to use
            
        Returns:
            Similarity matrix (list of lists)
        """
        n = len(texts)
        similarity_matrix = [[0.0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(i + 1, n):
                if method == SimilarityMethod.COSINE:
                    similarity = self._cosine_similarity(texts[i], texts[j])
                elif method == SimilarityMethod.SEQUENCE_MATCHER:
                    similarity = self._sequence_matcher_similarity(texts[i], texts[j])
                else:  # HYBRID
                    cosine_sim = self._cosine_similarity(texts[i], texts[j])
                    seq_sim = self._sequence_matcher_similarity(texts[i], texts[j])
                    similarity = (cosine_sim + seq_sim) / 2
                
                similarity_matrix[i][j] = similarity
                similarity_matrix[j][i] = similarity  # Symmetric matrix
        
        return similarity_matrix
    
    def _cosine_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate cosine similarity between two texts
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Cosine similarity score (0-1)
        """
        if not SKLEARN_AVAILABLE:
            # Fallback to simple word overlap
            return self._word_overlap_similarity(text1, text2)
        
        try:
            # Create TF-IDF vectors
            tfidf_matrix = self.vectorizer.fit_transform([text1, text2])
            
            # Calculate cosine similarity
            similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
            
            return float(similarity)
            
        except Exception as e:
            print(f"⚠️ Error calculating cosine similarity: {e}")
            return self._word_overlap_similarity(text1, text2)
    
    def _sequence_matcher_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate similarity using SequenceMatcher
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score (0-1)
        """
        return SequenceMatcher(None, text1, text2).ratio()
    
    def _word_overlap_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate simple word overlap similarity (fallback)
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score (0-1)
        """
        words1 = set(text1.split())
        words2 = set(text2.split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0
    
    def _find_duplicates(
        self,
        questions: List[QuestionData],
        similarity_matrix: List[List[float]],
        threshold: float
    ) -> Dict[str, Any]:
        """
        Find duplicate questions based on similarity matrix
        
        Args:
            questions: List of questions
            similarity_matrix: Similarity matrix
            threshold: Similarity threshold
            
        Returns:
            Dictionary with duplicate information
        """
        duplicate_pairs = []
        indices_to_remove = set()
        total_comparisons = 0
        
        n = len(questions)
        for i in range(n):
            for j in range(i + 1, n):
                total_comparisons += 1
                similarity = similarity_matrix[i][j]
                
                if similarity >= threshold:
                    # Mark j as duplicate (keep i, remove j)
                    if j not in indices_to_remove:
                        indices_to_remove.add(j)
                        duplicate_pairs.append({
                            "question_1": {
                                "index": i,
                                "text": questions[i].question_text,
                                "id": questions[i].question_id
                            },
                            "question_2": {
                                "index": j,
                                "text": questions[j].question_text,
                                "id": questions[j].question_id
                            },
                            "similarity": similarity
                        })
        
        return {
            "duplicate_pairs": duplicate_pairs,
            "indices_to_remove": indices_to_remove,
            "total_comparisons": total_comparisons
        }
    
    def _filter_unique_questions(
        self,
        questions: List[QuestionData],
        duplicates_info: Dict[str, Any]
    ) -> List[QuestionData]:
        """
        Filter questions to remove duplicates
        
        Args:
            questions: List of questions
            duplicates_info: Duplicate information from _find_duplicates
            
        Returns:
            List of unique questions
        """
        indices_to_remove = duplicates_info['indices_to_remove']
        
        unique_questions = [
            question for i, question in enumerate(questions)
            if i not in indices_to_remove
        ]
        
        return unique_questions
    
    def calculate_pairwise_similarity(
        self,
        question1: QuestionData,
        question2: QuestionData,
        method: SimilarityMethod = SimilarityMethod.HYBRID,
        check_options: bool = True
    ) -> float:
        """
        Calculate similarity between two questions
        
        Args:
            question1: First question
            question2: Second question
            method: Similarity method to use
            check_options: Whether to include options in comparison
            
        Returns:
            Similarity score (0-1)
        """
        # Prepare texts
        text1 = question1.question_text
        text2 = question2.question_text
        
        if check_options:
            if question1.options:
                text1 = f"{text1} {' '.join(question1.options)}"
            if question2.options:
                text2 = f"{text2} {' '.join(question2.options)}"
        
        # Normalize texts
        text1 = self._normalize_text(text1)
        text2 = self._normalize_text(text2)
        
        # Calculate similarity
        if method == SimilarityMethod.COSINE:
            return self._cosine_similarity(text1, text2)
        elif method == SimilarityMethod.SEQUENCE_MATCHER:
            return self._sequence_matcher_similarity(text1, text2)
        else:  # HYBRID
            cosine_sim = self._cosine_similarity(text1, text2)
            seq_sim = self._sequence_matcher_similarity(text1, text2)
            return (cosine_sim + seq_sim) / 2


# Singleton instance for application-wide use
_duplicate_detector_instance = None

def get_duplicate_detector() -> DuplicateDetector:
    """
    Get or create singleton Duplicate Detector instance
    
    Returns:
        DuplicateDetector instance
    """
    global _duplicate_detector_instance
    
    if _duplicate_detector_instance is None:
        _duplicate_detector_instance = DuplicateDetector()
    
    return _duplicate_detector_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing Duplicate Detector")
    
    # Create detector instance
    detector = get_duplicate_detector()
    
    # Test with duplicate questions
    questions = [
        QuestionData(
            question_text="What is machine learning?",
            question_type=QuestionType.MCQ,
            options=["A subset of AI", "A type of hardware", "A programming language", "A database"],
            source_chunk_index=0,
            topic="artificial intelligence",
            question_id="q1"
        ),
        QuestionData(
            question_text="What is machine learning?",  # Exact duplicate
            question_type=QuestionType.MCQ,
            options=["A subset of AI", "A type of hardware", "A programming language", "A database"],
            source_chunk_index=0,
            topic="artificial intelligence",
            question_id="q2"
        ),
        QuestionData(
            question_text="What defines machine learning?",  # Similar but not identical
            question_type=QuestionType.MCQ,
            options=["Learning from data", "Hardware type", "Programming language", "Database system"],
            source_chunk_index=0,
            topic="artificial intelligence",
            question_id="q3"
        ),
        QuestionData(
            question_text="What is deep learning?",  # Different topic
            question_type=QuestionType.MCQ,
            options=["Neural networks", "A type of hardware", "A programming language", "A database"],
            source_chunk_index=0,
            topic="artificial intelligence",
            question_id="q4"
        )
    ]
    
    request = DuplicationCheckRequest(
        questions=questions,
        similarity_threshold=0.8,
        similarity_method=SimilarityMethod.HYBRID,
        check_options=True
    )
    
    response = detector.check_duplicates(request)
    
    print(f"\n📊 Duplicate Check Results:")
    print(f"   Original Count: {response.original_count}")
    print(f"   Filtered Count: {response.filtered_count}")
    print(f"   Duplicates Removed: {response.duplicates_removed}")
    print(f"   Similarity Threshold: {response.similarity_threshold}")
    print(f"   Similarity Method: {response.similarity_method}")
    
    print(f"\n📝 Duplicate Pairs Found:")
    for pair in response.duplicate_pairs:
        print(f"   {pair['question_1']['text']} <-> {pair['question_2']['text']}")
        print(f"   Similarity: {pair['similarity']:.2f}")
    
    print(f"\n✅ Unique Questions ({len(response.unique_questions)}):")
    for i, question in enumerate(response.unique_questions, 1):
        print(f"   {i}. {question.question_text}")
    
    # Test pairwise similarity
    print(f"\n🔍 Pairwise Similarity Test:")
    similarity = detector.calculate_pairwise_similarity(
        questions[0],
        questions[1],
        method=SimilarityMethod.HYBRID
    )
    print(f"   Similarity between q1 and q2: {similarity:.2f}")
    
    similarity = detector.calculate_pairwise_similarity(
        questions[0],
        questions[3],
        method=SimilarityMethod.HYBRID
    )
    print(f"   Similarity between q1 and q4: {similarity:.2f}")