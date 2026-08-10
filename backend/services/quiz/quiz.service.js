'use strict';

const Quiz = require('../../models/Quiz.model');
const QuizAttempt = require('../../models/QuizAttempt.model');
const ragService = require('../rag/rag.service');
const adaptiveService = require('../adaptive/adaptive.service');
const { DIFFICULTY_TIMERS } = require('../../constants/difficulty');
const { QUIZ_STATUS, ATTEMPT_STATUS } = require('../../constants/quiz');
const { evaluateAnswers } = require('../../helpers/score.helper');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const aiService = require('../ai/ai.service');
const {
  getPaginationParams,
  buildPaginationMeta,
} = require('../../helpers/pagination.helper');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * @service QuizService
 * @description Manages quiz generation, retrieval, and attempt handling.
 *
 * Complete quiz lifecycle:
 * Generate → Start → Answer → Submit → Evaluate → Save Result
 */

class QuizService {
  /**
   * @method generateQuiz
   * @description Generate adaptive quiz from PDF using RAG pipeline (legacy method).
   * @param {string} pdfId - Source PDF ID
   * @param {string} userId - Requesting user ID
   * @param {object} options - Generation options
   * @returns {object} Generated quiz
   */
  async generateQuiz(pdfId, userId, options = {}) {
    // Use the new RAG-based method by default
    return this.generateQuizFromPdf(pdfId, userId, options);
  }

  /**
   * @method generateQuizFromPdf
   * @description Generate quiz from PDF using RAG pipeline with Gemini AI.
   * @param {string} pdfId - Source PDF ID
   * @param {string} userId - Requesting user ID
   * @param {object} options - Generation options
   * @returns {object} Generated quiz
   */
  async generateQuizFromPdf(pdfId, userId, options = {}) {
    const PdfDocument = require('../../models/PdfDocument.model');
    const PdfChunk = require('../../models/PdfChunk.model');
    const { QUIZ_STATUS } = require('../../constants/quiz');
    const { DIFFICULTY_TIMERS } = require('../../constants/difficulty');

    // Step 1: Get PDF and validate
    const pdf = await PdfDocument.findOne({ _id: pdfId, userId });

    if (!pdf) {
      throw new AppError('PDF not found.', 404, 'PDF_NOT_FOUND');
    }

    if (pdf.status !== 'completed') {
      throw new AppError(
        `PDF is not ready for quiz generation. Current status: ${pdf.status}`,
        400,
        'PDF_NOT_READY'
      );
    }

    logger.info(
      `[RAG QuizGen] Starting for PDF: ${pdfId} | User: ${userId}`
    );

    // Step 2: Retrieve relevant chunks using vector similarity search
    logger.info('[RAG QuizGen] Retrieving relevant chunks via vector search...');
    const relevantChunks = await this._retrieveRelevantChunks(pdfId, userId);

    if (!relevantChunks || relevantChunks.length === 0) {
      throw new AppError(
        'No chunks found for this PDF. Please ensure the PDF has been processed.',
        400,
        'NO_CHUNKS_FOUND'
      );
    }

    logger.info(`[RAG QuizGen] Retrieved ${relevantChunks.length} relevant chunks`);

    // Step 3: Assemble context from retrieved chunks
    const context = this._assembleContextFromChunks(relevantChunks);
    const difficulty = options.difficulty || 'medium';
    const questionCount = options.questionCount || 10;

    // Step 4: Construct prompt for Gemini with JSON schema
    const prompt = this._constructQuizPrompt(context, difficulty, questionCount);
    const jsonSchema = this._getQuizJSONSchema();

    // Step 5: Call Gemini API with structured JSON output
    logger.info(`[RAG QuizGen] Generating ${questionCount} questions with Gemini...`);
    const quizData = await this._generateQuizWithGemini(prompt, jsonSchema);

    // Step 6: Validate and process generated questions
    const processedQuestions = this._processGeneratedQuestions(
      quizData.questions,
      relevantChunks,
      difficulty
    );

    // Step 7: Calculate time limit based on difficulty
    const timeLimit = DIFFICULTY_TIMERS[difficulty] || 15;

    // Step 8: Generate quiz title
    const title = this._generateQuizTitle(pdf.originalName, difficulty);

    // Step 9: Save quiz to database
    const contextReferences = relevantChunks.map(chunk => ({
      chunkIndex: chunk.chunkIndex,
      text: chunk.text.substring(0, 200) + '...', // Store first 200 chars for reference
      relevanceScore: chunk.score || 0
    }));

    const quiz = await Quiz.create({
      userId,
      pdfId,
      title,
      questions: processedQuestions,
      totalQuestions: processedQuestions.length,
      mcqCount: processedQuestions.filter((q) => q.type === 'mcq').length,
      trueFalseCount: processedQuestions.filter((q) => q.type === 'true_false').length,
      difficulty,
      timeLimit,
      status: QUIZ_STATUS.READY,
      retrievedChunks: relevantChunks.map(c => c.chunkIndex),
      generationModel: 'gemini-1.5-pro',
      contextReferences,
    });

    logger.info(
      `✅ RAG Quiz generated: ${quiz._id} | ${processedQuestions.length} questions | ${difficulty}`
    );

    return quiz;
  }

