'use strict';

const Battle = require('../../models/Battle.model');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * @service MatchmakingService
 * @description In-memory matchmaking queue with battle room creation.
 *
 * Flow:
 * 1. addToQueue(userId, userName, difficulty, io)
 *    → Adds player to queue
 *    → Checks if a match can be made (2+ players with same difficulty)
 *    → If match found: creates Battle doc, emits 'matchPlayers' to each player,
 *      then emits 'startBattle' with first question after a short delay.
 *
 * 2. removeFromQueue(userId)
 *    → Removes player from queue.
 *
 * 3. getQueueStatus() / isInQueue(userId) → utility helpers.
 */

// ─── In-Memory Queue ──────────────────────────────────────────────────────────
// Map<difficulty, Array<{ userId, userName, socketId, joinedAt }>>
const queues = {
  easy:   [],
  medium: [],
  hard:   [],
};

// Timeout handles per userId (for matchmaking timeout)
const timeoutHandles = new Map();

const MATCH_SIZE      = 2;    // Players per battle
const MAX_WAIT_MS     = 60000; // 60 seconds before timeout
const QUESTIONS_COUNT = 10;   // Questions per battle

class MatchmakingService {
  /**
   * @method addToQueue
   * @description Add a player to the matchmaking queue and attempt to find a match.
   * @param {string}   userId     - Authenticated user ID
   * @param {string}   userName   - Display name
   * @param {string}   difficulty - 'easy' | 'medium' | 'hard'
   * @param {object}   io         - Socket.io server instance
   * @returns {{ position, queueSize, difficulty }}
   */
  async addToQueue(userId, userName, difficulty = 'medium', io) {
    const diff = ['easy', 'medium', 'hard'].includes(difficulty)
      ? difficulty
      : 'medium';

    // Remove from any existing queue first (prevent duplicates)
    this.removeFromQueue(userId);

    // Add to queue
    queues[diff].push({ userId, userName, joinedAt: Date.now() });

    const position  = queues[diff].length;
    const queueSize = queues[diff].length;

    logger.info(
      `[Matchmaking] ${userName} joined ${diff} queue ` +
      `(position: ${position}, queue size: ${queueSize})`
    );

    // Set timeout for this player
    const handle = setTimeout(async () => {
      const removed = this._removeFromDiffQueue(userId, diff);
      if (removed && io) {
        // Notify via personal room
        io.to(`user:${userId}`).emit('matchmakingTimeout', {
          message: 'No opponent found within 60 seconds. Please try again.',
        });
        logger.info(`[Matchmaking] Timeout for ${userName} in ${diff} queue`);
      }
    }, MAX_WAIT_MS);

    timeoutHandles.set(userId, handle);

    // Try to make a match
    await this._tryMatch(diff, io);

    return { position, queueSize, difficulty: diff };
  }

  /**
   * @method removeFromQueue
   * @description Remove a player from all queues and cancel their timeout.
   * @param {string} userId
   */
  removeFromQueue(userId) {
    // Cancel timeout
    if (timeoutHandles.has(userId)) {
      clearTimeout(timeoutHandles.get(userId));
      timeoutHandles.delete(userId);
    }

    // Remove from all queues
    for (const diff of Object.keys(queues)) {
      this._removeFromDiffQueue(userId, diff);
    }
  }

  /**
   * @method getQueueStatus
   * @description Get current queue sizes for all difficulties.
   * @returns {{ easy, medium, hard, total }}
   */
  getQueueStatus() {
    return {
      easy:   queues.easy.length,
      medium: queues.medium.length,
      hard:   queues.hard.length,
      total:  queues.easy.length + queues.medium.length + queues.hard.length,
    };
  }

