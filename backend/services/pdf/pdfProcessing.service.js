'use strict';

const pdfParse = require('pdf-parse');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const AppError = require('../../utils/AppError');

/**
 * @service PdfProcessingService
 * @description Handles PDF text extraction and chunking.
 */
class PdfProcessingService {
  /**
   * Extract text from PDF buffer
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @returns {Promise<string>} Extracted text
   */
  static async extractText(pdfBuffer) {
    try {
      const data = await pdfParse(pdfBuffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new AppError('PDF file is empty or contains no extractable text', 400);
      }
      
      // Clean up the extracted text
      let cleanedText = data.text;
      // Remove excessive whitespace
      cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
      
      return cleanedText;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('PDF Parse Error:', error);
      throw new AppError('Corrupted or invalid PDF file', 400);
    }
  }

  /**
   * Split text into chunks using LangChain's RecursiveCharacterTextSplitter
   * @param {string} text - Text to chunk
   * @param {Object} options - Chunking options
   * @returns {Promise<Array<string>>} Array of text chunks
   */
  static async chunkText(text, options = {}) {
    const {
      chunkSize = 1000,
      chunkOverlap = 200,
      separators = ['\n\n', '\n', '. ', ' ', ''],
    } = options;

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators,
    });

    const chunks = await splitter.splitText(text);
    
    // Filter out empty chunks
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Process PDF: extract text and chunk it
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {Object} chunkingOptions - Chunking options
   * @returns {Promise<Object>} Processing result with chunks
   */
  static async processPdf(pdfBuffer, chunkingOptions = {}) {
    try {
      // Extract text
      const text = await this.extractText(pdfBuffer);
      
      // Chunk text
      const chunks = await this.chunkText(text, chunkingOptions);
      
      if (chunks.length === 0) {
        throw new AppError('Failed to create text chunks from PDF', 400);
      }
      
      return {
        text,
        chunks,
        chunkCount: chunks.length,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('PDF processing failed', 500);
    }
  }
}

module.exports = PdfProcessingService;
