'use strict';

/**
 * @module difficultyClassificationPrompt
 * @description Prompt for AI-based question difficulty classification.
 */

const buildDifficultyClassificationPrompt = (question) => {
  return `Analyze this quiz question and classify its difficulty level.

QUESTION: "${question.questionText}"
TYPE: ${question.type}
${question.options ? `OPTIONS: ${JSON.stringify(question.options)}` : ''}
CORRECT ANSWER: ${question.correctAnswer}

CLASSIFICATION CRITERIA:
- EASY: Tests basic recall/recognition, simple definitions, direct facts
  (Bloom's: Remember, Understand)
- MEDIUM: Requires applying knowledge, making connections, some analysis
  (Bloom's: Apply, Analyze)  
- HARD: Requires complex reasoning, evaluation, synthesis of multiple concepts
  (Bloom's: Evaluate, Create)

Consider:
1. Concept complexity (0-10)
2. Context length and complexity
3. Reasoning required (0-10)
4. Bloom's Taxonomy level

OUTPUT FORMAT (Strict JSON):
{
  "difficulty": "easy|medium|hard",
  "bloomsLevel": "remember|understand|apply|analyze|evaluate|create",
  "conceptComplexity": 5,
  "reasoningRequired": 5,
  "explanation": "Brief reason for classification"
}

Return ONLY valid JSON.`;
};

module.exports = { buildDifficultyClassificationPrompt };