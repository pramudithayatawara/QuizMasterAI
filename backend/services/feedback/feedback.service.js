'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * @service FeedbackService
 * @description Module 06: AI-powered feedback generation using Google Gemini
 * Generates personalized feedback, study recommendations, and remediation suggestions
 */
class FeedbackService {
  constructor() {
    // Initialize Gemini AI client
    if (config.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash-latest',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });
    } else {
      logger.warn('[Feedback Service] GEMINI_API_KEY not configured. AI feedback will be disabled.');
      this.model = null;
    }
  }

  /**
   * @method generateFeedback
   * @description Generate AI-powered feedback based on quiz performance
   * @param {object} performanceData - User performance data
   * @returns {object} AI feedback with summary, improvements, and topics
   */
  async generateFeedback(performanceData) {
    if (!this.model) {
      return this._generateFallbackFeedback(performanceData);
    }

    try {
      logger.info(`[Feedback Service] Generating AI feedback for user: ${performanceData.userId}`);

      const feedbackPrompt = this._buildFeedbackPrompt(performanceData);

      const result = await this.model.generateContent(feedbackPrompt);
      const responseText = result.response.text();

      // Parse the JSON response
      const feedback = this._parseAIResponse(responseText);

      logger.info(`[Feedback Service] AI feedback generated successfully`);
      
      return {
        ...feedback,
        confidenceLevel: 'high',
        feedbackGeneratedAt: new Date(),
      };
    } catch (error) {
      logger.error(`[Feedback Service] AI feedback generation error: ${error.message}`);
      return this._generateFallbackFeedback(performanceData);
    }
  }

  /**
   * @method _buildFeedbackPrompt
   * @description Build the prompt for AI feedback generation
   * @param {object} performanceData - User performance data
   * @returns {string} Formatted prompt for Gemini
   */
  _buildFeedbackPrompt(performanceData) {
    const {
      scorePercentage,
      correctCount,
      wrongCount,
      skippedCount,
      totalQuestions,
      difficultyPlayed,
      weakTopics,
      topicAccuracy,
      timeTakenSeconds,
      recentPerformance,
    } = performanceData;

    const prompt = `
You are an expert educational AI coach specializing in personalized learning feedback. 
Analyze the following quiz performance data and provide constructive, actionable feedback.

## Quiz Performance Data:
- Score: ${scorePercentage}% (${correctCount}/${totalQuestions} correct)
- Wrong Answers: ${wrongCount}
- Skipped Questions: ${skippedCount}
- Difficulty Level: ${difficultyPlayed}
- Time Taken: ${Math.round(timeTakenSeconds / 60)} minutes
- Weak Topics: ${weakTopics.join(', ') || 'None identified'}
- Topic Accuracy: ${JSON.stringify(topicAccuracy)}
- Recent Performance Trend: ${recentPerformance ? 'Improving' : 'Not enough data'}

## Task:
Generate a JSON response with the following structure:
{
  "summary": "A 2-3 sentence summary of the student's overall performance, highlighting strengths and areas for improvement",
  "strengths": ["List 2-3 specific strengths based on their performance"],
  "weaknesses": ["List 2-3 specific areas that need improvement"],
  "suggestedImprovements": [
    "Actionable study recommendation 1 specific to weak topics",
    "Actionable study recommendation 2 with specific techniques",
    "Actionable study recommendation 3 focusing on their difficulty level"
  ],
  "recommendedTopicsToReview": [
    "Topic 1 (with specific focus area)",
    "Topic 2 (with specific focus area)",
    "Topic 3 (with specific focus area)"
  ],
  "studyStrategies": [
    "Strategy 1 for improving their weak areas",
    "Strategy 2 for time management if applicable",
    "Strategy 3 for topic mastery"
  ],
  "encouragement": "A motivating message tailored to their performance level"
}

## Guidelines:
- Be encouraging but honest about areas needing improvement
- Provide specific, actionable suggestions (not generic advice)
- Consider the difficulty level when giving feedback
- Focus on the identified weak topics and topic accuracy
- If score > 80%, focus on advanced improvement strategies
- If score 60-80%, focus on consolidating strengths and addressing weaknesses
- If score < 60%, focus on foundational improvement and confidence building
- Ensure all suggestions are practical and achievable
- Keep the tone supportive and growth-oriented

Respond ONLY with valid JSON, no additional text.
`;

    return prompt;
  }

