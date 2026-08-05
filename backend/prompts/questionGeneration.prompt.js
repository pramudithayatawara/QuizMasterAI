'use strict';

/**
 * @module questionGenerationPrompt
 * @description LLM prompt templates for quiz question generation.
 */

/**
 * @function buildQuestionGenerationPrompt
 * @param {string} context - Retrieved PDF content chunks
 * @param {number} mcqCount - Number of MCQ questions to generate
 * @param {number} tfCount - Number of True/False questions to generate
 * @param {string} difficulty - Target difficulty level
 * @returns {string} Formatted prompt
 */
const buildQuestionGenerationPrompt = (context, mcqCount, tfCount, difficulty) => {
  return `You are an expert educational quiz generator. Generate quiz questions strictly based on the provided context.

CONTEXT:
${context}

INSTRUCTIONS:
1. Generate exactly ${mcqCount} Multiple Choice Questions (MCQ)
2. Generate exactly ${tfCount} True/False Questions
3. All questions must be based ONLY on the provided context
4. Target difficulty: ${difficulty.toUpperCase()}
5. Each MCQ must have exactly 4 options (A, B, C, D)
6. Only one correct answer per question
7. Avoid duplicate or similar questions
8. Include the relevant topic for each question

DIFFICULTY GUIDELINES:
- Easy: Test basic facts and definitions (Bloom's: Remember/Understand)
- Medium: Apply concepts and make connections (Bloom's: Apply/Analyze)
- Hard: Evaluate, synthesize, and reason across concepts (Bloom's: Evaluate/Create)

OUTPUT FORMAT (Strict JSON):
{
  "questions": [
    {
      "type": "mcq",
      "questionText": "Question here?",
      "options": {
        "A": "Option A",
        "B": "Option B",
        "C": "Option C",
        "D": "Option D"
      },
      "correctAnswer": "A",
      "explanation": "Why this answer is correct",
      "topic": "Topic name from content",
      "bloomsLevel": "remember|understand|apply|analyze|evaluate|create",
      "difficulty": "${difficulty}"
    },
    {
      "type": "true_false",
      "questionText": "Statement here.",
      "options": {
        "A": "True",
        "B": "False"
      },
      "correctAnswer": "A",
      "explanation": "Why this is true/false",
      "topic": "Topic name from content",
      "bloomsLevel": "remember|understand|apply|analyze|evaluate|create",
      "difficulty": "${difficulty}"
    }
  ]
}

Return ONLY valid JSON. No markdown, no code blocks, no extra text.`;
};

module.exports = { buildQuestionGenerationPrompt };