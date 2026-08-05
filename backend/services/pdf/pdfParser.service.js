'use strict';

const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * @service PDFParserService
 * @description Handles PDF text extraction.
 * Uses pdf-parse library for text extraction.
 * Validates PDF structure and handles corrupted files.
 *
 * @security
 * - Validates file exists before reading
 * - Handles corrupted/password-protected PDFs
 * - Limits text size to prevent memory issues
 */

class PDFParserService {
  constructor() {
    this.MAX_TEXT_LENGTH = 500000; // 500K characters max
    this.MIN_TEXT_LENGTH = 100;    // At least 100 chars
  }

  /**
   * @method extractText
   * @description Extract text content from PDF file.
   * @param {string} filePath - Absolute path to PDF file
   * @returns {object} { text, totalPages, totalWords, metadata }
   */
  async extractText(filePath) {
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new AppError(
        'PDF file not found on server.',
        404,
        'FILE_NOT_FOUND'
      );
    }

    // Verify file is readable
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch {
      throw new AppError(
        'PDF file cannot be read.',
        500,
        'FILE_READ_ERROR'
      );
    }

    let dataBuffer;
    try {
      dataBuffer = fs.readFileSync(filePath);
    } catch (error) {
      throw new AppError(
        'Failed to read PDF file.',
        500,
        'FILE_READ_ERROR'
      );
    }

    // Parse PDF
    let pdfData;
    try {
      pdfData = await pdfParse(dataBuffer, {
        max: 0, // Parse all pages
        // Custom page render to extract text
        pagerender: this._renderPage.bind(this),
      });
    } catch (error) {
      logger.error(`PDF parse error: ${error.message}`);

      // Handle specific errors
      if (
        error.message.includes('Password') ||
        error.message.includes('encrypted')
      ) {
        throw new AppError(
          'PDF is password-protected. Please upload an unprotected PDF.',
          400,
          'PDF_ENCRYPTED'
        );
      }

      if (
        error.message.includes('Invalid') ||
        error.message.includes('corrupt')
      ) {
        throw new AppError(
          'PDF file appears to be corrupted. Please upload a valid PDF.',
          400,
          'PDF_CORRUPTED'
        );
      }

      throw new AppError(
        'Failed to extract text from PDF. The file may be corrupted or unsupported.',
        400,
        'PDF_PARSE_ERROR'
      );
    }

    // Validate extracted text
    const cleanedText = this._cleanText(pdfData.text);

    if (!cleanedText || cleanedText.length < this.MIN_TEXT_LENGTH) {
      throw new AppError(
        'PDF contains insufficient readable text. It may be image-based or empty.',
        400,
        'PDF_NO_TEXT'
      );
    }

    // Truncate if too long
    const finalText = cleanedText.length > this.MAX_TEXT_LENGTH
      ? cleanedText.substring(0, this.MAX_TEXT_LENGTH)
      : cleanedText;

    const totalWords = this._countWords(finalText);

    logger.info(
      `PDF extracted: ${pdfData.numpages} pages, ${totalWords} words, ` +
      `${finalText.length} characters`
    );

    return {
      text: finalText,
      totalPages: pdfData.numpages || 0,
      totalWords,
      metadata: {
        title: pdfData.info?.Title || null,
        author: pdfData.info?.Author || null,
        subject: pdfData.info?.Subject || null,
        creator: pdfData.info?.Creator || null,
        pdfVersion: pdfData.version || null,
      },
    };
  }

  /**
   * @method validatePDFStructure
   * @description Validate PDF file structure before full parsing.
   * Quick check without full extraction.
   */
  async validatePDFStructure(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // Try parsing just first page
      await pdfParse(dataBuffer, { max: 1 });
      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        reason: error.message,
      };
    }
  }

  /**
   * @private _renderPage
   * @description Custom page renderer for better text extraction.
   */
  _renderPage(pageData) {
    const renderOptions = {
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    };

    return pageData.getTextContent(renderOptions).then((textContent) => {
      let lastY;
      let text = '';

      for (const item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }

      return text;
    });
  }

  /**
   * @private _cleanText
   * @description Clean and normalize extracted text.
   */
  _cleanText(rawText) {
    if (!rawText) return '';

    return rawText
      // Remove null bytes
      .replace(/\0/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/[ \t]+/g, ' ')
      // Remove excessive newlines (max 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Remove non-printable characters (except newline, tab)
      .replace(/[^\x20-\x7E\n\t\u00A0-\uFFFF]/g, '')
      // Trim
      .trim();
  }

  /**
   * @private _countWords
   * @description Count words in text.
   */
  _countWords(text) {
    return text
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .length;
  }
}

module.exports = new PDFParserService();