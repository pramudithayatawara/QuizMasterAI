'use strict';

/**
 * @module feedbackPrompt
 * @description Prompt template for AI-generated personalized feedback.
 */

const buildFeedbackPrompt = (performanceData) => {
  const { score, difficulty, weakTopics, correctCount, wrongCount, totalQuestions } = performanceData;

  return `You are an educational AI tutor. Generate personalized, encouraging feedback for a student's quiz performance.

PERFORMANCE DATA:
- Score: ${score}%
- Difficulty: ${difficulty.toUpperCase()}
- Correct Answers: ${correctCount}/${totalQuestions}
- Wrong Answers: ${wrongCount}/${totalQuestions}
- Weak Topics: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None identified'}

FEEDBACK GUIDELINES:
1. Be encouraging and constructive
2. Acknowledge achievements
3. Address weak areas specifically
4. Provide actionable improvement suggestions
5. Match tone to performance (celebrate high scores, motivate low scores)
6. Keep feedback concise (2-3 paragraphs)

Score Performance Context:
- 90-100%: Excellent performance
- 75-89%: Good performance
- 60-74%: Average performance  
- 40-59%: Below average - needs improvement
- 0-39%: Poor - significant improvement needed

OUTPUT FORMAT (Strict JSON):
{
  "overallFeedback": "2-3 paragraph encouraging feedback",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Area to improve 1", "Area to improve 2"],
  "suggestions": [
    "Specific study suggestion 1",
    "Specific study suggestion 2"
  ],
  "motivationalMessage": "Short encouraging closing message",
  "performanceGrade": "excellent|good|average|below_average|poor"
}

Return ONLY valid JSON.`;
};

module.exports = { buildFeedbackPrompt };