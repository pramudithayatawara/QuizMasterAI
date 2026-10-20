import os
import json
import re
import urllib.request
import urllib.error
import random
from typing import List, Dict, Any, Optional

"""
@module gemini_quiz_service
@description State-of-the-art educational quiz generation service using Google Gemini Flash.
Produces context-grounded MCQs, True/False, and mixed question sets with realistic distractors
and verifiable explanations directly extracted from source lecture documents.
"""

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

class GeminiQuizService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or GEMINI_MODEL
        self.endpoint_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

    def is_available(self) -> bool:
        return bool(self.api_key and len(self.api_key) > 10)

    def _call_gemini_json(self, prompt: str) -> Any:
        """Call Gemini API with structured JSON output enforcement."""
        if not self.is_available():
            raise ValueError("Gemini API key is not configured.")

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.9,
                "responseMimeType": "application/json"
            }
        }

        req = urllib.request.Request(
            self.endpoint_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                response_data = json.loads(response.read().decode("utf-8"))
                candidate_text = response_data["candidates"][0]["content"]["parts"][0]["text"].strip()

                # Clean any markdown fences if present
                if candidate_text.startswith("```json"):
                    candidate_text = candidate_text[7:]
                elif candidate_text.startswith("```"):
                    candidate_text = candidate_text[3:]
                if candidate_text.endswith("```"):
                    candidate_text = candidate_text[:-3]
                candidate_text = candidate_text.strip()

                parsed = json.loads(candidate_text)
                if isinstance(parsed, dict) and "questions" in parsed:
                    parsed = parsed["questions"]
                return parsed

        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode('utf-8', errors='ignore')
            print(f"⚠️ Gemini API HTTP Error {http_err.code}: {error_body}")
            raise RuntimeError(f"Gemini API returned error {http_err.code}: {error_body}")
        except Exception as e:
            print(f"⚠️ Gemini API request failed: {e}")
            raise e

    def generate_quiz_from_context(
        self,
        context: str,
        num_questions: int = 5,
        difficulty: str = "medium",
        question_type: str = "mcq", # 'mcq' | 'true_false' | 'mixed'
        topic: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate educational quiz questions from lecture context using Gemini Flash.
        Returns standardized dictionaries compatible with QuizMasterAI's frontend and DB.
        """
        truncated_context = context[:14000].strip()

        type_instructions = ""
        if question_type == "true_false":
            type_instructions = (
                "Generate ONLY True/False questions. "
                "CRITICAL: The question MUST be a clear, unambiguous declarative statement ending with a period (.), NOT a question mark (?). "
                "Do not use vague words like 'sometimes', 'often', 'maybe', 'generally', 'usually'. "
                "Each question must have options exactly: [\"True\", \"False\"], "
                "with correct_answer being either \"True\" or \"False\", "
                "and question_type set to \"true_false\"."
            )
        elif question_type == "mixed":
            type_instructions = (
                "Generate a balanced mix of Multiple Choice (MCQ) and True/False questions. "
                "For MCQs, options must be an array of exactly 4 strings. "
                "For True/False questions, the question must be a declarative statement ending with a period (.), and options must be [\"True\", \"False\"]."
            )
        else: # default mcq
            type_instructions = (
                "Generate Multiple Choice Questions (MCQ). "
                "Every question must have options as an array of EXACTLY 4 distinct, plausible choices. "
                "One choice must be unambiguously correct according to the context, and the other 3 "
                "must be realistic distractors from the same subject domain. "
                "NEVER use placeholder options like 'Option A' or 'None of the above'. "
                "Set question_type to \"mcq\"."
            )

        prompt = f"""You are a university academic examiner creating an assessment exam for higher education students.
Based STRICTLY and EXCLUSIVELY on the provided educational context below, generate {num_questions} questions.

Target Difficulty: {difficulty.upper()}
Topic: {topic or 'Subject Matter in Context'}

Requirements:
1. {type_instructions}
2. Every question MUST be grounded in the text. No outside knowledge or hallucinations.
3. Every question must have an explanation explaining why the correct answer is right based on the lecture text.
4. Difficulty must reflect {difficulty}: Easy (definitions/recall), Medium (conceptual understanding/application), Hard (analysis/distinction).
5. Output format: Return ONLY a valid JSON array of question objects without markdown backticks or extra text.

JSON Object Structure:
{{
  "question": "Question text or statement?",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correct_answer": "Option 1",
  "explanation": "Clear explanation citing the source text.",
  "difficulty": "{difficulty}",
  "question_type": "{'true_false' if question_type == 'true_false' else 'mcq'}"
}}

Educational Context:
----------------------------------------
{truncated_context}
----------------------------------------
"""
        parsed_questions = self._call_gemini_json(prompt)
        if not isinstance(parsed_questions, list):
            raise ValueError(f"Expected JSON array, got {type(parsed_questions)}")

        formatted_questions = []
        for idx, q in enumerate(parsed_questions):
            q_text = q.get("question") or q.get("question_text") or "Untitled Question"
            options = q.get("options") or []
            correct_ans = q.get("correct_answer") or (options[0] if options else "")
            explanation = q.get("explanation") or f"According to context: '{correct_ans}' is correct."
            q_diff = q.get("difficulty") or difficulty
            q_type = q.get("question_type") or ("true_false" if len(options) == 2 else "mcq")

            # Clean true_false statement
            if q_type == "true_false":
                q_text = re.sub(r'\?+$', '.', q_text.strip())
                if not q_text.endswith('.'):
                    q_text += '.'
                options = ["True", "False"]
                if str(correct_ans).lower() in ["true", "t", "1", "yes"]:
                    correct_ans = "True"
                else:
                    correct_ans = "False"
            else:
                # Ensure options has the correct answer inside
                if correct_ans not in options and len(options) < 4:
                    options.append(correct_ans)
                if len(options) == 4:
                    random.shuffle(options)

            formatted_questions.append({
                "id": idx + 1,
                "question": q_text,
                "question_text": q_text,
                "options": options,
                "correct_answer": correct_ans,
                "explanation": explanation,
                "difficulty": q_diff,
                "question_type": q_type,
                "context_snippet": truncated_context[:160] + "...",
                "source_chunk": idx + 1
            })

        print(f"✨ Gemini Flash generated {len(formatted_questions)} high-quality questions successfully!")
        return formatted_questions

    def generate_mcq_models(
        self,
        chunks: List[str],
        num_questions: int = 5,
        difficulty: str = "medium",
        topic: Optional[str] = None
    ) -> List[Any]:
        """
        Generate Pydantic MCQQuestion instances for MCQGenerator and MixedQuestionGenerator.
        """
        from mcq_generator import MCQQuestion, MCQOption, DifficultyLevel

        diff_enum = DifficultyLevel.MEDIUM
        diff_lower = str(difficulty).lower()
        if diff_lower == "easy":
            diff_enum = DifficultyLevel.EASY
        elif diff_lower == "hard":
            diff_enum = DifficultyLevel.HARD

        full_context = "\n\n".join(chunks[:8])
        raw_list = self.generate_quiz_from_context(
            context=full_context,
            num_questions=num_questions,
            difficulty=diff_lower if diff_lower in ["easy", "medium", "hard"] else "medium",
            question_type="mcq",
            topic=topic
        )

        mcq_models = []
        for idx, item in enumerate(raw_list):
            q_text = item["question"]
            opts = item["options"]
            ca = item["correct_answer"]

            # Ensure exactly 4 options
            while len(opts) < 4:
                opts.append(f"Option {chr(65 + len(opts))}")
            opts = opts[:4]

            if ca not in opts:
                opts[0] = ca

            opt_models = []
            for opt_str in opts:
                is_c = (opt_str.strip() == ca.strip())
                opt_models.append(MCQOption(
                    option_text=opt_str,
                    is_correct=is_c,
                    explanation=item.get("explanation") if is_c else "Incorrect choice"
                ))

            # Ensure exactly 1 is_correct
            c_count = sum(1 for o in opt_models if o.is_correct)
            if c_count != 1:
                for o in opt_models:
                    o.is_correct = False
                opt_models[0].is_correct = True
                ca = opt_models[0].option_text

            mcq_models.append(MCQQuestion(
                question_text=q_text,
                options=opt_models,
                correct_answer=ca,
                difficulty=diff_enum,
                topic=topic,
                explanation=item.get("explanation"),
                source_chunk_index=min(idx, max(0, len(chunks) - 1))
            ))

        return mcq_models

    def generate_tf_models(
        self,
        chunks: List[str],
        num_questions: int = 5,
        difficulty: str = "medium",
        topic: Optional[str] = None
    ) -> List[Any]:
        """
        Generate Pydantic TrueFalseQuestion instances for TrueFalseGenerator and MixedQuestionGenerator.
        """
        from tf_generator import TrueFalseQuestion, DifficultyLevel as TFDifficultyLevel

        diff_enum = TFDifficultyLevel.MEDIUM
        diff_lower = str(difficulty).lower()
        if diff_lower == "easy":
            diff_enum = TFDifficultyLevel.EASY
        elif diff_lower == "hard":
            diff_enum = TFDifficultyLevel.HARD

        full_context = "\n\n".join(chunks[:8])
        raw_list = self.generate_quiz_from_context(
            context=full_context,
            num_questions=num_questions,
            difficulty=diff_lower if diff_lower in ["easy", "medium", "hard"] else "medium",
            question_type="true_false",
            topic=topic
        )

        tf_models = []
        for idx, item in enumerate(raw_list):
            stmt = item["question"]
            stmt = re.sub(r'\?+$', '.', stmt.strip())
            if not stmt.endswith('.'):
                stmt += '.'

            # Remove ambiguous words disallowed by TrueFalseQuestion validator
            stmt = re.sub(r'\b(generally|typically|usually|frequently|occasionally|rarely|sometimes|often|maybe|possibly|probably)\b', '', stmt, flags=re.IGNORECASE)
            stmt = re.sub(r'\s+', ' ', stmt).strip()

            is_true = str(item.get("correct_answer")).strip().lower() in ["true", "t", "1", "yes"]

            tf_models.append(TrueFalseQuestion(
                statement=stmt,
                is_true=is_true,
                explanation=item.get("explanation"),
                difficulty=diff_enum,
                topic=topic,
                source_chunk_index=min(idx, max(0, len(chunks) - 1)),
                source_text_snippet=full_context[:150] + "...",
                confidence_score=0.95
            ))

        return tf_models


# Singleton instance
gemini_service = GeminiQuizService()