  /**
   * @method isInQueue
   * @description Check if a user is currently in any queue.
   * @param {string} userId
   * @returns {boolean}
   */
  isInQueue(userId) {
    return Object.values(queues).some((q) =>
      q.some((p) => p.userId === userId || p.userId?.toString() === userId?.toString())
    );
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * @private _tryMatch
   * @description Check if we have enough players for a match in a difficulty queue.
   */
  async _tryMatch(difficulty, io) {
    const queue = queues[difficulty];

    if (queue.length < MATCH_SIZE) return;

    // Take the first MATCH_SIZE players
    const matchedPlayers = queue.splice(0, MATCH_SIZE);

    // Cancel their timeouts
    for (const player of matchedPlayers) {
      if (timeoutHandles.has(player.userId)) {
        clearTimeout(timeoutHandles.get(player.userId));
        timeoutHandles.delete(player.userId);
      }
    }

    logger.info(
      `[Matchmaking] Match found! Players: ${matchedPlayers.map((p) => p.userName).join(' vs ')} ` +
      `| Difficulty: ${difficulty}`
    );

    try {
      // Generate battle questions using AI
      const questions = await this._generateBattleQuestions(difficulty);

      // Create the battle document
      const battle = await Battle.create({
        roomId:     uuidv4(),
        difficulty,
        status:     'waiting',
        maxPlayers: MATCH_SIZE,
        players:    matchedPlayers.map((p) => ({
          userId:       p.userId,
          userName:     p.userName,
          score:        0,
          totalPoints:  0,
          correctCount: 0,
          wrongCount:   0,
          bonusPoints:  0,
          rank:         0,
          isConnected:  true,
        })),
        questions,
        currentQuestionIndex: 0,
        startedAt:            new Date(),
        status:               'active',
      });

      logger.info(
        `[Matchmaking] Battle created: ${battle._id} | Room: ${battle.roomId}`
      );

      // Notify each matched player via their personal socket room
      const playerList = matchedPlayers.map((p) => ({
        userId:   p.userId,
        userName: p.userName,
      }));

      for (const player of matchedPlayers) {
        io.to(`user:${player.userId}`).emit('matchPlayers', {
          battleId:       battle._id,
          roomId:         battle.roomId,
          players:        playerList,
          difficulty,
          totalQuestions: questions.length,
        });
      }

      // After a brief delay, emit startBattle with first question
      // Emit to BOTH the battle room AND each player's personal room as a fallback
      // This ensures players receive the event even if they haven't joined the battle room yet
      setTimeout(() => {
        const firstQuestion = this._sanitizeQuestion(questions[0]);

        const startPayload = {
          battleId:        battle._id,
          roomId:          battle.roomId,
          question:        firstQuestion,
          questionIndex:   0,
          totalQuestions:  questions.length,
          timePerQuestion: 30,
          players:         playerList,
          difficulty,
        };

        // Primary: emit to battle room (players who joined in time)
        io.to(`battle:${battle.roomId}`).emit('startBattle', startPayload);

        // Fallback: emit directly to each player's personal room
        for (const player of matchedPlayers) {
          io.to(`user:${player.userId}`).emit('startBattle', startPayload);
        }

        logger.info(
          `[Matchmaking] Battle started: ${battle._id} | First question sent to ${matchedPlayers.length} players`
        );
      }, 3000); // 3 seconds for players to join room

    } catch (error) {
      logger.error(`[Matchmaking] Failed to create battle: ${error.message}`);

      // Re-queue players on error
      for (const player of matchedPlayers) {
        queues[difficulty].unshift(player);
      }

      // Notify players of error
      for (const player of matchedPlayers) {
        io.to(`user:${player.userId}`).emit('battleError', {
          type:    'MATCH_CREATION_ERROR',
          message: 'Failed to create battle. Please try again.',
        });
      }
    }
  }

  /**
   * @private _generateBattleQuestions
   * @description Generate questions for a battle using AI or fallback.
   * @param {string} difficulty
   * @returns {Array} questions array
   */
  async _generateBattleQuestions(difficulty) {
    try {
      // Try to use the AI service to generate questions
      const aiService = require('../ai/ai.service');

      const prompt = `Generate exactly ${QUESTIONS_COUNT} multiple-choice quiz questions for a competitive quiz battle.

Difficulty: ${difficulty}
Topics: Mix of general knowledge, science, history, technology, geography, and pop culture.

IMPORTANT: Return ONLY a valid JSON array, no markdown, no extra text.
Format each question exactly like this:
[
  {
    "question": "What is the question text?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "Option A",
    "difficulty": "${difficulty}",
    "explanation": "Brief explanation of the answer"
  }
]

Requirements:
- Exactly ${QUESTIONS_COUNT} questions
- Each question has exactly 4 options
- Questions are ${difficulty} difficulty level
- Mix different topic areas
- Each question is engaging and has a clear correct answer`;

      const result = await aiService.generateContent(prompt);
      let text = result?.text || result?.response || result;

      if (typeof text !== 'string') {
        throw new Error('Invalid AI response format');
      }

      // Clean markdown code blocks if present
      text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();

      const questions = JSON.parse(text);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format from AI');
      }

      logger.info(
        `[Matchmaking] AI generated ${questions.length} questions for ${difficulty} battle`
      );

      return questions.slice(0, QUESTIONS_COUNT);
    } catch (error) {
      logger.warn(
        `[Matchmaking] AI question generation failed (${error.message}), using fallback questions`
      );

      // Fallback: return hardcoded sample questions
      return this._getFallbackQuestions(difficulty);
    }
  }

