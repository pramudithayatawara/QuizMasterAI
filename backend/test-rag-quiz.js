/**
 * Test Script for RAG Quiz Generation Pipeline
 * Run with: node test-rag-quiz.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const quizService = require('./services/quiz/quiz.service');
const AppError = require('./utils/AppError');

// Test configuration
const TEST_CONFIG = {
  pdfId: process.env.TEST_PDF_ID || null,
  userId: process.env.TEST_USER_ID || null,
  difficulty: 'medium',
  questionCount: 10
};

async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function testRAGQuizGeneration() {
  try {
    console.log('🧪 Starting RAG Quiz Generation Test...\n');

    // Validate test configuration
    if (!TEST_CONFIG.pdfId || !TEST_CONFIG.userId) {
      throw new Error('TEST_PDF_ID and TEST_USER_ID must be set in environment variables');
    }

    console.log('📋 Test Configuration:');
    console.log(`  PDF ID: ${TEST_CONFIG.pdfId}`);
    console.log(`  User ID: ${TEST_CONFIG.userId}`);
    console.log(`  Difficulty: ${TEST_CONFIG.difficulty}`);
    console.log(`  Question Count: ${TEST_CONFIG.questionCount}\n`);

    // Generate quiz
    console.log('🚀 Generating quiz...');
    const startTime = Date.now();
    
    const quiz = await quizService.generateQuizFromPdf(
      TEST_CONFIG.pdfId,
      TEST_CONFIG.userId,
      {
        difficulty: TEST_CONFIG.difficulty,
        questionCount: TEST_CONFIG.questionCount
      }
    );

    const duration = Date.now() - startTime;

    // Display results
    console.log('\n✅ Quiz Generated Successfully!\n');
    console.log('📊 Quiz Details:');
    console.log(`  ID: ${quiz._id}`);
    console.log(`  Title: ${quiz.title}`);
    console.log(`  Difficulty: ${quiz.difficulty}`);
    console.log(`  Total Questions: ${quiz.totalQuestions}`);
    console.log(`  MCQ Count: ${quiz.mcqCount}`);
    console.log(`  True/False Count: ${quiz.trueFalseCount}`);
    console.log(`  Time Limit: ${quiz.timeLimit} minutes`);
    console.log(`  Status: ${quiz.status}`);
    console.log(`  Generation Model: ${quiz.generationModel}`);
    console.log(`  Retrieved Chunks: ${quiz.retrievedChunks.length}`);
    console.log(`  Generation Time: ${duration}ms\n`);

    // Display sample questions
    console.log('📝 Sample Questions (first 3):');
    quiz.questions.slice(0, 3).forEach((q, index) => {
      console.log(`\n  Question ${index + 1}:`);
      console.log(`    Type: ${q.type}`);
      console.log(`    Text: ${q.questionText.substring(0, 100)}...`);
      console.log(`    Topic: ${q.topic}`);
      console.log(`    Source Chunk: ${q.sourceChunkIndex}`);
      console.log(`    Bloom's Level: ${q.bloomsLevel}`);
    });

    // Validate requirements
    console.log('\n✅ Requirements Validation:');
    console.log(`  Minimum 10 questions: ${quiz.totalQuestions >= 10 ? '✅' : '❌'}`);
    console.log(`  60% MCQ ratio: ${quiz.mcqCount / quiz.totalQuestions >= 0.5 ? '✅' : '❌'}`);
    console.log(`  40% True/False ratio: ${quiz.trueFalseCount / quiz.totalQuestions >= 0.3 ? '✅' : '❌'}`);
    console.log(`  Context references: ${quiz.contextReferences.length > 0 ? '✅' : '❌'}`);
    console.log(`  Source chunk tracking: ${quiz.questions.every(q => q.sourceChunkIndex !== null) ? '✅' : '❌'}`);

    console.log('\n🎉 Test Completed Successfully!');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error instanceof AppError) {
      console.error(`  Error Code: ${error.code}`);
      console.error(`  Status: ${error.statusCode}`);
    }
    process.exit(1);
  }
}

async function main() {
  try {
    await connectDatabase();
    await testRAGQuizGeneration();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run test
main();