  /**
   * @private _retrieveRelevantChunks
   * @description Retrieve relevant chunks using vector similarity search.
   */
  async _retrieveRelevantChunks(pdfId, userId) {
    const PdfChunk = require('../../models/PdfChunk.model');
    const embeddingService = require('../embeddings/embeddings.service');

    // Get all chunks for the PDF
    const chunks = await PdfChunk.find({ pdfId, userId }).sort({ chunkIndex: 1 });

    if (chunks.length === 0) {
      return [];
    }

    // Generate embedding for quiz generation query
    const queryEmbedding = await embeddingService.generateEmbedding(
      'Generate comprehensive quiz questions covering main concepts, definitions, and important facts'
    );

    // Calculate cosine similarity between query and each chunk
    const chunksWithScores = chunks.map(chunk => ({
      ...chunk.toObject(),
      score: this._calculateCosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort by similarity score and return top chunks
    chunksWithScores.sort((a, b) => b.score - a.score);

    // Return top 10 most relevant chunks (or all if less than 10)
    return chunksWithScores.slice(0, Math.min(10, chunksWithScores.length));
  }

  /**
   * @private _calculateCosineSimilarity
   * @description Calculate cosine similarity between two vectors.
   */
  _calculateCosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * @private _assembleContextFromChunks
   * @description Assemble context string from retrieved chunks.
   */
  _assembleContextFromChunks(chunks) {
    // Sort by chunk index for coherent reading order
    const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);

    return sorted.map((chunk, index) => 
      `[Chunk ${chunk.chunkIndex}]: ${chunk.text}`
    ).join('\n\n');
  }

  /**
   * @private _constructQuizPrompt
   * @description Construct prompt for Gemini AI with context and requirements.
   */
  _constructQuizPrompt(context, difficulty, questionCount) {
    const mcqCount = Math.ceil(questionCount * 0.6); // 60% MCQs
    const tfCount = questionCount - mcqCount; // 40% True/False

    return `You are an expert educational content creator. Generate a quiz based STRICTLY on the following context from a PDF document.

CONTEXT:
${context}

REQUIREMENTS:
1. Generate exactly ${questionCount} questions total:
   - ${mcqCount} Multiple Choice Questions (MCQs)
   - ${tfCount} True/False Questions
2. Difficulty level: ${difficulty}
3. For MCQs: Provide exactly 4 options (A, B, C, D) with exactly ONE correct answer
4. For True/False: Provide options A (True) and B (False) with exactly ONE correct answer
5. Ensure all questions are based ONLY on the provided context
6. Avoid duplicate questions
7. Questions should test understanding of the key concepts in the context
8. Provide a brief explanation for each correct answer

IMPORTANT:
- Base your questions EXCLUSIVELY on the provided context
- Do not use external knowledge
- Make questions clear and unambiguous
- Ensure options are plausible but clearly distinguishable
- Mark the correct answer in the correctAnswer field`;

  }

  /**
   * @private _getQuizJSONSchema
   * @description Define JSON schema for structured output from Gemini.
   */
  _getQuizJSONSchema() {
    return {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              questionText: {
                type: "string",
                description: "The question text"
              },
              type: {
                type: "string",
                enum: ["mcq", "true_false"],
                description: "Question type: mcq or true_false"
              },
              options: {
                type: "object",
                properties: {
                  A: { type: "string" },
                  B: { type: "string" },
                  C: { type: "string" },
                  D: { type: "string" }
                },
                required: ["A", "B", "C", "D"]
              },
              correctAnswer: {
                type: "string",
                enum: ["A", "B", "C", "D"],
                description: "The correct option letter"
              },
              explanation: {
                type: "string",
                description: "Brief explanation of the correct answer"
              },
              topic: {
                type: "string",
                description: "Topic/category of the question"
              }
            },
            required: ["questionText", "type", "options", "correctAnswer", "explanation", "topic"]
          }
        }
      },
      required: ["questions"]
    };
  }

  /**
   * @private _generateQuizWithGemini
   * @description Generate quiz using Google Gemini AI with structured JSON output.
   */
  async _generateQuizWithGemini(prompt, jsonSchema) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      const result = await model.generateContent([
        {
          text: `${prompt}\n\nPlease respond with valid JSON that follows this schema:\n${JSON.stringify(jsonSchema, null, 2)}`
        }
      ]);

      const response = result.response.text();
      
      // Extract JSON from response (handle potential markdown formatting)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                       response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new AppError('Failed to extract JSON from Gemini response', 500);
      }

      const jsonString = jsonMatch[1] || jsonMatch[0];
      const quizData = JSON.parse(jsonString);

      if (!quizData.questions || !Array.isArray(quizData.questions)) {
        throw new AppError('Invalid quiz data structure from Gemini', 500);
      }

      // Validate minimum question count
      if (quizData.questions.length < 10) {
        logger.warn(`Gemini generated only ${quizData.questions.length} questions, attempting regeneration...`);
        // Could implement retry logic here
      }

      return quizData;
    } catch (error) {
      logger.error(`Gemini generation error: ${error.message}`);
      
      // Fallback: Generate basic questions if Gemini fails
      if (error.message.includes('API key') || error.message.includes('quota') || error.message.includes('404')) {
        logger.warn('Gemini API unavailable, using fallback question generation');
        return this._generateFallbackQuestions(prompt);
      }
      
      throw new AppError(`Failed to generate quiz with Gemini: ${error.message}`, 500);
    }
  }

  /**
   * @private _generateFallbackQuestions
   * @description Generate basic questions as fallback when Gemini API fails.
   */
  _generateFallbackQuestions(prompt) {
    // Extract context from prompt for basic question generation
    const contextMatch = prompt.match(/CONTEXT:([\s\S]*?)REQUIREMENTS:/);
    const context = contextMatch ? contextMatch[1].trim() : '';
    
    // Generate basic questions based on context keywords
    const basicQuestions = [];
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Generate MCQs from context sentences
    for (let i = 0; i < Math.min(6, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (sentence.length > 30) {
        basicQuestions.push({
          questionText: `Based on the context: "${sentence.substring(0, 50)}..." what is the main point?`,
          type: 'mcq',
          options: {
            A: 'The primary concept described in the text',
            B: 'An unrelated topic',
            C: 'A minor detail mentioned',
            D: 'None of the above'
          },
          correctAnswer: 'A',
          explanation: 'Based on the provided context.',
          topic: 'General'
        });
      }
    }
    
    // Generate True/False questions
    for (let i = 0; i < Math.min(4, sentences.length); i++) {
      const sentence = sentences[i].trim();
      if (sentence.length > 30) {
        basicQuestions.push({
          questionText: `True or False: The context states that "${sentence.substring(0, 50)}..."`,
          type: 'true_false',
          options: {
            A: 'True',
            B: 'False',
            C: 'True',
            D: 'False'
          },
          correctAnswer: 'A',
          explanation: 'Based on the provided context.',
          topic: 'General'
        });
      }
    }
    
    // Ensure minimum 10 questions
    while (basicQuestions.length < 10) {
      basicQuestions.push({
        questionText: `Question ${basicQuestions.length + 1}: Based on the provided context, what can be concluded?`,
        type: 'mcq',
        options: {
          A: 'The context provides relevant information',
          B: 'The context is unrelated',
          C: 'The context is incomplete',
          D: 'None of the above'
        },
        correctAnswer: 'A',
        explanation: 'Fallback generated question.',
        topic: 'General'
      });
    }
    
    return { questions: basicQuestions };
  }

  /**
   * @private _processGeneratedQuestions
   * @description Process and validate generated questions.
   */
  _processGeneratedQuestions(questions, relevantChunks, difficulty) {
    const { DIFFICULTY } = require('../../constants/difficulty');
    const seenQuestions = new Set();

    return questions.map((q, index) => {
      // Check for duplicates
      const questionKey = q.questionText.toLowerCase().trim();
      if (seenQuestions.has(questionKey)) {
        logger.warn(`Duplicate question detected and removed: ${q.questionText}`);
        return null;
      }
      seenQuestions.add(questionKey);

      // Find the most relevant chunk for this question
      const relevantChunk = this._findRelevantChunk(q.questionText, relevantChunks);

      return {
        questionText: q.questionText,
        type: q.type,
        options: new Map(Object.entries(q.options)),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic || 'General',
        difficulty: difficulty,
        bloomsLevel: this._inferBloomsLevel(q.questionText, difficulty),
        sourceChunkIndex: relevantChunk ? relevantChunk.chunkIndex : null,
        conceptComplexity: 5,
        reasoningRequired: 5,
        order: index + 1,
      };
    }).filter(q => q !== null); // Remove null entries (duplicates)
  }

  /**
   * @private _findRelevantChunk
   * @description Find the most relevant chunk for a question.
   */
  _findRelevantChunk(questionText, chunks) {
    const questionLower = questionText.toLowerCase();
    
    // Find chunk with highest keyword overlap
    let bestChunk = null;
    let maxOverlap = 0;

    for (const chunk of chunks) {
      const chunkText = chunk.text.toLowerCase();
      const questionWords = questionLower.split(/\s+/);
      const overlap = questionWords.filter(word => 
        word.length > 3 && chunkText.includes(word)
      ).length;

      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestChunk = chunk;
      }
    }

    return bestChunk;
  }

  /**
   * @private _inferBloomsLevel
   * @description Infer Bloom's taxonomy level from question and difficulty.
   */
  _inferBloomsLevel(questionText, difficulty) {
    const questionLower = questionText.toLowerCase();
    
    const bloomsKeywords = {
      remember: ['define', 'list', 'identify', 'name', 'state', 'what is', 'who is'],
      understand: ['explain', 'describe', 'summarize', 'interpret', 'discuss'],
      apply: ['apply', 'use', 'implement', 'solve', 'calculate'],
      analyze: ['analyze', 'compare', 'contrast', 'examine', 'differentiate'],
      evaluate: ['evaluate', 'assess', 'critique', 'judge', 'justify'],
      create: ['create', 'design', 'develop', 'formulate', 'construct']
    };

    for (const [level, keywords] of Object.entries(bloomsKeywords)) {
      if (keywords.some(keyword => questionLower.includes(keyword))) {
        return level;
      }
    }

    // Default based on difficulty
    const difficultyDefaults = {
      easy: 'remember',
      medium: 'understand',
      hard: 'analyze'
    };

    return difficultyDefaults[difficulty] || 'understand';
  }

  /**
   * @private _generateQuizTitle
   * @description Generate a title for the quiz.
   */
  _generateQuizTitle(pdfName, difficulty) {
    const cleanName = pdfName.replace('.pdf', '').replace(/_/g, ' ');
    const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    return `${cleanName} - ${difficultyLabel} Quiz`;
  }

  /**
   * @method startQuiz
   * @description Start a quiz attempt session.
   * @param {string} quizId - Quiz ID
   * @param {string} userId - User ID
   * @returns {object} Quiz attempt with questions (no correct answers)
   */
  async startQuiz(quizId, userId) {
    const quiz = await Quiz.findOne({ _id: quizId, userId });

    if (!quiz) {
      throw new AppError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.status !== QUIZ_STATUS.READY) {
      throw new AppError(
        'Quiz is not ready to be taken.',
        400,
        'QUIZ_NOT_READY'
      );
    }

    // Check for existing ongoing attempt
    const existingAttempt = await QuizAttempt.findOne({
      quizId,
      userId,
      status: ATTEMPT_STATUS.ONGOING,
    });

    if (existingAttempt) {
      // Return existing attempt
      return {
        attempt: existingAttempt,
        questions: quiz.getQuestionsForClient(),
        timeLimit: quiz.timeLimit,
        difficulty: quiz.difficulty,
        totalQuestions: quiz.totalQuestions,
      };
    }

    // Create new attempt
    const attempt = await QuizAttempt.create({
      userId,
      quizId,
      pdfId: quiz.pdfId,
      totalQuestions: quiz.totalQuestions,
      timeLimit: quiz.timeLimit * 60, // Convert to seconds
      difficulty: quiz.difficulty,
      status: ATTEMPT_STATUS.ONGOING,
      startedAt: new Date(),
    });

    return {
      attempt: {
        id: attempt._id,
        startedAt: attempt.startedAt,
        timeLimit: quiz.timeLimit,
      },
      questions: quiz.getQuestionsForClient(),
      difficulty: quiz.difficulty,
      totalQuestions: quiz.totalQuestions,
    };
  }

  /**
   * @method submitQuiz
   * @description Submit quiz answers and evaluate.
   * @param {string} attemptId - Quiz attempt ID
   * @param {string} userId - User ID
   * @param {Array} answers - User's answers
   * @param {number} timeTaken - Time taken in seconds
   * @returns {object} Evaluation result
   */
  async submitQuiz(attemptId, userId, answers, timeTaken) {
    // Get attempt
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      userId,
      status: ATTEMPT_STATUS.ONGOING,
    });

    if (!attempt) {
      throw new AppError(
        'Quiz attempt not found or already submitted.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    // Get quiz with correct answers
    const quiz = await Quiz.findById(attempt.quizId);

    if (!quiz) {
      throw new AppError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    // Check time limit (auto-submit if exceeded)
    const maxTime = quiz.timeLimit * 60;
    const actualTime = Math.min(timeTaken || maxTime, maxTime);
    const isAutoSubmit = timeTaken > maxTime;

    // Evaluate answers
    const evaluation = evaluateAnswers(answers, quiz.questions);

    // Update attempt
    await QuizAttempt.findByIdAndUpdate(attemptId, {
      answers: evaluation.details.map((d) => ({
        questionId: d.questionId,
        answer: d.userAnswer,
        isCorrect: d.isCorrect,
        timeTaken: 0,
      })),
      score: evaluation.correct,
      percentage: evaluation.percentage,
      correctCount: evaluation.correct,
      wrongCount: evaluation.wrong,
      skippedCount: evaluation.skipped,
      timeTaken: actualTime,
      status: ATTEMPT_STATUS.COMPLETED,
      isAutoSubmitted: isAutoSubmit,
      completedAt: new Date(),
      weakTopics: evaluation.weakTopics,
    });

    logger.info(
      `Quiz submitted: ${attemptId} | Score: ${evaluation.percentage}% | ` +
      `Correct: ${evaluation.correct}/${evaluation.total}`
    );

    return {
      attemptId,
      ...evaluation,
      timeTaken: actualTime,
      isAutoSubmitted: isAutoSubmit,
      difficulty: quiz.difficulty,
    };
  }

  /**
   * @method getQuizzesByPdf
   * @description Get all quizzes generated from a specific PDF.
   * @param {string} pdfId - PDF document ID
   * @param {string} userId - User ID
   * @param {object} options - Pagination options
   * @returns {object} Quizzes with pagination
   */
  async getQuizzesByPdf(pdfId, userId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const [quizzes, total] = await Promise.all([
      Quiz.find({ pdfId, userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title difficulty totalQuestions mcqCount trueFalseCount timeLimit status createdAt'),
      Quiz.countDocuments({ pdfId, userId })
    ]);

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1
    };

    return { quizzes, pagination };
  }

  /**
   * @method getQuizById
   * @description Get specific quiz with questions and context references.
   * @param {string} quizId - Quiz ID
   * @param {string} userId - User ID
   * @returns {object} Quiz with full details
   */
  async getQuizById(quizId, userId) {
    const quiz = await Quiz.findOne({ _id: quizId, userId });

    if (!quiz) {
      throw new AppError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    // Return quiz with all details including context references
    return {
      id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      difficulty: quiz.difficulty,
      totalQuestions: quiz.totalQuestions,
      mcqCount: quiz.mcqCount,
      trueFalseCount: quiz.trueFalseCount,
      timeLimit: quiz.timeLimit,
      status: quiz.status,
      questions: quiz.questions,
      retrievedChunks: quiz.retrievedChunks,
      contextReferences: quiz.contextReferences,
      generationModel: quiz.generationModel,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt
    };
  }

  /**
   * @method getQuizForReview
   * @description Get completed quiz with answers for review.
   */
  async getQuizForReview(attemptId, userId) {
    const attempt = await QuizAttempt.findOne({
      _id: attemptId,
      userId,
      status: ATTEMPT_STATUS.COMPLETED,
    }).populate('quizId');

    if (!attempt) {
      throw new AppError(
        'Completed quiz attempt not found.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    const quiz = attempt.quizId;

    // Build review with correct answers
    const review = quiz.questions.map((question) => {
      const userAnswer = attempt.answers.find(
        (a) => a.questionId.toString() === question._id.toString()
      );

      return {
        questionId: question._id,
        questionText: question.questionText,
        type: question.type,
        options: question.options,
        correctAnswer: question.correctAnswer,
        userAnswer: userAnswer?.answer || null,
        isCorrect: userAnswer?.isCorrect || false,
        explanation: question.explanation,
        topic: question.topic,
        difficulty: question.difficulty,
      };
    });

    return {
      attemptId,
      quizTitle: quiz.title,
      difficulty: quiz.difficulty,
      score: attempt.score,
      percentage: attempt.percentage,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      skippedCount: attempt.skippedCount,
      timeTaken: attempt.timeTaken,
      completedAt: attempt.completedAt,
      review,
    };
  }

  /**
   * @method getUserQuizzes
   * @description Get all quizzes for a user.
   */
  async getUserQuizzes(userId, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);

    const filter = { userId };
    if (query.difficulty) filter.difficulty = query.difficulty;
    if (query.pdfId) filter.pdfId = query.pdfId;

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .select('-questions')
        .populate('pdfId', 'originalName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quiz.countDocuments(filter),
    ]);

    return {
      quizzes,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  /**
   * @method getQuizHistory
   * @description Get quiz attempt history for a user.
   */
  async getQuizHistory(userId, query = {}) {
    const { page, limit, skip } = getPaginationParams(query);

    const [attempts, total] = await Promise.all([
      QuizAttempt.find({
        userId,
        status: ATTEMPT_STATUS.COMPLETED,
      })
        .populate('quizId', 'title difficulty totalQuestions')
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-answers'),
      QuizAttempt.countDocuments({
        userId,
        status: ATTEMPT_STATUS.COMPLETED,
      }),
    ]);

    return {
      attempts,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}

module.exports = new QuizService();