"""
Quiz Storage and Difficulty Categorization Integration Module for QuizMaster AI Backend

This module provides FastAPI integration for quiz storage with PDF/user linking (Priority 30)
and difficulty categorization (Priority 31), implementing comprehensive quiz management with
secure database operations.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import traceback
from datetime import datetime

from difficulty_categorizer import (
    DifficultyCategorizer,
    DifficultyCategorizationRequest,
    DifficultyCategorizationResponse,
    BatchDifficultyCategorizationRequest,
    BatchDifficultyCategorizationResponse,
    DifficultyCategory,
    CognitiveLevel,
    get_difficulty_categorizer
)

# Local imports to avoid circular dependencies
def get_models():
    """Import models locally to avoid circular imports"""
    try:
        from models import User, Quiz, Question, QuizAttempt, PDF
        return User, Quiz, Question, QuizAttempt, PDF
    except ImportError:
        return None, None, None, None, None

def get_db_dependency():
    """Import get_db locally to avoid circular imports"""
    try:
        from database import get_db
        return get_db
    except ImportError:
        return None