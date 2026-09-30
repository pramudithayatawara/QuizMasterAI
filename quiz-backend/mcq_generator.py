"""
Priority 23: Generate MCQ Questions Service Module

This module implements Multiple Choice Question (MCQ) generation from content chunks
using AI models with strict business rules enforcement.

Features:
- AI-powered MCQ generation using fine-tuned transformers model
- Exactly 4 options per question enforcement
- Single correct answer validation
- Content-aware question generation
- Pydantic models for request/response validation
"""

import os
import random
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


class QuestionType(Enum):
    """Types of questions that can be generated"""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"


class DifficultyLevel(Enum):
    """Difficulty levels for questions"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    RANDOM = "random"
    MIXED = "mixed"


class MCQGenerationRequest(BaseModel):
    """Request model for MCQ generation"""
    content_chunks: List[str] = Field(
        ...,
        description="List of content chunks to generate questions from",
        min_items=1
    )
    num_questions: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of MCQs to generate (1-20)"
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
    
    @field_validator('content_chunks')
    @classmethod
    def validate_content_chunks(cls, v):
        """Ensure content chunks are not empty"""
        for chunk in v:
            if not chunk or not chunk.strip():
                raise ValueError("Content chunks cannot be empty")
        return v


class MCQOption(BaseModel):
    """Model for a single MCQ option"""
    option_text: str = Field(..., description="The text of the option")
    is_correct: bool = Field(..., description="Whether this is the correct answer")
    explanation: Optional[str] = Field(None, description="Explanation for why this is correct/incorrect")


class MCQQuestion(BaseModel):
    """Model for a generated MCQ question"""
    question_text: str = Field(..., description="The question text")
    options: List[MCQOption] = Field(
        ...,
        description="List of options (must be exactly 4)",
        min_items=4,
        max_items=4
    )
    correct_answer: str = Field(..., description="The correct answer text")
    difficulty: DifficultyLevel = Field(default=DifficultyLevel.MEDIUM)
    topic: Optional[str] = Field(None, description="Topic of the question")
    explanation: Optional[str] = Field(None, description="Explanation of the answer")
    source_chunk_index: int = Field(..., description="Index of content chunk used")
    
    @field_validator('options')
    @classmethod
    def validate_options(cls, v):
        """Ensure exactly 4 options and exactly one correct answer"""
        if len(v) != 4:
            raise ValueError("MCQ must have exactly 4 options")
        
        correct_count = sum(1 for opt in v if opt.is_correct)
        if correct_count != 1:
            raise ValueError("MCQ must have exactly one correct answer")
        
        return v
    
    @field_validator('correct_answer')
    @classmethod
    def validate_correct_answer(cls, v, info):
        """Ensure correct answer matches one of the options"""
        if info.data and 'options' in info.data:
            option_texts = [opt.option_text for opt in info.data['options']]
            if v not in option_texts:
                raise ValueError("Correct answer must match one of the options")
        return v


class MCQGenerationResponse(BaseModel):
    """Response model for MCQ generation"""
    success: bool = Field(..., description="Whether generation was successful")
    questions: List[MCQQuestion] = Field(..., description="Generated MCQ questions")
    total_questions: int = Field(..., description="Total number of questions generated")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class MCQGenerator:
    """
    MCQ Generator Service
    
    Business Rules:
    1. Each question must have exactly 4 options
    2. Only one correct answer per question
    3. Questions generated from content chunks
    4. AI model used for generation
    """
    
    REQUIRED_OPTIONS = 4
    REQUIRED_CORRECT_ANSWERS = 1
    
    def __init__(
        self,
        model_path: str = "./fine_tuned_quiz_model",
        tokenizer_path: Optional[str] = None
    ):
        """
        Initialize MCQ Generator
        
        Args:
            model_path: Path to fine-tuned model
            tokenizer_path: Path to tokenizer (defaults to model_path)
        """
        # Resolve model path safely across various CWDs
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
            print(f"🤖 Loading MCQ generator model from {self.model_path}...")
            try:
                self.tokenizer = AutoTokenizer.from_pretrained(self.tokenizer_path)
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_path)
                print("✅ MCQ generator model loaded successfully")
            except Exception as e:
                print(f"⚠️ Failed to load model: {e}")
                self.tokenizer = None
                self.model = None
        else:
            self.tokenizer = None
            self.model = None

    def _clean_lecture_text(self, raw_text: str) -> List[str]:
        """
        Clean raw text from PDFs/slides, removing lecturer names, university headers,
        course codes, and outline boilerplate to extract genuine factual statements.
        """
        # 1. Remove course headers, university, and lecturer metadata
        text = re.sub(r'(?i)\b(?:by\s+)?(?:h\.?m\.?c\.?j\.?\s*de\s*silva|de\s*silva|rajarata\s*university(?:\s*of\s*sri\s*lanka)?|department\s*of\s*[a-z]+|faculty\s*of\s*[a-z]+)\b', '', raw_text)
        text = re.sub(r'\b[A-Z]{2,5}\s*\d{3,4}\b', '', text)  # COM3306
        text = re.sub(r'(?i)\b(?:learning objectives|course objectives|table of contents|references|summary)\b', '', text)
        text = re.sub(r'(?i)at the end of (?:the|this) (?:chapter|unit|lecture|lesson).*?(?:able to:?)?', '', text)
        text = re.sub(r'(?i)\bpage\s+\d+\s+of\s+\d+\b', '', text)
        
        # 2. Split into candidate segments on newlines or bullet markers (with or without space after bullet)
        segments = re.split(r'[\r\n]+|[\u2022\u2023\u25e6\u2043\u2219•\*]\s*|(?:^|[\r\n\s])-\s+', text)
        
        clean_facts = []
        for seg in segments:
            s = re.sub(r'^[•\-\*:\s\d\.)]+', '', seg).strip()
            if not s or len(s) < 15:
                continue
                
            # Reject objectives and syllabus boilerplate
            if re.search(r'(?i)\b(?:student\s+should\s+be\s+able\s+to|able\s+to:?|learning\s+objectives|course\s+objectives)\b', s):
                continue
            if re.match(r'^(?:define|explain|describe|understand|differentiate|identify|compare|list|discuss|outline|review)\b', s, re.IGNORECASE):
                continue
            # Reject pure title/section headers
            if re.match(r'^(?:PROCESS|PROCESS\s+STATES|PROCESS\s+MANAGEMENT|SCHEDULING|CPU\s+SCHEDULING)$', s, re.IGNORECASE):
                continue
                
            # Transform "Label: Description" (e.g. "Running: Instructions are being executed.")
            m_label = re.match(r'^([A-Z][a-zA-Z\s]{1,20}):\s*(.+)$', s)
            if m_label:
                lbl, desc = m_label.group(1).strip(), m_label.group(2).strip()
                if lbl.lower() in ['new', 'running', 'waiting', 'ready', 'terminated']:
                    clean_facts.append(f"In the {lbl} state, {desc[0].lower() + desc[1:]}")
                else:
                    clean_facts.append(f"{lbl}: {desc}")
                continue

            # Split multiple sentences if punctuated
            sentences = [sub.strip() for sub in re.split(r'(?<=[.!?])\s+', s) if len(sub.strip()) >= 20]
            if not sentences:
                sentences = [s]
                
            for sent in sentences:
                sent = re.sub(r'^[•\-\*:\s\d\.)]+', '', sent).strip()
                if re.search(r'(?i)\b(?:student\s+should\s+be\s+able\s+to|able\s+to:?)\b', sent):
                    continue
                # Reject sentences starting with unresolved pronouns
                if sent.lower().startswith(('it ', 'its ', 'this ', 'these ', 'they ', 'them ', 'their ', 'he ', 'she ', 'such ')):
                    continue
                if re.match(r'^(?:define|explain|describe|understand|differentiate|identify|compare|list|discuss|outline)\b', sent, re.IGNORECASE):
                    continue
                # Must have an informative verb
                if re.search(r'\b(is|are|was|were|means|called|contains|includes|consists|represents|allows|executes|changes|has|stores|provides)\b', sent, re.IGNORECASE):
                    if len(sent) >= 20:
                        clean_facts.append(sent)
                        
        return clean_facts

    def _extract_valid_concepts(self, text: str) -> List[str]:
        """
        Extract meaningful domain concepts and terms from text to serve as realistic distractors.
        """
        blacklist = {
            'sri', 'lanka', 'rajarata', 'university', 'department', 'faculty', 'computing', 'com3306',
            'silva', 'de', 'chapter', 'lecture', 'student', 'objectives', 'learning', 'define',
            'understand', 'explain', 'describe', 'differentiate', 'each', 'this', 'that', 'these',
            'those', 'table', 'contents', 'section', 'activity', 'value', 'some', 'event', 'state',
            'the', 'and', 'for', 'with', 'from', 'about', 'which', 'where', 'when', 'what', 'how',
            'question', 'answer', 'option', 'sentence', 'text', 'content'
        }
        
        concepts = []
        # Multi-word capitalized concepts: "Process Control Block", "Program Counter"
        for m in re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b', text):
            clean = m.strip()
            if clean.lower() not in blacklist and len(clean) > 5 and clean not in concepts:
                concepts.append(clean)
                
        # Acronyms: "PCB", "CPU"
        for m in re.findall(r'\b([A-Z]{2,5})\b', text):
            clean = m.strip()
            if clean.lower() not in blacklist and clean not in concepts:
                concepts.append(clean)
                
        # Single capitalized technical nouns
        for m in re.findall(r'\b([A-Z][a-z]{3,20})\b', text):
            clean = m.strip()
            if clean.lower() not in blacklist and clean not in concepts:
                concepts.append(clean)
                
        # Common OS/Computing domain fallbacks
        domain_fallbacks = [
            "Process Control Block (PCB)", "Thread", "CPU Scheduler", 
            "Context Switching", "Ready Queue", "Program Counter (PC)", 
            "Preemptive Scheduling", "Non-preemptive Scheduling",
            "Ready state", "Running state", "Waiting state", "Terminated state"
        ]
        for df in domain_fallbacks:
            if df not in concepts:
                concepts.append(df)
                
        return concepts

    def _extract_concept_candidates(self, text: str) -> List[str]:
        """Backward compatible helper wrapper"""
        return self._extract_valid_concepts(text)

    def _synthesize_mcq(
        self,
        fact: str,
        concept_pool: List[str],
        topic: Optional[str] = None
    ) -> Tuple[str, str, List[str]]:
        """
        Synthesize a meaningful question, accurate correct answer, and 3 realistic distractors from a fact.
        """
        q_text, correct_answer = None, None

        # Pattern 1: "<X> is called <Y>" or "<X> is known as <Y>"
        m1 = re.search(r'^(?:The\s+|A\s+|An\s+)?(.+?)\s+is\s+(?:called|known as)\s+(?:a\s+|an\s+|the\s+)?(.+?)\.?$', fact, re.IGNORECASE)
        if m1:
            clause, term = m1.group(1).strip(), m1.group(2).strip().rstrip('.')
            q_text = f"What is {clause.lower() if not clause.startswith(('CPU', 'PC', 'PCB')) else clause} called?"
            correct_answer = term.capitalize()

        # Pattern 2: "<X> means <Y>"
        m2 = re.search(r'^(?:The\s+|A\s+|An\s+)?(.+?)\s+means\s+(.+?)\.?$', fact, re.IGNORECASE)
        if not q_text and m2:
            subject, meaning = m2.group(1).strip(), m2.group(2).strip().rstrip('.')
            q_text = f"What does {subject} mean?"
            correct_answer = meaning[0].capitalize() + meaning[1:]

        # Pattern 3: "<X> contains/includes/consists of <Y>"
        m3 = re.search(r'^(?:The\s+|A\s+|An\s+)?(.+?)\s+(?:contains|includes|consists of)\s+(.+?)\.?$', fact, re.IGNORECASE)
        if not q_text and m3:
            subject, content = m3.group(1).strip(), m3.group(2).strip().rstrip('.')
            q_text = f"What does {subject} contain?"
            correct_answer = content[0].capitalize() + content[1:]

        # Pattern 4: "Each process is represented in the OS by <Y>"
        m4 = re.search(r'^(?:Each\s+process\s+is\s+represented\s+(?:in\s+the\s+operating\s+system\s+)?by\s+(?:a\s+|an\s+)?)(.+?)\.?$', fact, re.IGNORECASE)
        if not q_text and m4:
            term = m4.group(1).strip().rstrip('.')
            q_text = "How is each process represented in the operating system?"
            correct_answer = f"A {term}"

        # Pattern 5: "In the <State> state, <action>"
        m5 = re.search(r'^In the\s+([A-Z][a-z]+)\s+state,\s+(.+?)\.?$', fact, re.IGNORECASE)
        if not q_text and m5:
            state_name, action = m5.group(1).strip(), m5.group(2).strip().rstrip('.')
            q_text = f"During which process state {action}?"
            correct_answer = f"{state_name} state"

        # Pattern 6: "<X> allows <Y>"
        m6 = re.search(r'^(?:The\s+|A\s+|An\s+)?(.+?)\s+allows\s+(.+?)\.?$', fact, re.IGNORECASE)
        if not q_text and m6:
            subject, action = m6.group(1).strip(), m6.group(2).strip().rstrip('.')
            q_text = f"Which mechanism allows {action}?"
            correct_answer = subject.capitalize()

        # Pattern 7: Flan-T5 Model Generation
        if not q_text and TRANSFORMERS_AVAILABLE and self.model is not None and self.tokenizer is not None:
            try:
                inp = self.tokenizer(f"generate questions: {fact}", return_tensors="pt", max_length=128, truncation=True)
                out = self.model.generate(inp["input_ids"], max_length=64, num_beams=4)
                cand_q = self.tokenizer.decode(out[0], skip_special_tokens=True).strip()
                if cand_q.endswith('?') and cand_q.lower().startswith(('what', 'which', 'how', 'why', 'where', 'when', 'who', 'does', 'can', 'is')):
                    inp_a = self.tokenizer(f"Answer the question: {cand_q} Context: {fact}", return_tensors="pt")
                    out_a = self.model.generate(inp_a["input_ids"], max_length=64, num_beams=4)
                    cand_a = self.tokenizer.decode(out_a[0], skip_special_tokens=True).strip().rstrip('.,;:')
                    if len(cand_a) >= 3 and cand_a.lower() != cand_q.lower() and len(cand_a) < len(fact) * 0.8:
                        q_text = cand_q
                        correct_answer = cand_a[0].capitalize() + cand_a[1:]
            except Exception:
                pass

        # Pattern 8: Generic Definition / Cloze
        if not q_text:
            m_gen = re.search(r'^(?:The\s+|A\s+|An\s+)?([A-Z][a-zA-Z0-9_\-\s]{2,30}?)\s+(?:is|refers to)\s+(.+?)\.?$', fact)
            if m_gen:
                subject, definition = m_gen.group(1).strip(), m_gen.group(2).strip().rstrip('.')
                q_text = f"Which of the following describes {subject}?"
                correct_answer = definition[0].capitalize() + definition[1:]
            else:
                q_text = f"Which statement is accurate according to the lesson material?"
                correct_answer = fact.rstrip('.')

        # Clean answer
        correct_answer = correct_answer.strip()
        if len(correct_answer) > 0:
            correct_answer = correct_answer[0].capitalize() + correct_answer[1:]

        # Distractor generation
        if len(correct_answer.split()) <= 4:
            distractor_candidates = [
                c for c in concept_pool 
                if c.lower() != correct_answer.lower() and c.lower() not in correct_answer.lower() and correct_answer.lower() not in c.lower()
            ]
            if len(distractor_candidates) >= 3:
                distractors = random.sample(distractor_candidates, 3)
            else:
                default_pool = ["Process Control Block (PCB)", "Thread", "CPU Scheduler", "Context Switching", "Ready Queue", "Program Counter"]
                fillers = [d for d in default_pool if d.lower() != correct_answer.lower() and d not in distractor_candidates]
                distractors = (distractor_candidates + fillers)[:3]
        else:
            distractors = [
                "Instructions are executed directly without operating system intervention",
                "Allocated CPU registers are permanently stored to disk until reboot",
                "The program code remains completely isolated from all hardware activities"
            ]

        return q_text, correct_answer, distractors

    def generate_mcq_from_content(
        self,
        content: str,
        difficulty: DifficultyLevel = DifficultyLevel.MEDIUM,
        topic: Optional[str] = None,
        all_chunks: Optional[List[str]] = None,
        target_fact: Optional[str] = None
    ) -> MCQQuestion:
        """
        Generate a single meaningful MCQ from content using clean fact extraction and real options
        """
        diff_str = str(difficulty.value if hasattr(difficulty, 'value') else difficulty).lower()
        if diff_str in ["random", "mixed", "auto"]:
            actual_difficulty = random.choice([DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD])
        else:
            try:
                actual_difficulty = DifficultyLevel(diff_str)
            except ValueError:
                actual_difficulty = DifficultyLevel.MEDIUM

        try:
            # 1. Clean and extract factual sentences
            if target_fact:
                fact = target_fact
            else:
                facts = self._clean_lecture_text(content)
                if facts:
                    fact = facts[0]
                else:
                    fact = content.strip()

            # 2. Extract domain concepts across content and chunks
            all_text = ' '.join([content] + (all_chunks or []))
            concepts = self._extract_valid_concepts(all_text)

            # 3. Synthesize Question, Answer, and Distractors
            q_text, correct_answer, distractors = self._synthesize_mcq(fact, concepts, topic)

            # 4. Form exactly 4 options and shuffle
            option_texts = [correct_answer] + distractors[:3]
            # Ensure unique options
            if len(set(option_texts)) < 4:
                fillers = ["System Process", "Operating Environment", "Hardware Dispatcher"]
                for fl in fillers:
                    if len(option_texts) >= 4:
                        break
                    if fl not in option_texts:
                        option_texts.append(fl)

            random.shuffle(option_texts)

            # 5. Create MCQOption objects
            options = []
            for opt_text in option_texts:
                is_correct = (opt_text == correct_answer)
                options.append(MCQOption(
                    option_text=opt_text,
                    is_correct=is_correct,
                    explanation="Correct answer verified from source text." if is_correct else "Incorrect distractor option."
                ))

            mcq = MCQQuestion(
                question_text=q_text,
                options=options,
                correct_answer=correct_answer,
                difficulty=actual_difficulty,
                topic=topic,
                explanation=f"Correct answer is '{correct_answer}'. Context: {fact}",
                source_chunk_index=0
            )

            self._validate_mcq_business_rules(mcq)
            return mcq

        except Exception as e:
            print(f"⚠️ Error generating MCQ: {e}")
            return self._generate_fallback_mcq(content, actual_difficulty, topic, all_chunks)
    
    def _generate_fallback_mcq(
        self,
        content: str,
        difficulty: DifficultyLevel,
        topic: Optional[str] = None,
        all_chunks: Optional[List[str]] = None
    ) -> MCQQuestion:
        """
        Generate fallback MCQ with clean academic concepts
        """
        diff_str = str(difficulty.value if hasattr(difficulty, 'value') else difficulty).lower()
        if diff_str in ["random", "mixed", "auto"]:
            actual_difficulty = random.choice([DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD])
        else:
            try:
                actual_difficulty = DifficultyLevel(diff_str)
            except ValueError:
                actual_difficulty = DifficultyLevel.MEDIUM

        facts = self._clean_lecture_text(content)
        fact = facts[0] if facts else (content.strip() or f"Study content regarding {topic or 'the topic'}")
        all_text = ' '.join([content] + (all_chunks or []))
        concepts = self._extract_valid_concepts(all_text)
        
        q_text, correct_answer, distractors = self._synthesize_mcq(fact, concepts, topic)
        option_texts = [correct_answer] + distractors[:3]
        random.shuffle(option_texts)

        options = []
        for opt_text in option_texts:
            options.append(MCQOption(
                option_text=opt_text,
                is_correct=(opt_text == correct_answer),
                explanation="Correct answer verified from context." if opt_text == correct_answer else "Distractor option."
            ))

        return MCQQuestion(
            question_text=q_text,
            options=options,
            correct_answer=correct_answer,
            difficulty=actual_difficulty,
            topic=topic,
            explanation=f"Context: {fact}",
            source_chunk_index=0
        )
    
    def _validate_mcq_business_rules(self, mcq: MCQQuestion):
        """
        Validate MCQ against business rules
        
        Args:
            mcq: MCQQuestion to validate
            
        Raises:
            ValueError: If business rules are violated
        """
        # Rule 1: Exactly 4 options
        if len(mcq.options) != self.REQUIRED_OPTIONS:
            raise ValueError(
                f"MCQ must have exactly {self.REQUIRED_OPTIONS} options, "
                f"got {len(mcq.options)}"
            )
        
        # Rule 2: Exactly one correct answer
        correct_count = sum(1 for opt in mcq.options if opt.is_correct)
        if correct_count != self.REQUIRED_CORRECT_ANSWERS:
            raise ValueError(
                f"MCQ must have exactly {self.REQUIRED_CORRECT_ANSWERS} correct answer, "
                f"got {correct_count}"
            )
        
        # Rule 3: Correct answer must match an option
        option_texts = [opt.option_text for opt in mcq.options]
        if mcq.correct_answer not in option_texts:
            raise ValueError("Correct answer must match one of the options")
    
    def generate_mcqs_from_chunks(
        self,
        request: MCQGenerationRequest
    ) -> MCQGenerationResponse:
        """
        Generate multiple MCQs from content chunks
        
        Args:
            request: MCQGenerationRequest with content chunks and parameters
            
        Returns:
            MCQGenerationResponse with generated questions
        """
        questions = []
        chunks = request.content_chunks
        num_questions = request.num_questions
        
        # Difficulty handling: if random / mixed, distribute across Easy, Medium, Hard
        diff_str = str(request.difficulty.value if hasattr(request.difficulty, 'value') else request.difficulty).lower()
        is_random = diff_str in ["random", "mixed", "auto"]
        difficulty_pool = [DifficultyLevel.EASY, DifficultyLevel.MEDIUM, DifficultyLevel.HARD]
        
        # Collect all clean facts across all chunks
        all_facts = []
        for chunk in chunks:
            all_facts.extend(self._clean_lecture_text(chunk))
            
        if not all_facts:
            all_facts = [c.strip() for c in chunks if c.strip()]
            
        # Distribute questions across distinct facts
        for i in range(num_questions):
            fact = all_facts[i % len(all_facts)]
            chunk_index = i % len(chunks)
            
            if is_random:
                q_diff = difficulty_pool[i % len(difficulty_pool)]
            else:
                q_diff = request.difficulty
            
            mcq = self.generate_mcq_from_content(
                content=fact,
                difficulty=q_diff,
                topic=request.topic,
                all_chunks=chunks,
                target_fact=fact
            )
            
            mcq.source_chunk_index = chunk_index
            questions.append(mcq)
        
        return MCQGenerationResponse(
            success=True,
            questions=questions,
            total_questions=len(questions),
            metadata={
                "num_content_chunks": len(chunks),
                "difficulty": request.difficulty.value if hasattr(request.difficulty, 'value') else str(request.difficulty),
                "topic": request.topic,
                "language": request.language,
            }
        )

    
    def format_mcq_for_display(self, mcq: MCQQuestion) -> str:
        """
        Format MCQ for display purposes
        
        Args:
            mcq: MCQQuestion to format
            
        Returns:
            Formatted string representation
        """
        output = []
        output.append(f"Question: {mcq.question_text}")
        output.append(f"Difficulty: {mcq.difficulty.value}")
        if mcq.topic:
            output.append(f"Topic: {mcq.topic}")
        output.append("\nOptions:")
        
        for i, option in enumerate(mcq.options):
            prefix = "✓" if option.is_correct else "  "
            output.append(f"{prefix} {chr(65 + i)}. {option.option_text}")
        
        output.append(f"\nCorrect Answer: {mcq.correct_answer}")
        
        if mcq.explanation:
            output.append(f"Explanation: {mcq.explanation}")
        
        return "\n".join(output)


# Singleton instance for application-wide use
_mcq_generator_instance = None

def get_mcq_generator(
    model_path: str = "./fine_tuned_quiz_model"
) -> MCQGenerator:
    """
    Get or create singleton MCQ Generator instance
    
    Args:
        model_path: Path to fine-tuned model
        
    Returns:
        MCQGenerator instance
    """
    global _mcq_generator_instance
    
    if _mcq_generator_instance is None:
        _mcq_generator_instance = MCQGenerator(model_path=model_path)
    
    return _mcq_generator_instance


# Example usage and testing
if __name__ == "__main__":
    print("🧪 Testing MCQ Generator")
    
    # Create generator instance
    generator = get_mcq_generator()
    
    # Test request
    request = MCQGenerationRequest(
        content_chunks=[
            "Machine learning is a subset of artificial intelligence that enables systems to learn from data.",
            "Deep learning uses neural networks with multiple layers to extract features from data.",
            "Natural language processing deals with the interaction between computers and human language."
        ],
        num_questions=3,
        difficulty=DifficultyLevel.MEDIUM,
        topic="artificial intelligence"
    )
    
    # Generate MCQs
    response = generator.generate_mcqs_from_chunks(request)
    
    print(f"\n📊 Generated {response.total_questions} MCQs:")
    print(f"   Success: {response.success}")
    print(f"   Metadata: {response.metadata}")
    
    print(f"\n📝 Sample MCQs:")
    for i, mcq in enumerate(response.questions, 1):
        print(f"\n{'='*50}")
        print(f"Question {i}:")
        print(generator.format_mcq_for_display(mcq))
    
    # Validate business rules
    print(f"\n✅ Business Rules Validation:")
    for i, mcq in enumerate(response.questions, 1):
        try:
            generator._validate_mcq_business_rules(mcq)
            print(f"   Question {i}: ✅ Valid (4 options, 1 correct answer)")
        except ValueError as e:
            print(f"   Question {i}: ❌ Invalid - {e}")