  /**
   * @method _parseAIResponse
   * @description Parse the AI response and extract JSON
   * @param {string} responseText - Raw AI response
   * @returns {object} Parsed feedback object
   */
  _parseAIResponse(responseText) {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonString);
      }
      
      // Fallback: try parsing the entire response
      return JSON.parse(responseText);
    } catch (error) {
      logger.error(`[Feedback Service] JSON parsing error: ${error.message}`);
      return this._getDefaultFeedbackStructure();
    }
  }

  /**
   * @method _generateFallbackFeedback
   * @description Generate fallback feedback when AI is unavailable
   * @param {object} performanceData - User performance data
   * @returns {object} Fallback feedback
   */
  _generateFallbackFeedback(performanceData) {
    const { scorePercentage, weakTopics, difficultyPlayed } = performanceData;

    let summary, encouragement;

    if (scorePercentage >= 80) {
      summary = `Excellent performance! You demonstrated strong understanding of the material at ${difficultyPlayed} level. Your answers show good command of the core concepts.`;
      encouragement = "Outstanding work! Keep challenging yourself with higher difficulty levels to continue your growth.";
    } else if (scorePercentage >= 60) {
      summary = `Good performance! You have a solid foundation but there are areas that need attention. Focus on the identified weak topics to improve your consistency.`;
      encouragement = "You're on the right track! With focused practice on your weak areas, you'll see significant improvement.";
    } else {
      summary = `This quiz highlighted areas that need more attention. Don't be discouraged - this is valuable feedback for your learning journey. Focus on building a stronger foundation in the weak topics.`;
      encouragement = "Every expert was once a beginner. Use this feedback as a roadmap for improvement, and you'll see progress!";
    }

    const suggestedImprovements = [
      `Review the weak topics: ${weakTopics.slice(0, 3).join(', ') || 'key concepts from the material'}`,
      `Practice more questions at ${difficultyPlayed} difficulty level to build confidence`,
      'Focus on understanding the underlying concepts rather than memorization',
    ];

    const recommendedTopicsToReview = weakTopics.length > 0 
      ? weakTopics.slice(0, 5)
      : ['Core concepts from the study material', 'Key terminology and definitions', 'Main principles and theories'];

    return {
      summary,
      strengths: this._identifyStrengths(performanceData),
      weaknesses: this._identifyWeaknesses(performanceData),
      suggestedImprovements,
      recommendedTopicsToReview,
      studyStrategies: [
        'Active recall practice with flashcards',
        'Teach concepts to others to reinforce understanding',
        'Practice with spaced repetition for long-term retention',
      ],
      encouragement,
      confidenceLevel: 'medium',
      feedbackGeneratedAt: new Date(),
    };
  }

  /**
   * @method _identifyStrengths
   * @description Identify strengths based on performance data
   * @param {object} performanceData - User performance data
   * @returns {Array} List of strengths
   */
  _identifyStrengths(performanceData) {
    const { scorePercentage, topicAccuracy, correctCount, totalQuestions } = performanceData;
    const strengths = [];

    if (scorePercentage >= 80) {
      strengths.push('Strong overall performance');
    }
    if (scorePercentage >= 60) {
      strengths.push('Good foundational understanding');
    }
    if (correctCount / totalQuestions >= 0.7) {
      strengths.push('Consistent answer accuracy');
    }

    // Identify strong topics
    if (topicAccuracy) {
      const strongTopics = Object.entries(topicAccuracy)
        .filter(([_, accuracy]) => accuracy >= 70)
        .map(([topic, _]) => topic);
      
      if (strongTopics.length > 0) {
        strengths.push(`Strong performance in: ${strongTopics.slice(0, 2).join(', ')}`);
      }
    }

    return strengths.length > 0 ? strengths : ['Participation and effort'];
  }

  /**
   * @method _identifyWeaknesses
   * @description Identify weaknesses based on performance data
   * @param {object} performanceData - User performance data
   * @returns {Array} List of weaknesses
   */
  _identifyWeaknesses(performanceData) {
    const { scorePercentage, weakTopics, wrongCount, skippedCount, topicAccuracy } = performanceData;
    const weaknesses = [];

    if (scorePercentage < 60) {
      weaknesses.push('Needs foundational review');
    }
    if (wrongCount > 0) {
      weaknesses.push('Some conceptual gaps');
    }
    if (skippedCount > 0) {
      weaknesses.push('Time management or confidence issues');
    }

    // Identify weak topics
    if (weakTopics && weakTopics.length > 0) {
      weaknesses.push(`Needs improvement in: ${weakTopics.slice(0, 2).join(', ')}`);
    }

    // Identify weak topics from accuracy
    if (topicAccuracy) {
      const weakTopicsFromAccuracy = Object.entries(topicAccuracy)
        .filter(([_, accuracy]) => accuracy < 60)
        .map(([topic, _]) => topic);
      
      if (weakTopicsFromAccuracy.length > 0) {
        weaknesses.push(`Low accuracy in: ${weakTopicsFromAccuracy.slice(0, 2).join(', ')}`);
      }
    }

    return weaknesses.length > 0 ? weaknesses : ['Could benefit from more practice'];
  }

  /**
   * @method _getDefaultFeedbackStructure
   * @description Get default feedback structure
   * @returns {object} Default feedback structure
   */
  _getDefaultFeedbackStructure() {
    return {
      summary: 'Your performance shows areas for improvement. Focus on the recommended topics and strategies below.',
      strengths: ['Effort and participation'],
      weaknesses: ['Needs more practice in key areas'],
      suggestedImprovements: [
        'Review the study material thoroughly',
        'Practice with additional questions',
        'Focus on understanding core concepts',
      ],
      recommendedTopicsToReview: ['Core concepts', 'Key principles', 'Important theories'],
      studyStrategies: [
        'Active recall practice',
        'Spaced repetition',
        'Teach concepts to others',
      ],
      encouragement: 'Keep practicing and you will improve!',
      confidenceLevel: 'low',
      feedbackGeneratedAt: new Date(),
    };
  }

  /**
   * @method calculateTopicAccuracy
   * @description Calculate accuracy by topic
   * @param {Array} details - Question evaluation details
   * @returns {object} Topic accuracy mapping
   */
  calculateTopicAccuracy(details) {
    const topicStats = {};

    details.forEach((detail) => {
      const topic = detail.topic || 'General';
      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0 };
      }
      topicStats[topic].total++;
      if (detail.isCorrect) {
        topicStats[topic].correct++;
      }
    });

    const topicAccuracy = {};
    Object.entries(topicStats).forEach(([topic, stats]) => {
      topicAccuracy[topic] = Math.round((stats.correct / stats.total) * 100);
    });

    return topicAccuracy;
  }

  /**
   * @method calculatePerformanceMetrics
   * @description Calculate detailed performance metrics
   * @param {Array} details - Question evaluation details
   * @param {number} totalTime - Total time taken
   * @returns {object} Performance metrics
   */
  calculatePerformanceMetrics(details, totalTime) {
    const answeredQuestions = details.filter(d => d.userAnswer !== null);
    const times = answeredQuestions.map(d => d.timeTaken || 0);

    return {
      averageTimePerQuestion: times.length > 0 ? Math.round(totalTime / details.length) : 0,
      fastestQuestionTime: times.length > 0 ? Math.min(...times) : 0,
      slowestQuestionTime: times.length > 0 ? Math.max(...times) : 0,
    };
  }
}

module.exports = new FeedbackService();