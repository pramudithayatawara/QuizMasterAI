from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    """User model for authentication and profile management"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar = Column(String(500), nullable=True)
    settings = Column(Text, nullable=True)
    role = Column(String(50), default="student", nullable=True)
    is_active = Column(Boolean, default=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    quizzes = relationship("Quiz", back_populates="creator", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    battles_created = relationship("Battle", back_populates="creator", foreign_keys="Battle.creator_id", cascade="all, delete-orphan")
    battles_won = relationship("Battle", back_populates="winner", foreign_keys="Battle.winner_id")
    battle_participations = relationship("BattleParticipant", back_populates="user", cascade="all, delete-orphan")
    leaderboard = relationship("Leaderboard", back_populates="user", uselist=False, cascade="all, delete-orphan")
    uploaded_pdfs = relationship("PDF", back_populates="user", cascade="all, delete-orphan")


class Quiz(Base):
    """Quiz model for storing quiz metadata with PDF linking and timestamps"""
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=True)  # Link to source PDF
    total_questions = Column(Integer, nullable=False, default=0)  # Total number of questions
    quiz_metadata = Column(JSON, nullable=True)  # Quiz metadata (generation config, etc.)
    tags = Column(JSON, nullable=True)  # Quiz tags for categorization
    is_active = Column(Boolean, nullable=False, default=True)  # Quiz active status
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    creator = relationship("User", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    source_pdf = relationship("PDF", back_populates="quizzes")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


class Question(Base):
    """Question model for storing quiz questions with difficulty categorization"""
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False, default="mcq")  # mcq, true_false, mixed
    options = Column(JSON, nullable=False)  # Store options as JSON array
    correct_answer = Column(String(500), nullable=False)
    difficulty = Column(String(20), nullable=False, default="medium")  # easy, medium, hard
    difficulty_score = Column(Float, nullable=True)  # Numeric difficulty score (0-1)
    explanation = Column(Text, nullable=True)  # Explanation for the correct answer
    source_chunk_index = Column(Integer, nullable=False, default=0)  # Source chunk index
    confidence_score = Column(Float, nullable=True)  # AI generation confidence (0-1)
    question_metadata = Column(JSON, nullable=True)  # Additional question metadata
    tags = Column(JSON, nullable=True)  # Question tags for categorization
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    quiz = relationship("Quiz", back_populates="questions")


class QuizAttempt(Base):
    """QuizAttempt model for tracking user quiz attempts and scores"""
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    score = Column(Integer, nullable=False)
    total_questions = Column(Integer, nullable=False)
    answers = Column(JSON, nullable=True)  # Store user answers as JSON
    time_spent = Column(Integer, nullable=True)  # Time spent in seconds
    completed_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")


class PDF(Base):
    """PDF model for storing uploaded PDF files with quiz linking"""
    __tablename__ = "pdfs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False, default="processing")  # processing, completed, failed
    chunk_count = Column(Integer, nullable=False, default=0)
    pdf_metadata = Column(JSON, nullable=True)  # PDF metadata (extraction results, etc.)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Link to uploading user
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="uploaded_pdfs")
    quizzes = relationship("Quiz", back_populates="source_pdf")


class Battle(Base):
    """
    Battle Mode: A unique entity facilitating the competitive aspect of the system
    where multiple users can 'Join' a session. Identified by Battle_ID and tracks Winner_ID.
    """
    __tablename__ = "battles"

    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(String(50), unique=True, index=True, nullable=False)  # Battle_ID
    title = Column(String(200), nullable=False, default="Quiz Battle Arena")
    subject = Column(String(100), nullable=False, default="General")
    difficulty = Column(String(50), nullable=False, default="medium")
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Winner_ID
    status = Column(String(50), nullable=False, default="waiting")  # waiting, active, completed, cancelled
    max_players = Column(Integer, nullable=False, default=4)
    time_per_question = Column(Integer, nullable=False, default=15)  # seconds
    total_rounds = Column(Integer, nullable=False, default=10)  # Minimum 10 questions
    questions_data = Column(JSON, nullable=True)  # Store generated battle questions
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id], back_populates="battles_created")
    winner = relationship("User", foreign_keys=[winner_id], back_populates="battles_won")
    participants = relationship("BattleParticipant", back_populates="battle", cascade="all, delete-orphan")
    quiz = relationship("Quiz")


class BattleParticipant(Base):
    """
    BattleParticipant model facilitating multiple users joining a Battle session.
    """
    __tablename__ = "battle_participants"

    id = Column(Integer, primary_key=True, index=True)
    battle_id = Column(Integer, ForeignKey("battles.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Integer, nullable=False, default=0)
    answers = Column(JSON, nullable=True)  # User's submitted answers
    is_ready = Column(Boolean, nullable=False, default=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    battle = relationship("Battle", back_populates="participants")
    user = relationship("User", back_populates="battle_participations")


class Leaderboard(Base):
    """
    Leaderboard: A consolidated entity that is 'Updated' by the Results entity
    to rank users and display achievements like badges.
    """
    __tablename__ = "leaderboards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    total_points = Column(Integer, nullable=False, default=0)  # Total XP / Points
    quizzes_completed = Column(Integer, nullable=False, default=0)
    battles_played = Column(Integer, nullable=False, default=0)
    battles_won = Column(Integer, nullable=False, default=0)
    win_streak = Column(Integer, nullable=False, default=0)
    rank = Column(Integer, nullable=False, default=1)
    level = Column(Integer, nullable=False, default=1)
    badges = Column(JSON, nullable=False, default=list)  # Earned achievements & badges
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="leaderboard")