  /**
   * @private _getFallbackQuestions
   * @description Hardcoded fallback questions when AI is unavailable.
   */
  _getFallbackQuestions(difficulty) {
    const allQuestions = {
      easy: [
        {
          question: 'What is the capital of France?',
          type: 'mcq',
          options: ['London', 'Berlin', 'Paris', 'Madrid'],
          correctAnswer: 'Paris',
          difficulty: 'easy',
          explanation: 'Paris is the capital and largest city of France.',
        },
        {
          question: 'How many sides does a triangle have?',
          type: 'mcq',
          options: ['2', '3', '4', '5'],
          correctAnswer: '3',
          difficulty: 'easy',
          explanation: 'A triangle is a polygon with three sides and three angles.',
        },
        {
          question: 'What color do you get by mixing red and white?',
          type: 'mcq',
          options: ['Orange', 'Purple', 'Pink', 'Yellow'],
          correctAnswer: 'Pink',
          difficulty: 'easy',
          explanation: 'Mixing red and white paint produces pink.',
        },
        {
          question: 'Which planet is known as the Red Planet?',
          type: 'mcq',
          options: ['Venus', 'Mars', 'Jupiter', 'Saturn'],
          correctAnswer: 'Mars',
          difficulty: 'easy',
          explanation: 'Mars is called the Red Planet due to its reddish appearance.',
        },
        {
          question: 'What is 7 × 8?',
          type: 'mcq',
          options: ['54', '56', '58', '62'],
          correctAnswer: '56',
          difficulty: 'easy',
          explanation: '7 multiplied by 8 equals 56.',
        },
        {
          question: 'Which ocean is the largest?',
          type: 'mcq',
          options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'],
          correctAnswer: 'Pacific',
          difficulty: 'easy',
          explanation: 'The Pacific Ocean is the largest and deepest ocean on Earth.',
        },
        {
          question: 'What language do people speak in Brazil?',
          type: 'mcq',
          options: ['Spanish', 'Portuguese', 'French', 'English'],
          correctAnswer: 'Portuguese',
          difficulty: 'easy',
          explanation: 'Brazil was colonized by Portugal, so Portuguese is the official language.',
        },
        {
          question: 'How many hours are in a day?',
          type: 'mcq',
          options: ['12', '18', '24', '36'],
          correctAnswer: '24',
          difficulty: 'easy',
          explanation: 'A day consists of 24 hours.',
        },
        {
          question: 'What is the smallest continent?',
          type: 'mcq',
          options: ['Europe', 'Antarctica', 'Australia', 'South America'],
          correctAnswer: 'Australia',
          difficulty: 'easy',
          explanation: 'Australia is the smallest continent by landmass.',
        },
        {
          question: 'What is the boiling point of water in Celsius?',
          type: 'mcq',
          options: ['90°C', '95°C', '100°C', '105°C'],
          correctAnswer: '100°C',
          difficulty: 'easy',
          explanation: 'Water boils at 100 degrees Celsius at standard atmospheric pressure.',
        },
      ],
      medium: [
        {
          question: 'Who wrote "Romeo and Juliet"?',
          type: 'mcq',
          options: ['Charles Dickens', 'William Shakespeare', 'Jane Austen', 'Mark Twain'],
          correctAnswer: 'William Shakespeare',
          difficulty: 'medium',
          explanation: 'Romeo and Juliet was written by William Shakespeare around 1594-1596.',
        },
        {
          question: 'What is the chemical symbol for Gold?',
          type: 'mcq',
          options: ['Go', 'Gd', 'Au', 'Ag'],
          correctAnswer: 'Au',
          difficulty: 'medium',
          explanation: 'Gold\'s chemical symbol Au comes from the Latin word "Aurum".',
        },
        {
          question: 'In which year did World War II end?',
          type: 'mcq',
          options: ['1943', '1944', '1945', '1946'],
          correctAnswer: '1945',
          difficulty: 'medium',
          explanation: 'World War II ended in 1945 with Germany surrendering in May and Japan in September.',
        },
        {
          question: 'What is the speed of light approximately?',
          type: 'mcq',
          options: ['200,000 km/s', '300,000 km/s', '400,000 km/s', '500,000 km/s'],
          correctAnswer: '300,000 km/s',
          difficulty: 'medium',
          explanation: 'The speed of light in a vacuum is approximately 299,792 km/s.',
        },
        {
          question: 'Which element has the atomic number 1?',
          type: 'mcq',
          options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'],
          correctAnswer: 'Hydrogen',
          difficulty: 'medium',
          explanation: 'Hydrogen is the lightest and most abundant element in the universe.',
        },
        {
          question: 'What is the currency of Japan?',
          type: 'mcq',
          options: ['Yuan', 'Won', 'Yen', 'Ringgit'],
          correctAnswer: 'Yen',
          difficulty: 'medium',
          explanation: 'The Japanese Yen (¥) is the official currency of Japan.',
        },
        {
          question: 'Who painted the Mona Lisa?',
          type: 'mcq',
          options: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Botticelli'],
          correctAnswer: 'Leonardo da Vinci',
          difficulty: 'medium',
          explanation: 'The Mona Lisa was painted by Leonardo da Vinci between 1503-1519.',
        },
        {
          question: 'What is the largest organ in the human body?',
          type: 'mcq',
          options: ['Heart', 'Liver', 'Brain', 'Skin'],
          correctAnswer: 'Skin',
          difficulty: 'medium',
          explanation: 'The skin is the largest organ, covering the entire body surface.',
        },
        {
          question: 'Which programming language was created by Guido van Rossum?',
          type: 'mcq',
          options: ['Java', 'Ruby', 'Python', 'Perl'],
          correctAnswer: 'Python',
          difficulty: 'medium',
          explanation: 'Python was created by Guido van Rossum and first released in 1991.',
        },
        {
          question: 'What is the powerhouse of the cell?',
          type: 'mcq',
          options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'],
          correctAnswer: 'Mitochondria',
          difficulty: 'medium',
          explanation: 'Mitochondria are known as the powerhouse of the cell as they produce ATP (energy).',
        },
      ],
      hard: [
        {
          question: 'What is the Heisenberg Uncertainty Principle?',
          type: 'mcq',
          options: [
            'Energy cannot be created or destroyed',
            'Position and momentum cannot both be precisely known simultaneously',
            'Every action has an equal and opposite reaction',
            'Matter and energy are interchangeable',
          ],
          correctAnswer: 'Position and momentum cannot both be precisely known simultaneously',
          difficulty: 'hard',
          explanation: 'The Heisenberg Uncertainty Principle states that the more precisely we know a particle\'s position, the less precisely we can know its momentum.',
        },
        {
          question: 'Who developed the theory of general relativity?',
          type: 'mcq',
          options: ['Isaac Newton', 'Niels Bohr', 'Albert Einstein', 'Max Planck'],
          correctAnswer: 'Albert Einstein',
          difficulty: 'hard',
          explanation: 'Albert Einstein published his theory of general relativity in 1915.',
        },
        {
          question: 'What is the Fibonacci sequence?',
          type: 'mcq',
          options: [
            'Each number is the product of the two preceding ones',
            'Each number is the sum of the two preceding ones',
            'Each number is double the preceding one',
            'Each number is half the preceding one',
          ],
          correctAnswer: 'Each number is the sum of the two preceding ones',
          difficulty: 'hard',
          explanation: 'In the Fibonacci sequence, each number is the sum of the two preceding numbers: 0, 1, 1, 2, 3, 5, 8...',
        },
        {
          question: 'In Big O notation, what is the time complexity of binary search?',
          type: 'mcq',
          options: ['O(1)', 'O(n)', 'O(log n)', 'O(n²)'],
          correctAnswer: 'O(log n)',
          difficulty: 'hard',
          explanation: 'Binary search has O(log n) time complexity because it halves the search space each iteration.',
        },
        {
          question: 'What is the Riemann Hypothesis about?',
          type: 'mcq',
          options: [
            'The distribution of prime numbers',
            'The behavior of black holes',
            'The nature of quantum particles',
            'The geometry of curved space',
          ],
          correctAnswer: 'The distribution of prime numbers',
          difficulty: 'hard',
          explanation: 'The Riemann Hypothesis conjectures about the non-trivial zeros of the Riemann zeta function and prime number distribution.',
        },
        {
          question: 'What does DNA stand for?',
          type: 'mcq',
          options: [
            'Deoxyribonucleic Acid',
            'Deoxyribonitric Acid',
            'Diribonucleic Acid',
            'Dinucleic Riboacid',
          ],
          correctAnswer: 'Deoxyribonucleic Acid',
          difficulty: 'hard',
          explanation: 'DNA stands for Deoxyribonucleic Acid, the molecule that carries genetic information.',
        },
        {
          question: 'What is the name of the theorem that states no consistent axiomatic system can prove all truths?',
          type: 'mcq',
          options: [
            'Cantor\'s Theorem',
            'Gödel\'s Incompleteness Theorem',
            'Turing\'s Halting Problem',
            'Fermat\'s Last Theorem',
          ],
          correctAnswer: 'Gödel\'s Incompleteness Theorem',
          difficulty: 'hard',
          explanation: 'Gödel\'s Incompleteness Theorems show that in any consistent formal system, there are statements that cannot be proven or disproven.',
        },
        {
          question: 'Which Nobel Prize did Marie Curie win twice?',
          type: 'mcq',
          options: [
            'Physics and Medicine',
            'Physics and Chemistry',
            'Chemistry and Medicine',
            'Physics and Peace',
          ],
          correctAnswer: 'Physics and Chemistry',
          difficulty: 'hard',
          explanation: 'Marie Curie won the Nobel Prize in Physics (1903) and Nobel Prize in Chemistry (1911).',
        },
        {
          question: 'What is the half-life of Carbon-14?',
          type: 'mcq',
          options: ['1,500 years', '5,730 years', '10,000 years', '50,000 years'],
          correctAnswer: '5,730 years',
          difficulty: 'hard',
          explanation: 'Carbon-14 has a half-life of approximately 5,730 years, making it useful for radiocarbon dating.',
        },
        {
          question: 'In cryptography, what does RSA stand for?',
          type: 'mcq',
          options: [
            'Random Symmetric Algorithm',
            'Rivest-Shamir-Adleman',
            'Recursive Security Architecture',
            'Rotating Substitution Algorithm',
          ],
          correctAnswer: 'Rivest-Shamir-Adleman',
          difficulty: 'hard',
          explanation: 'RSA stands for Rivest-Shamir-Adleman, named after its three inventors at MIT in 1977.',
        },
      ],
    };

    return allQuestions[difficulty] || allQuestions.medium;
  }

  /**
   * @private _sanitizeQuestion
   * @description Remove the correct answer from a question before sending to clients.
   */
  _sanitizeQuestion(question) {
    const { correctAnswer, explanation, ...sanitized } = question;
    return sanitized;
  }

  /**
   * @private _removeFromDiffQueue
   * @description Remove a user from a specific difficulty queue.
   * @returns {boolean} Whether the player was found and removed
   */
  _removeFromDiffQueue(userId, difficulty) {
    const queue  = queues[difficulty];
    const before = queue.length;
    const uid    = userId?.toString();

    queues[difficulty] = queue.filter(
      (p) => p.userId?.toString() !== uid
    );

    return queues[difficulty].length < before;
  }
}

module.exports = new MatchmakingService();