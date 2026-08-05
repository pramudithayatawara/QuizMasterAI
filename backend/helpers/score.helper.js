'use strict';

/**
 * @module scoreHelper
 * @description Score calculation utilities for quiz evaluation.
 */

/**
 * @function calculateScorePercentage
 * @param {number} correct - Number of correct answers
 * @param {number} total - Total questions
 * @returns {number} Score percentage rounded to 2 decimal places
 */
const calculateScorePercentage = (correct, total) => {
  if (total === 0) return 0;
  return parseFloat(((correct / total) * 100).toFixed(2));
};

/**
 * @function evaluateAnswers
 * @param {Array} userAnswers - User's submitted answers
 * @param {Array} questions - Quiz questions with correct answers
 * @returns {object} Evaluation result
 */
const evaluateAnswers = (userAnswers, questions) => {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const details = [];
  const weakTopics = new Set();

  questions.forEach((question, index) => {
    const userAnswer = userAnswers.find(
      (a) => a.questionId.toString() === question._id.toString()
    );

    let isCorrect = false;
    let userSelectedAnswer = null;

    if (!userAnswer || userAnswer.answer === null || userAnswer.answer === undefined) {
      skipped++;
      weakTopics.add(question.topic || 'General');
    } else {
      userSelectedAnswer = userAnswer.answer;
      isCorrect = String(userAnswer.answer).trim().toLowerCase() ===
                  String(question.correctAnswer).trim().toLowerCase();

      if (isCorrect) {
        correct++;
      } else {
        wrong++;
        weakTopics.add(question.topic || 'General');
      }
    }

    details.push({
      questionId: question._id,
      questionText: question.questionText,
      userAnswer: userSelectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect,
      topic: question.topic,
      difficulty: question.difficulty,
    });
  });

  const percentage = calculateScorePercentage(correct, questions.length);

  return {
    correct,
    wrong,
    skipped,
    total: questions.length,
    percentage,
    details,
    weakTopics: [...weakTopics],
  };
};

module.exports = { calculateScorePercentage, evaluateAnswers };