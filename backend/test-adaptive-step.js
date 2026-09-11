/**
 * Automated Verification Script for Real-Time Question-by-Question Adaptive CAT Engine
 * Run with: node test-adaptive-step.js
 */

'use strict';

const path = require('path');
const AdaptiveService = require('./services/adaptive/adaptive.service');
const { DIFFICULTY } = require('./constants/difficulty');

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 Starting Real-Time Adaptive CAT Engine Unit & Flow Tests');
console.log('═══════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// ─── Mock Question Pool ───────────────────────────────────────────────────
const mockQuestions = [
  { _id: 'q_easy_1', questionText: 'Easy Q1', difficulty: DIFFICULTY.EASY, bloomsTaxonomy: 'Remember', correctAnswer: 'A' },
  { _id: 'q_easy_2', questionText: 'Easy Q2', difficulty: DIFFICULTY.EASY, bloomsTaxonomy: 'Remember', correctAnswer: 'B' },
  { _id: 'q_med_1', questionText: 'Medium Q1', difficulty: DIFFICULTY.MEDIUM, bloomsTaxonomy: 'Understand', correctAnswer: 'C' },
  { _id: 'q_med_2', questionText: 'Medium Q2', difficulty: DIFFICULTY.MEDIUM, bloomsTaxonomy: 'Apply', correctAnswer: 'A' },
  { _id: 'q_hard_1', questionText: 'Hard Q1', difficulty: DIFFICULTY.HARD, bloomsTaxonomy: 'Analyze', correctAnswer: 'D' },
  { _id: 'q_hard_2', questionText: 'Hard Q2', difficulty: DIFFICULTY.HARD, bloomsTaxonomy: 'Evaluate', correctAnswer: 'B' },
];

// ─── Test 1: Initial Question Selection ────────────────────────────────────
console.log('📌 Test Suite 1: Initial Calibration Question Selection');
const initialQ = AdaptiveService.selectInitialAdaptiveQuestion(mockQuestions);
assert(initialQ !== null, 'Initial question is selected');
assert(initialQ.difficulty === DIFFICULTY.MEDIUM, 'Initial question defaults to Medium calibration tier');
console.log('');

// ─── Test 2: Correct Answer Theta Progression ─────────────────────────────
console.log('📌 Test Suite 2: IRT Calibration & Difficulty Upgrade on Correct Answers');

const initialAttempt = {
  currentAbilityTheta: 0.0,
  currentDifficultyLevel: DIFFICULTY.MEDIUM,
  consecutiveCorrect: 0,
  consecutiveIncorrect: 0,
  servedQuestionIds: [initialQ._id],
};

// Step 1: User answers Medium question correctly and quickly (12s)
const step1 = AdaptiveService.calibrateNextStep(
  initialAttempt,
  initialQ,
  true,  // isCorrect
  12,    // timeTaken
  mockQuestions
);

assert(step1.newTheta > 0.0, `Theta increases after correct answer (new theta: ${step1.newTheta})`);
assert(step1.consecutiveCorrect === 1, 'Consecutive correct counter increments to 1');
assert(step1.nextQuestion !== null, 'Next question is successfully selected from pool');

// Step 2: User answers another question correctly -> triggers progression to Hard
const attemptAfterStep1 = {
  ...initialAttempt,
  currentAbilityTheta: step1.newTheta,
  currentDifficultyLevel: step1.calibratedLevel,
  consecutiveCorrect: step1.consecutiveCorrect,
  consecutiveIncorrect: step1.consecutiveIncorrect,
  servedQuestionIds: [initialQ._id, step1.nextQuestion._id],
};

const step2 = AdaptiveService.calibrateNextStep(
  attemptAfterStep1,
  step1.nextQuestion,
  true,  // isCorrect
  15,    // timeTaken
  mockQuestions
);

assert(step2.newTheta > step1.newTheta, `Theta further increases (new theta: ${step2.newTheta})`);
assert(step2.consecutiveCorrect === 2, 'Consecutive correct counter reaches 2');
assert(step2.calibratedLevel === DIFFICULTY.HARD, `Difficulty upgraded to HARD (level: ${step2.calibratedLevel})`);
assert(step2.adjustment === 'increased', 'Adjustment status is "increased"');
assert(step2.nextQuestion.difficulty === DIFFICULTY.HARD, 'Next selected question is from Hard tier');
console.log('');

// ─── Test 3: Incorrect Answer Remediation & Downgrade ──────────────────────
console.log('📌 Test Suite 3: Difficulty Downgrade / Remediation on Incorrect Answers');

const hardAttempt = {
  currentAbilityTheta: 1.2,
  currentDifficultyLevel: DIFFICULTY.HARD,
  consecutiveCorrect: 2,
  consecutiveIncorrect: 0,
  servedQuestionIds: ['q_hard_1'],
};

// User fails hard question
const stepFail1 = AdaptiveService.calibrateNextStep(
  hardAttempt,
  { _id: 'q_hard_1', difficulty: DIFFICULTY.HARD },
  false, // isCorrect
  35,    // timeTaken
  mockQuestions
);

assert(stepFail1.newTheta < 1.2, `Theta decreases after incorrect answer (new theta: ${stepFail1.newTheta})`);
assert(stepFail1.consecutiveCorrect === 0, 'Consecutive correct streak resets to 0');
assert(stepFail1.consecutiveIncorrect === 1, 'Consecutive incorrect counter increments to 1');

// User fails again -> triggers regression
const attemptAfterFail1 = {
  ...hardAttempt,
  currentAbilityTheta: stepFail1.newTheta,
  currentDifficultyLevel: stepFail1.calibratedLevel,
  consecutiveCorrect: stepFail1.consecutiveCorrect,
  consecutiveIncorrect: stepFail1.consecutiveIncorrect,
  servedQuestionIds: ['q_hard_1', 'q_hard_2'],
};

const stepFail2 = AdaptiveService.calibrateNextStep(
  attemptAfterFail1,
  { _id: 'q_hard_2', difficulty: DIFFICULTY.HARD },
  false, // isCorrect
  45,    // timeTaken
  mockQuestions
);

assert(stepFail2.consecutiveIncorrect === 2, 'Consecutive incorrect counter reaches 2');
assert(stepFail2.calibratedLevel === DIFFICULTY.MEDIUM, `Difficulty downgraded from Hard to Medium (level: ${stepFail2.calibratedLevel})`);
assert(stepFail2.adjustment === 'decreased', 'Adjustment status is "decreased"');
console.log('');

// ─── Test 4: Speed Bonus Sensitivity ───────────────────────────────────────
console.log('📌 Test Suite 4: Response Velocity (Speed Bonus)');

const fastResult = AdaptiveService.calibrateNextStep(
  { currentAbilityTheta: 0.0, currentDifficultyLevel: DIFFICULTY.MEDIUM },
  { _id: 'q_med_1', difficulty: DIFFICULTY.MEDIUM },
  true,
  8, // 8 seconds (fast)
  mockQuestions
);

const slowResult = AdaptiveService.calibrateNextStep(
  { currentAbilityTheta: 0.0, currentDifficultyLevel: DIFFICULTY.MEDIUM },
  { _id: 'q_med_1', difficulty: DIFFICULTY.MEDIUM },
  true,
  45, // 45 seconds (slow)
  mockQuestions
);

assert(fastResult.newTheta > slowResult.newTheta, `Fast answer awards higher theta (${fastResult.newTheta}) than slow answer (${slowResult.newTheta})`);
console.log('');

// ─── Summary ───────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log(`🏁 Test Summary: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('═══════════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL UNIT & CALIBRATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('⚠️ Some tests failed. Check logs above.');
  process.exit(1);
}
