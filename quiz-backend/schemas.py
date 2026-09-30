from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    username: str
    email: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    role: Optional[str] = "admin"
    is_active: Optional[bool] = True
    isActive: Optional[bool] = True

    class Config:
        from_attributes = True


# Question Schemas
class QuestionBase(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    difficulty: Optional[str] = None


class QuestionCreate(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    id: int
    _id: Optional[str] = None
    quiz_id: int
    created_at: datetime
    question: Optional[str] = None
    correctAnswer: Optional[str] = None
    type: Optional[str] = None

    class Config:
        from_attributes = True


# Quiz Schemas
class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None


class QuizCreate(QuizBase):
    creator_id: Optional[int] = None
    questions: List[QuestionCreate]


class QuizResponse(QuizBase):
    id: int
    _id: Optional[str] = None
    creator_id: int
    created_at: datetime
    questions: List[QuestionResponse] = []
    total_questions: int = 0
    totalQuestions: int = 0
    time_limit: int = 10
    timeLimit: int = 10
    difficulty: str = "medium"
    pdf_id: Optional[int] = None
    pdfId: Optional[int] = None
    mcqCount: int = 0
    trueFalseCount: int = 0

    class Config:
        from_attributes = True


class QuizListResponse(QuizBase):
    id: int
    _id: Optional[str] = None
    creator_id: int
    created_at: datetime
    question_count: int = 0
    total_questions: int = 0
    totalQuestions: int = 0
    time_limit: int = 10
    timeLimit: int = 10
    difficulty: str = "medium"
    pdf_id: Optional[int] = None
    pdfId: Optional[int] = None

    class Config:
        from_attributes = True


# Quiz Attempt Schemas
class QuizAttemptBase(BaseModel):
    quiz_id: int
    answers: Dict[int, str]  # question_id: answer


class QuizAttemptCreate(QuizAttemptBase):
    pass


class QuizAttemptResponse(BaseModel):
    id: int
    user_id: int
    quiz_id: int
    score: int
    total_questions: int
    answers: Dict[int, str]
    completed_at: datetime

    class Config:
        from_attributes = True


# Auth Schemas
class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# PDF Schemas
class PDFBase(BaseModel):
    name: str
    original_name: str
    file_size: int
    status: str = "processing"
    chunk_count: int = 0


class PDFResponse(PDFBase):
    id: int
    created_at: datetime
    file_path: str
    user_id: Optional[int] = None
    userId: Optional[int] = None

    class Config:
        from_attributes = True
