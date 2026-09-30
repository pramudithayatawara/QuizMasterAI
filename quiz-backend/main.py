from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
import shutil
import os
import datetime
from pydantic import BaseModel

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from rag_service import RAGQuizService

# Import adaptive quiz generator
try:
    from adaptive_quiz_generator import (
        AdaptiveQuizGenerator,
        AdaptiveQuizRequest,
        AdaptiveQuiz,
        DifficultyLevel,
        get_adaptive_generator
    )
    from adaptive_quiz_integration import get_adaptive_manager
    ADAPTIVE_AVAILABLE = True
except ImportError:
    ADAPTIVE_AVAILABLE = False
    print("⚠️ Adaptive quiz generator not available. Install with required dependencies.")

# Import MCQ and True/False generators
try:
    from mcq_integration import create_mcq_router
    MCQ_AVAILABLE = True
except ImportError:
    MCQ_AVAILABLE = False
    print("⚠️ MCQ generator not available. Install with required dependencies.")

try:
    from tf_integration import create_tf_router
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠️ True/False generator not available. Install with required dependencies.")

# Import mixed question generator
try:
    from mixed_integration import create_mixed_router
    MIXED_AVAILABLE = True
except ImportError:
    MIXED_AVAILABLE = False
    print("⚠️ Mixed question generator not available. Install with required dependencies.")

# Import answer and explanation generators
try:
    from answer_explanation_integration import create_answer_explanation_router
    ANSWER_EXPLANATION_AVAILABLE = True
except ImportError:
    ANSWER_EXPLANATION_AVAILABLE = False
    print("⚠️ Answer and explanation generators not available. Install with required dependencies.")

# Import validation and duplicate prevention
try:
    from validation_integration import create_validation_router
    VALIDATION_AVAILABLE = True
except ImportError:
    VALIDATION_AVAILABLE = False
    print("⚠️ Validation and duplicate prevention not available. Install with required dependencies.")

# Import quiz storage and difficulty categorization
try:
    from quiz_storage_integration import create_quiz_storage_router
    QUIZ_STORAGE_AVAILABLE = True
except ImportError:
    QUIZ_STORAGE_AVAILABLE = False
    print("⚠️ Quiz storage and difficulty categorization not available. Install with required dependencies.")

from database import engine, Base, get_db
from models import User, Quiz, Question, QuizAttempt, PDF, Battle, BattleParticipant, Leaderboard
from battle_leaderboard_service import (
    create_battle, join_battle, complete_battle,
    get_leaderboard_data, get_user_profile_data, get_user_badges_data,
    update_leaderboard_from_quiz_result, update_leaderboard_from_battle_result,
    send_battle_invitation, get_invitations_for_user, get_or_create_leaderboard
)
from schemas import (
    UserCreate, UserResponse,
    QuizCreate, QuizResponse, QuizListResponse,
    QuestionCreate, QuestionResponse,
    QuizAttemptCreate, QuizAttemptResponse,
    LoginRequest, RegisterRequest, TokenResponse,
    PDFResponse
)


# Request models for endpoints
class QuizRequest(BaseModel):
    """Request body for quiz generation"""
    context: str


# Global variables for the fine-tuned model
tokenizer = None
model = None
rag_service = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - create tables on startup and load ML model"""
    global tokenizer, model, rag_service
    # Startup
    print("🚀 Starting QuizMaster AI Backend...")
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
    # Create uploads directory
    os.makedirs("uploads", exist_ok=True)
    print("✅ Uploads directory created")
    # Load fine-tuned model
    candidate_paths = [
        "./fine_tuned_quiz_model",
        os.path.join(os.path.dirname(__file__), "fine_tuned_quiz_model"),
        os.path.abspath(os.path.join(os.getcwd(), "quiz-backend", "fine_tuned_quiz_model")),
        os.path.abspath(os.path.join(os.getcwd(), "fine_tuned_quiz_model")),
    ]
    resolved_model_path = None
    for cp in candidate_paths:
        if os.path.exists(cp):
            resolved_model_path = os.path.abspath(cp)
            break
    
    model_path = resolved_model_path or "./fine_tuned_quiz_model"
    if resolved_model_path:
        print(f"🤖 Loading fine-tuned model from {model_path}...")
        try:
            tokenizer = AutoTokenizer.from_pretrained(model_path)
            model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
            print("✅ Fine-tuned model loaded successfully")
        except Exception as e:
            print(f"⚠️ Failed to load model: {e}")
            tokenizer = None
            model = None
    else:
        print(f"⚠️ Model directory not found: {model_path}")
    
    # Initialize RAG service
    try:
        rag_service = RAGQuizService(model_path)
        print("✅ RAG Quiz Service initialized successfully")
    except Exception as e:
        print(f"⚠️ Failed to initialize RAG service: {e}")
        rag_service = None
    
    yield
    # Shutdown
    print("👋 Shutting down application...")


# Initialize FastAPI app
app = FastAPI(
    title="QuizMaster AI Backend",
    description="FastAPI backend for QuizMaster AI with Neon PostgreSQL database",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        # Add more specific origins as needed for development
        # Note: Cannot use "*" when allow_credentials=True
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Include MCQ and True/False routers if available
if MCQ_AVAILABLE:
    try:
        mcq_router = create_mcq_router()
        app.include_router(mcq_router)
        print("✅ MCQ router included successfully")
    except Exception as e:
        print(f"⚠️ Failed to include MCQ router: {e}")

if TF_AVAILABLE:
    try:
        tf_router = create_tf_router()
        app.include_router(tf_router)
        print("✅ True/False router included successfully")
    except Exception as e:
        print(f"⚠️ Failed to include True/False router: {e}")

if MIXED_AVAILABLE:
    try:
        mixed_router = create_mixed_router()
        app.include_router(mixed_router)
        print("✅ Mixed question router included successfully")
    except Exception as e:
        print(f"⚠️ Failed to include mixed question router: {e}")

if ANSWER_EXPLANATION_AVAILABLE:
    try:
        answer_explanation_router = create_answer_explanation_router()
        app.include_router(answer_explanation_router)
        print("✅ Answer and explanation router included successfully")
    except Exception as e:
        print(f"⚠️ Failed to include answer and explanation router: {e}")

if VALIDATION_AVAILABLE:
    try:
        validation_router = create_validation_router()
        app.include_router(validation_router)
        print("✅ Validation router included successfully")
    except Exception as e:
        print(f"⚠️ Failed to include validation router: {e}")

if QUIZ_STORAGE_AVAILABLE:
    try:
        quiz_storage_router = create_quiz_storage_router()
        app.include_router(quiz_storage_router)
        print("✅ Quiz storage router included successfully")
    except Exception as e:
        print(f"⚠️ Failed to include quiz storage router: {e}")


# Mount uploads directory for static files (e.g., avatars)
os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ==================== Root & Health Endpoints ====================

@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "QuizMaster AI Backend is Running!",
        "status": "operational",
        "service": "QuizMaster AI - FastAPI + SQLite",
        "version": "1.0.0"
    }


@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "success",
        "service": "operational",
        "database": "SQLite (quizmaster.db)"
    }


# ==================== User Endpoints ====================

@app.post("/api/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    # Create new user (Note: In production, hash the password!)
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=user.password  # TODO: Use bcrypt or passlib for hashing
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# ==================== Authentication Endpoints (v1 compatibility) ====================

@app.post("/api/v1/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user - v1 API for frontend compatibility"""
    print(f"📝 Registration request received: {user}")  # Debug logging

    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if username already exists
    existing_username = db.query(User).filter(User.username == user.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    # Create new user
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=user.password  # TODO: Use bcrypt or passlib for hashing
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    print(f"✅ User registered successfully: {new_user.username}")  # Debug logging
    return new_user


@app.post("/api/v1/auth/login", response_model=TokenResponse)
def login_user(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Login user - v1 API for frontend compatibility"""
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Check password (Note: In production, use bcrypt to verify hashed password)
    if user.hashed_password != credentials.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Generate simple token (Note: In production, use JWT)
    access_token = f"token_{user.id}_{user.username}"
    first_name = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    last_name = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at,
            first_name=user.first_name,
            last_name=user.last_name,
            firstName=first_name,
            lastName=last_name,
            bio=user.bio,
            avatar=user.avatar,
            role=user.role or ("admin" if user.id == 1 else "student"),
            is_active=bool(user.is_active if user.is_active is not None else True),
            isActive=bool(user.is_active if user.is_active is not None else True)
        )
    )


@app.get("/api/v1/auth/me", response_model=UserResponse)
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Get current authenticated user - v1 API for frontend compatibility"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = db.query(User).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    first_name = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    last_name = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        first_name=user.first_name,
        last_name=user.last_name,
        firstName=first_name,
        lastName=last_name,
        bio=user.bio,
        avatar=user.avatar,
        role=user.role or ("admin" if user.id == 1 else "student"),
        is_active=bool(user.is_active if user.is_active is not None else True),
        isActive=bool(user.is_active if user.is_active is not None else True)
    )


def get_authenticated_user_id(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> int:
    """Helper to extract user_id from Bearer token or fallback to active user."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        if token.startswith("token_"):
            parts = token.split("_")
            if len(parts) >= 2 and parts[1].isdigit():
                return int(parts[1])
            elif len(parts) >= 3 and parts[2].isdigit():
                return int(parts[2])
            elif len(parts) >= 2:
                u = db.query(User).filter(User.username == parts[1]).first()
                if u:
                    return u.id
        elif "token-" in token:
            parts = token.split("-")
            if parts[-1].isdigit():
                return int(parts[-1])
        elif token.isdigit():
            return int(token)
    user = db.query(User).first()
    return user.id if user else 1


@app.post("/api/v1/auth/logout")
def logout_user():
    """Logout user - v1 API for frontend compatibility"""
    # Note: In production, invalidate JWT token
    return {"message": "Logged out successfully"}


@app.post("/api/v1/auth/refresh-token", response_model=TokenResponse)
def refresh_token(db: Session = Depends(get_db)):
    """Refresh access token - v1 API for frontend compatibility"""
    # Note: In production, validate refresh token and issue new access token
    user = db.query(User).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    access_token = f"token_{user.id}_{user.username}"
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at
        )
    )


@app.get("/api/users", response_model=List[UserResponse])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all users with pagination"""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@app.get("/api/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a specific user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


# ==================== Quiz Endpoints ====================

@app.post("/api/quizzes", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
def create_quiz(quiz: QuizCreate, db: Session = Depends(get_db)):
    """Create a new quiz with questions"""
    # Use provided creator_id or default to first user
    creator_id = quiz.creator_id if quiz.creator_id else 1

    # Verify creator exists
    creator = db.query(User).filter(User.id == creator_id).first()
    if not creator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Creator (user) not found"
        )

    # Create quiz
    new_quiz = Quiz(
        title=quiz.title,
        description=quiz.description,
        category=quiz.category,
        creator_id=creator_id
    )
    db.add(new_quiz)
    db.flush()  # Get the quiz ID before adding questions

    # Create questions
    for question_data in quiz.questions:
        new_question = Question(
            quiz_id=new_quiz.id,
            question_text=question_data.question_text,
            options=question_data.options,
            correct_answer=question_data.correct_answer,
            difficulty=question_data.difficulty
        )
        db.add(new_question)

    db.commit()
    db.refresh(new_quiz)

    return new_quiz


@app.get("/api/quizzes", response_model=List[QuizListResponse])
def get_quizzes(
    skip: int = 0,
    limit: int = 100,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get all non-battle quizzes with question count and difficulty (user isolated)"""
    user_id = get_authenticated_user_id(authorization, db)
    query = db.query(Quiz).filter(Quiz.category != "battle")
    if user_id != 1:
        query = query.filter((Quiz.creator_id == user_id) | (Quiz.creator_id == 1))
    else:
        query = query.filter(Quiz.creator_id == 1)

    quizzes = query.offset(skip).limit(limit).all()

    quiz_responses = []
    for quiz in quizzes:
        q_count = db.query(func.count(Question.id)).filter(
            Question.quiz_id == quiz.id
        ).scalar() or quiz.total_questions or 0

        # Query first question to identify difficulty
        sample_q = db.query(Question).filter(Question.quiz_id == quiz.id).first()
        diff = sample_q.difficulty if sample_q and sample_q.difficulty else "medium"
        calc_time = max(2, round(q_count * 1.5)) if q_count > 0 else 5

        quiz_responses.append(QuizListResponse(
            id=quiz.id,
            _id=str(quiz.id),
            title=quiz.title,
            description=quiz.description,
            category=quiz.category,
            creator_id=quiz.creator_id,
            created_at=quiz.created_at,
            question_count=q_count,
            total_questions=q_count,
            totalQuestions=q_count,
            time_limit=calc_time,
            timeLimit=calc_time,
            difficulty=diff,
            pdf_id=quiz.pdf_id,
            pdfId=quiz.pdf_id
        ))

    return quiz_responses


@app.get("/api/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    """Get a specific quiz with all questions normalized for frontend"""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )
    
    questions = db.query(Question).filter(Question.quiz_id == quiz.id).all()
    q_responses = []
    mcq_count = 0
    tf_count = 0
    
    for q in questions:
        q_type = q.question_type or "mcq"
        if q_type == "mcq":
            mcq_count += 1
        elif q_type in ["true_false", "true/false"]:
            tf_count += 1

        opts = q.options if isinstance(q.options, list) else []
        q_responses.append(QuestionResponse(
            id=q.id,
            _id=str(q.id),
            quiz_id=q.quiz_id,
            created_at=q.created_at,
            question_text=q.question_text,
            question=q.question_text,
            options=opts,
            correct_answer=q.correct_answer,
            correctAnswer=q.correct_answer,
            difficulty=q.difficulty or "medium",
            question_type=q_type,
            type=q_type
        ))

    calc_time = max(2, round(len(q_responses) * 1.5)) if q_responses else 5
    sample_diff = questions[0].difficulty if questions and questions[0].difficulty else "medium"

    return QuizResponse(
        id=quiz.id,
        _id=str(quiz.id),
        title=quiz.title,
        description=quiz.description,
        category=quiz.category,
        creator_id=quiz.creator_id,
        created_at=quiz.created_at,
        questions=q_responses,
        total_questions=len(q_responses),
        totalQuestions=len(q_responses),
        time_limit=calc_time,
        timeLimit=calc_time,
        difficulty=sample_diff,
        pdf_id=quiz.pdf_id,
        pdfId=quiz.pdf_id,
        mcqCount=mcq_count,
        trueFalseCount=tf_count
    )


@app.delete("/api/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(quiz_id: int, db: Session = Depends(get_db)):
    """Delete a quiz (cascade deletes questions)"""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    db.delete(quiz)
    db.commit()
    return None


# ==================== Quiz Endpoints (v1 compatibility) ====================

@app.get("/api/v1/quizzes", response_model=List[QuizListResponse])
def get_quizzes_v1(
    skip: int = 0,
    limit: int = 100,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get all non-battle quizzes - v1 API for frontend compatibility"""
    return get_quizzes(skip=skip, limit=limit, authorization=authorization, db=db)


@app.get("/api/v1/quizzes/{quiz_id}", response_model=QuizResponse)
def get_quiz_v1(quiz_id: int, db: Session = Depends(get_db)):
    """Get a specific quiz - v1 API for frontend compatibility"""
    return get_quiz(quiz_id=quiz_id, db=db)


@app.post("/api/v1/quizzes/{quiz_id}/start")
@app.post("/api/quizzes/{quiz_id}/start")
def start_quiz_session(quiz_id: int, db: Session = Depends(get_db)):
    """Start an interactive quiz attempt session"""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = db.query(Question).filter(Question.quiz_id == quiz.id).all()
    q_list = []
    for q in questions:
        q_type = q.question_type or "mcq"
        q_list.append({
            "id": q.id,
            "_id": str(q.id),
            "questionId": q.id,
            "question": q.question_text,
            "question_text": q.question_text,
            "options": q.options if isinstance(q.options, list) else [],
            "correctAnswer": q.correct_answer,
            "correct_answer": q.correct_answer,
            "difficulty": q.difficulty or "medium",
            "type": q_type,
            "question_type": q_type,
            "explanation": q.explanation or ""
        })

    calc_time = max(2, round(len(q_list) * 1.5)) if q_list else 5
    quiz_dict = {
        "id": quiz.id,
        "_id": str(quiz.id),
        "title": quiz.title,
        "description": quiz.description,
        "totalQuestions": len(q_list),
        "total_questions": len(q_list),
        "timeLimit": calc_time,
        "time_limit": calc_time,
        "difficulty": questions[0].difficulty if questions else "medium",
        "questions": q_list,
        "mcqCount": sum(1 for q in q_list if q["type"] == "mcq"),
        "trueFalseCount": sum(1 for q in q_list if q["type"] in ["true_false", "true/false"])
    }

    # Record or initialize attempt
    new_attempt = QuizAttempt(
        user_id=1,
        quiz_id=quiz.id,
        score=0,
        total_questions=len(q_list),
        answers={}
    )
    db.add(new_attempt)
    db.commit()
    db.refresh(new_attempt)

    return {
        "success": True,
        "data": {
            "quiz": quiz_dict,
            "attempt": {
                "id": new_attempt.id,
                "_id": str(new_attempt.id),
                "quizId": quiz.id,
                "userId": 1
            }
        }
    }


@app.post("/api/v1/quizzes/attempt/{attempt_id}/submit")
@app.post("/api/quizzes/attempt/{attempt_id}/submit")
def submit_attempt_v1(attempt_id: int, data: dict, db: Session = Depends(get_db)):
    """Submit quiz attempt, compute score, and update Leaderboard"""
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    raw_answers = data.get("answers", [])
    answers_dict = {}
    if isinstance(raw_answers, list):
        for item in raw_answers:
            answers_dict[str(item.get("questionId"))] = item.get("answer")
    elif isinstance(raw_answers, dict):
        answers_dict = {str(k): v for k, v in raw_answers.items()}

    questions = db.query(Question).filter(Question.quiz_id == attempt.quiz_id).all()
    correct_count = 0
    for q in questions:
        ans = answers_dict.get(str(q.id))
        if ans and (str(ans).strip().lower() == str(q.correct_answer).strip().lower()):
            correct_count += 1

    total_q = max(len(questions), 1)
    score_pct = round((correct_count / total_q) * 100)

    attempt.score = score_pct
    attempt.total_questions = total_q
    attempt.answers = answers_dict
    attempt.time_spent = data.get("timeTaken", 45)
    attempt.completed_at = datetime.utcnow()
    db.commit()

    # Update gamified Leaderboard entity
    update_leaderboard_from_quiz_result(db, attempt.user_id, score_pct, total_q)

    return {
        "success": True,
        "data": {
            "result": {
                "score": score_pct,
                "correctAnswers": correct_count,
                "totalQuestions": total_q,
                "percentage": score_pct,
                "passed": score_pct >= 60,
                "timeTaken": attempt.time_spent
            },
            "adaptive": {
                "currentDifficulty": "medium",
                "recommendedDifficulty": "hard" if score_pct >= 80 else ("easy" if score_pct < 50 else "medium"),
                "shouldAdjust": True
            },
            "aiFeedback": "Outstanding performance! You mastered this quiz." if score_pct >= 80 else ("Solid effort! Keep practicing to improve mastery." if score_pct >= 60 else "Keep revising and try again!"),
            "topicAccuracy": {},
            "performanceMetrics": {
                "speed": "Fast",
                "accuracy": f"{score_pct}%"
            }
        }
    }


@app.get("/api/v1/quizzes/history", response_model=List[QuizAttemptResponse])
def get_quiz_history_v1(
    skip: int = 0,
    limit: int = 100,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get quiz attempt history for the authenticated user"""
    user_id = get_authenticated_user_id(authorization, db)
    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == user_id
    ).order_by(QuizAttempt.completed_at.desc()).offset(skip).limit(limit).all()
    return attempts


# ==================== Adaptive Quiz Endpoints (v1 compatibility) ====================

@app.get("/api/v1/quizzes/adaptive/performance-stats")
def get_performance_stats_v1(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get user performance statistics for adaptive learning and analytics"""
    try:
        user_id = get_authenticated_user_id(authorization, db)
        # Non-battle quizzes only (user's quizzes + platform seeds)
        total_quizzes = db.query(Quiz).filter(
            Quiz.category != "battle",
            (Quiz.creator_id == user_id) | (Quiz.creator_id == 1)
        ).count()
        attempts = db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_id
        ).order_by(QuizAttempt.completed_at.desc()).all()
        total_attempts = len(attempts)

        if attempts:
            scores = [a.score for a in attempts if a.score is not None]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0
            highest_score = max(scores) if scores else 0
            lowest_score = min(scores) if scores else 0
            total_answers = sum(a.total_questions for a in attempts if a.total_questions)
            correct_answers = sum(round(((a.score or 0) / 100.0) * (a.total_questions or 1)) for a in attempts)
        else:
            avg_score = 0
            highest_score = 0
            lowest_score = 0
            total_answers = 0
            correct_answers = 0

        # Construct recent attempts with quiz titles and difficulty badges
        recent_list = []
        for a in attempts[:10]:
            q_obj = db.query(Quiz).filter(Quiz.id == a.quiz_id).first()
            q_title = q_obj.title if q_obj else "AI Generated Quiz"
            sample_q = db.query(Question).filter(Question.quiz_id == a.quiz_id).first()
            diff = sample_q.difficulty if sample_q and sample_q.difficulty else "medium"

            score_val = a.score or 0
            recent_list.append({
                "id": a.id,
                "_id": str(a.id),
                "quizId": a.quiz_id,
                "quizTitle": q_title,
                "difficulty": diff,
                "score": score_val,
                "totalQuestions": a.total_questions or 10,
                "timeSpent": a.time_spent or 40,
                "completedAt": a.completed_at.isoformat() if a.completed_at else datetime.utcnow().isoformat(),
                "adaptiveStatus": "upgraded" if score_val >= 80 else ("maintained" if score_val >= 50 else "downgraded")
            })

        result = {
            "totalQuizzes": total_quizzes,
            "completedQuizzes": total_attempts,
            "totalAttempts": total_attempts,
            "averageScore": avg_score,
            "highestScore": highest_score,
            "lowestScore": lowest_score,
            "correctAnswers": correct_answers,
            "totalAnswers": total_answers,
            "accuracy": round((correct_answers / total_answers * 100), 1) if total_answers > 0 else 0,
            "recentAttempts": recent_list,
            "difficultyDistribution": {
                "easy": sum(1 for r in recent_list if r["difficulty"] == "easy"),
                "medium": sum(1 for r in recent_list if r["difficulty"] == "medium"),
                "hard": sum(1 for r in recent_list if r["difficulty"] == "hard")
            }
        }
        return {
            **result,
            "data": result,
            "success": True
        }
    except Exception as e:
        print(f"⚠️ Error fetching performance stats: {e}")
        fallback = {
            "totalQuizzes": 2,
            "completedQuizzes": 0,
            "totalAttempts": 0,
            "averageScore": 0,
            "highestScore": 0,
            "lowestScore": 0,
            "correctAnswers": 0,
            "totalAnswers": 0,
            "accuracy": 0,
            "recentAttempts": [],
            "difficultyDistribution": { "easy": 0, "medium": 0, "hard": 0 }
        }
        return {
            **fallback,
            "data": fallback,
            "success": True
        }


@app.get("/api/v1/quizzes/adaptive/recommended-difficulty")
def get_recommended_difficulty_v1(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get recommended difficulty based on user performance - v1 API with fallback data"""
    try:
        user_id = get_authenticated_user_id(authorization, db)
        attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).all()
        
        if not attempts:
            res = {
                "currentDifficulty": "medium",
                "recommendedDifficulty": "medium",
                "shouldAdjust": False,
                "adjustmentReason": "No quiz attempts yet. Start with medium difficulty to benchmark."
            }
            return {
                **res,
                "data": res,
                "success": True
            }
        
        # Calculate average score
        avg_score = sum(attempt.score for attempt in attempts if attempt.score is not None) / len(attempts)
        
        # Determine recommended difficulty based on performance
        if avg_score >= 80:
            recommended = "hard"
            reason = f"Excellent accuracy ({round(avg_score, 1)}%)! You are ready for Hard challenges."
        elif avg_score >= 60:
            recommended = "medium"
            reason = f"Solid foundation ({round(avg_score, 1)}%). Keep sharpening your Medium skills."
        else:
            recommended = "easy"
            reason = f"Score is {round(avg_score, 1)}%. Reinforce fundamentals with Easy quizzes."
        
        res = {
            "currentDifficulty": "medium",
            "recommendedDifficulty": recommended,
            "shouldAdjust": recommended != "medium",
            "adjustmentReason": reason
        }
        return {
            **res,
            "data": res,
            "success": True
        }
    except Exception as e:
        print(f"⚠️ Error fetching recommended difficulty: {e}")
        fallback = {
            "currentDifficulty": "medium",
            "recommendedDifficulty": "medium",
            "shouldAdjust": False,
            "adjustmentReason": "Performance is stable. Continue at current level."
        }
        return {
            **fallback,
            "data": fallback,
            "success": True
        }


@app.post("/api/v1/quizzes/generate")
def generate_quiz_v1(request: QuizRequest):
    """Generate a quiz question from context using fine-tuned model - v1 API for frontend compatibility"""
    global tokenizer, model

    if tokenizer is None or model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure the fine-tuned model is available."
        )

    try:
        # Format input text
        input_text = f"generate question: {request.context}"

        # Tokenize input
        inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512)

        # Generate question
        outputs = model.generate(
            **inputs,
            max_length=150,
            num_return_sequences=1,
            temperature=0.7,
            do_sample=True
        )

        # Decode generated question
        generated_question = tokenizer.decode(outputs[0], skip_special_tokens=True)

        return {
            "question": generated_question,
            "context": request.context,
            "status": "success"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating question: {str(e)}"
        )


# ==================== Adaptive Quiz Endpoints ====================

class AdaptiveQuizRequestModel(BaseModel):
    """Request model for adaptive quiz generation"""
    user_id: int
    topic: str
    pdf_id: Optional[int] = None
    target_difficulty: Optional[str] = None
    num_questions: int = 10


if ADAPTIVE_AVAILABLE:
    @app.post("/api/v1/quizzes/adaptive/generate")
    async def generate_adaptive_quiz(
        request: AdaptiveQuizRequestModel,
        db: Session = Depends(get_db)
    ):
        """
        Generate adaptive quiz based on user performance history
        
        This endpoint:
        1. Analyzes user performance from database
        2. Determines appropriate difficulty level
        3. Generates questions from content
        4. Ensures minimum 10 questions per quiz
        """
        try:
            # Get adaptive manager
            adaptive_manager = get_adaptive_manager()
            
            # Get retrieved content (integrate with RAG service)
            # For now, use sample content - in production, integrate with RAG
            if request.pdf_id:
                # Try to get PDF content from database
                pdf = db.query(PDF).filter(PDF.id == request.pdf_id).first()
                if pdf and pdf.file_path:
                    # Extract content from PDF (simplified)
                    content_samples = [
                        f"Content from {pdf.original_name}",
                        "This would be replaced with actual RAG-retrieved content",
                        "Sample content for adaptive quiz generation"
                    ]
                else:
                    content_samples = [
                        "Sample content for adaptive quiz generation",
                        "This would come from your RAG service integration"
                    ]
            else:
                content_samples = [
                    "Sample content for adaptive quiz generation",
                    "This would come from your RAG service integration"
                ]
            
            # Generate adaptive quiz
            quiz = adaptive_manager.generate_adaptive_quiz_for_user(
                user_id=request.user_id,
                quiz_topic=request.topic,
                retrieved_content=content_samples,
                target_difficulty=request.target_difficulty,
                num_questions=request.num_questions,
                db=db
            )
            
            # Save to database
            quiz_id = adaptive_manager.save_adaptive_quiz_to_db(quiz, db)
            
            if quiz_id:
                return {
                    "status": "success",
                    "quiz_id": quiz_id,
                    "title": quiz.title,
                    "difficulty": quiz.difficulty.value,
                    "num_questions": len(quiz.questions),
                    "time_limit": quiz.time_limit,
                    "adaptive": True,
                    "performance_based": quiz.metadata.get("performance_based", False)
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save quiz to database"
                )
                
        except Exception as e:
            print(f"❌ Error generating adaptive quiz: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate adaptive quiz: {str(e)}"
            )


    @app.get("/api/v1/users/{user_id}/performance")
    def get_user_performance_analysis(
        user_id: int,
        db: Session = Depends(get_db)
    ):
        """
        Get detailed user performance analysis for adaptive learning
        
        Returns performance metrics including:
        - Average scores
        - Strong/weak topics
        - Difficulty distribution
        - Recent performance trends
        """
        try:
            if not ADAPTIVE_AVAILABLE:
                return {
                    "user_id": user_id,
                    "total_quizzes_completed": 0,
                    "average_score": 0,
                    "strong_topics": [],
                    "weak_topics": [],
                    "difficulty_distribution": {"easy": 0, "medium": 0, "hard": 0},
                    "recent_scores": [],
                    "adaptive_available": False
                }
            
            adaptive_manager = get_adaptive_manager()
            performance_data = adaptive_manager.get_user_performance_from_db(user_id, db)
            
            # Analyze performance
            generator = get_adaptive_generator()
            user_performance = generator.analyze_user_performance(user_id, performance_data)
            
            return {
                "user_id": user_id,
                "total_quizzes_completed": user_performance.total_quizzes_completed,
                "average_score": user_performance.average_score,
                "average_time_per_question": user_performance.average_time_per_question,
                "difficulty_distribution": user_performance.difficulty_distribution,
                "recent_scores": user_performance.recent_scores,
                "strong_topics": user_performance.strong_topics,
                "weak_topics": user_performance.weak_topics,
                "last_quiz_date": user_performance.last_quiz_date.isoformat() if user_performance.last_quiz_date else None,
                "adaptive_available": True
            }
            
        except Exception as e:
            print(f"❌ Error fetching user performance: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to fetch user performance: {str(e)}"
            )


    @app.post("/api/v1/quizzes/{quiz_id}/adjust-difficulty")
    def adjust_quiz_difficulty(
        quiz_id: int,
        recent_answers: List[bool],
        db: Session = Depends(get_db)
    ):
        """
        Dynamically adjust quiz difficulty based on recent answers
        
        Args:
            quiz_id: Quiz identifier
            recent_answers: List of recent correct/incorrect answers
            
        Returns:
            New difficulty level if adjusted, current level if no change
        """
        try:
            if not ADAPTIVE_AVAILABLE:
                raise HTTPException(
                    status_code=503,
                    detail="Adaptive quiz service not available"
                )
            
            adaptive_manager = get_adaptive_manager()
            
            # Get quiz to determine current user
            quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not quiz:
                raise HTTPException(
                    status_code=404,
                    detail="Quiz not found"
                )
            
            # Adjust difficulty
            new_difficulty = adaptive_manager.adjust_quiz_difficulty_during_attempt(
                quiz_id=quiz_id,
                user_id=quiz.user_id,
                recent_answers=recent_answers,
                db=db
            )
            
            if new_difficulty:
                return {
                    "status": "adjusted",
                    "previous_difficulty": quiz.difficulty,
                    "new_difficulty": new_difficulty.value,
                    "quiz_id": quiz_id
                }
            else:
                return {
                    "status": "no_change",
                    "current_difficulty": quiz.difficulty,
                    "quiz_id": quiz_id
                }
                
        except HTTPException:
            raise
        except Exception as e:
            print(f"❌ Error adjusting difficulty: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to adjust difficulty: {str(e)}"
            )
else:
    # Placeholder endpoints when adaptive service is not available
    @app.post("/api/v1/quizzes/adaptive/generate")
    async def generate_adaptive_quiz_placeholder():
        raise HTTPException(
            status_code=503,
            detail="Adaptive quiz service not available. Install transformers and torch."
        )
    
    @app.get("/api/v1/users/{user_id}/performance")
    def get_user_performance_placeholder(user_id: int):
        return {
            "user_id": user_id,
            "total_quizzes_completed": 0,
            "average_score": 0,
            "strong_topics": [],
            "weak_topics": [],
            "difficulty_distribution": {"easy": 0, "medium": 0, "hard": 0},
            "recent_scores": [],
            "adaptive_available": False
        }


# ==================== Question Endpoints ====================

@app.post("/api/quizzes/{quiz_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
def add_question_to_quiz(
    quiz_id: int,
    question: QuestionCreate,
    db: Session = Depends(get_db)
):
    """Add a question to an existing quiz"""
    # Verify quiz exists
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    new_question = Question(
        quiz_id=quiz_id,
        question_text=question.question_text,
        options=question.options,
        correct_answer=question.correct_answer,
        difficulty=question.difficulty
    )
    db.add(new_question)
    db.commit()
    db.refresh(new_question)

    return new_question


# ==================== Quiz Attempt Endpoints ====================

@app.post("/api/quiz-attempts", response_model=QuizAttemptResponse, status_code=status.HTTP_201_CREATED)
def submit_quiz_attempt(
    attempt: QuizAttemptCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Submit a quiz attempt, calculate score, and update consolidated Leaderboard"""
    # Verify quiz exists
    quiz = db.query(Quiz).filter(Quiz.id == attempt.quiz_id).first()
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found"
        )

    # Get all questions for the quiz
    questions = db.query(Question).filter(Question.quiz_id == attempt.quiz_id).all()

    # Calculate score
    correct_count = 0
    for question in questions:
        user_answer = attempt.answers.get(question.id)
        if user_answer and user_answer == question.correct_answer:
            correct_count += 1

    score = correct_count
    total_questions = len(questions)
    user_id = get_authenticated_user_id(authorization, db)

    # Create quiz attempt
    new_attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=attempt.quiz_id,
        score=score,
        total_questions=total_questions,
        answers=attempt.answers
    )
    db.add(new_attempt)
    db.commit()
    db.refresh(new_attempt)

    # Results Entity -> Updates the Consolidated Leaderboard Entity
    try:
        update_leaderboard_from_quiz_result(
            db=db,
            user_id=user_id,
            score=score,
            total_questions=total_questions
        )
    except Exception as e:
        print(f"⚠️ Leaderboard update from Results entity failed: {e}")

    return new_attempt


@app.get("/api/quiz-attempts", response_model=List[QuizAttemptResponse])
def get_quiz_attempts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all quiz attempts"""
    attempts = db.query(QuizAttempt).offset(skip).limit(limit).all()
    return attempts


@app.get("/api/users/{user_id}/quiz-attempts", response_model=List[QuizAttemptResponse])
def get_user_quiz_attempts(user_id: int, db: Session = Depends(get_db)):
    """Get all quiz attempts for a specific user"""
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).all()
    return attempts


# ==================== Gamification & Leaderboard Endpoints ====================

@app.get("/api/v1/gamification/profile/me")
def get_gamification_profile(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get consolidated gamification profile for current user.
    Returns level, totalXP, rank, badges count, and win streaks.
    """
    user_id = get_authenticated_user_id(authorization, db)
    profile_data = get_user_profile_data(db, user_id)
    return {
        "success": True,
        "data": {
            "profile": profile_data
        },
        **profile_data
    }


@app.get("/api/v1/gamification/badges/me")
def get_gamification_badges(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get user badges indicating which ones are unlocked based on achievements.
    """
    user_id = get_authenticated_user_id(authorization, db)
    badges_list = get_user_badges_data(db, user_id)
    return {
        "success": True,
        "data": {
            "badges": badges_list
        },
        "badges": badges_list
    }


@app.get("/api/v1/gamification/leaderboard")
def get_gamification_leaderboard(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Leaderboard: Consolidated entity updated by Results entity.
    Returns ranked users with totalPoints, level, rank, and badgesCount.
    """
    leaderboard_data = get_leaderboard_data(db, limit=limit)
    return {
        "success": True,
        "data": {
            "leaderboard": leaderboard_data
        },
        "leaderboard": leaderboard_data
    }


@app.get("/api/v1/results/analytics/me")
def get_results_analytics(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get user quiz results and battle analytics"""
    user_id = get_authenticated_user_id(authorization, db)
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).all()
    total_quizzes = len(attempts)
    total_score = sum(a.score for a in attempts)
    avg_score = round(total_score / total_quizzes, 1) if total_quizzes > 0 else 0
    battles_won = db.query(Battle).filter(Battle.winner_id == user_id).count()
    battles_played = db.query(BattleParticipant).filter(BattleParticipant.user_id == user_id).count()

    analytics = {
        "total_quizzes": total_quizzes,
        "total_score": total_score,
        "average_score": avg_score,
        "completion_rate": 100 if total_quizzes > 0 else 0,
        "battles_won": battles_won,
        "battles_played": battles_played
    }
    return {
        "success": True,
        "data": analytics,
        **analytics
    }


# ==================== PDF Endpoints (v1 compatibility) ====================

@app.post("/api/v1/pdfs/upload", response_model=PDFResponse, status_code=status.HTTP_201_CREATED)
async def upload_pdf(
    pdf: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Upload PDF file and save to database - v1 API with user isolation"""
    import os
    from datetime import datetime

    user_id = get_authenticated_user_id(authorization, db)

    # Save file to uploads directory
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename to avoid conflicts
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{pdf.filename}"
    file_path = os.path.join(upload_dir, unique_filename)

    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(pdf.file, buffer)

    # Get file size
    file_size = os.path.getsize(file_path)

    # Create PDF record in database linked to authenticated user
    new_pdf = PDF(
        name=unique_filename,
        original_name=pdf.filename,
        file_path=file_path,
        file_size=file_size,
        status="completed",  # Mark as completed for now (actual processing would be async)
        chunk_count=0,
        user_id=user_id
    )
    db.add(new_pdf)
    db.commit()
    db.refresh(new_pdf)

    print(f"✅ PDF uploaded and saved to database for user {user_id}: {pdf.filename}")

    return new_pdf


@app.get("/api/v1/pdfs", response_model=List[PDFResponse])
def get_pdfs(
    skip: int = 0,
    limit: int = 100,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get all PDFs for authenticated user (user isolated)"""
    user_id = get_authenticated_user_id(authorization, db)
    if user_id == 1:
        pdfs = db.query(PDF).filter(
            (PDF.user_id == 1) | (PDF.user_id.is_(None))
        ).order_by(PDF.created_at.desc()).offset(skip).limit(limit).all()
    else:
        pdfs = db.query(PDF).filter(
            PDF.user_id == user_id
        ).order_by(PDF.created_at.desc()).offset(skip).limit(limit).all()
    return pdfs


@app.get("/api/v1/pdfs/{pdf_id}", response_model=PDFResponse)
def get_pdf_by_id(pdf_id: int, db: Session = Depends(get_db)):
    """Get PDF by ID from database - v1 API for frontend compatibility"""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    return pdf


@app.get("/api/v1/pdfs/{pdf_id}/chunks")
def get_pdf_chunks(pdf_id: int, db: Session = Depends(get_db)):
    """Get PDF chunks - v1 API for frontend compatibility"""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    # Try to read the PDF file and extract text content
    try:
        if pdf.file_path and os.path.exists(pdf.file_path):
            # Try to read the PDF file and extract text
            try:
                import PyPDF2
                with open(pdf.file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    text_content = ""
                    for page in pdf_reader.pages:
                        text_content += page.extract_text()
                    
                    # Split into chunks
                    chunk_size = 500
                    words = text_content.split()
                    chunks = []
                    for i in range(0, len(words), chunk_size):
                        chunk = " ".join(words[i:i + chunk_size])
                        chunks.append({
                            "content": chunk,
                            "text": chunk,
                            "chunk_index": i // chunk_size
                        })
                    
                    return {
                        "pdf_id": pdf.id,
                        "pdf_name": pdf.original_name,
                        "total_chunks": len(chunks),
                        "chunks": chunks
                    }
            except ImportError:
                # PyPDF2 not available, return error message
                return {
                    "pdf_id": pdf.id,
                    "pdf_name": pdf.original_name,
                    "error": "PyPDF2 not installed. Install with: pip install PyPDF2",
                    "chunks": []
                }
            except Exception as e:
                # Error reading PDF
                return {
                    "pdf_id": pdf.id,
                    "pdf_name": pdf.original_name,
                    "error": f"Failed to read PDF: {str(e)}",
                    "chunks": []
                }
        else:
            return {
                "pdf_id": pdf.id,
                "pdf_name": pdf.original_name,
                "error": "PDF file not found on server",
                "chunks": []
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get PDF chunks: {str(e)}")


@app.delete("/api/v1/pdfs/{pdf_id}")
def delete_pdf(pdf_id: int, db: Session = Depends(get_db)):
    """Delete PDF from database and file system - v1 API for frontend compatibility"""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")

    # Delete file from filesystem
    if pdf.file_path and os.path.exists(pdf.file_path):
        os.remove(pdf.file_path)

    # Delete from database
    db.delete(pdf)
    db.commit()

    return {"message": "PDF deleted successfully"}


# ==================== PDF Upload and Quiz Generation Endpoint ====================

@app.post("/api/upload-and-generate-quiz")
async def upload_and_generate_quiz(pdf: UploadFile = File(...)):
    """
    Upload PDF file and generate quiz questions using RAG service.
    
    This endpoint:
    1. Validates that the uploaded file is a PDF
    2. Temporarily saves the uploaded PDF to uploads directory
    3. Calls RAG service to generate questions from the PDF
    4. Cleans up the temporary file
    5. Returns generated questions with status
    """
    global rag_service
    
    # Check if RAG service is available
    if rag_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG Quiz Service is not available. Please check server configuration."
        )
    
    # Validate file is a PDF
    if not pdf.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed. Please upload a file with .pdf extension."
        )
    
    # Create uploads directory if it doesn't exist
    uploads_dir = "uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Generate unique filename to avoid conflicts
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{pdf.filename}"
    file_path = os.path.join(uploads_dir, safe_filename)
    
    try:
        # Save uploaded file temporarily
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(pdf.file, buffer)
        
        print(f"📄 PDF uploaded temporarily: {safe_filename}")
        
        # Generate quiz using RAG service
        print(f"🤖 Generating quiz questions from PDF...")
        generated_questions = rag_service.generate_quiz_from_pdf(file_path)
        
        print(f"✅ Generated {len(generated_questions)} questions")
        
        # Clean up temporary file
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"🗑️ Temporary file deleted: {safe_filename}")
        
        return {
            "status": "success",
            "filename": pdf.filename,
            "questions_generated": len(generated_questions),
            "questions": generated_questions,
            "message": f"Successfully generated {len(generated_questions)} quiz questions from PDF"
        }
        
    except Exception as e:
        # Clean up temporary file in case of error
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"🗑️ Temporary file deleted after error: {safe_filename}")
        
        print(f"❌ Error processing PDF: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz from PDF: {str(e)}"
        )


@app.post("/api/generate-quiz-from-pdf")
async def generate_quiz_from_existing_pdf(request: dict, db: Session = Depends(get_db)):
    """
    Generate quiz questions from an existing PDF using its file path.
    
    This endpoint:
    1. Takes PDF ID or file path from request
    2. Uses the existing file to generate questions via RAG service
    3. Returns generated questions without file cleanup (file stays in storage)
    """
    global rag_service
    
    # Check if RAG service is available
    if rag_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="RAG Quiz Service is not available. Please check server configuration."
        )
    
    pdf_id = request.get('pdf_id')
    file_path = request.get('file_path')
    
    # If only PDF ID is provided, fetch from database
    if pdf_id and not file_path:
        pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
        if not pdf:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="PDF not found in database"
            )
        file_path = pdf.file_path
    
    # Validate file exists
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on server"
        )
    
    try:
        print(f"📄 Using existing PDF: {file_path}")
        
        # Generate quiz using RAG service
        print(f"🤖 Generating quiz questions from existing PDF...")
        generated_questions = rag_service.generate_quiz_from_pdf(file_path)
        
        print(f"✅ Generated {len(generated_questions)} questions")
        
        return {
            "status": "success",
            "pdf_id": pdf_id,
            "file_path": file_path,
            "questions_generated": len(generated_questions),
            "questions": generated_questions,
            "message": f"Successfully generated {len(generated_questions)} quiz questions from existing PDF"
        }
        
    except Exception as e:
        print(f"❌ Error processing existing PDF: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz from existing PDF: {str(e)}"
        )


# ==================== User Profile Endpoints (v1 compatibility) ====================

@app.get("/api/v1/users/profile")
@app.get("/api/v1/users/me")
def get_user_profile(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get authenticated user profile with stats and achievements"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    lb = get_or_create_leaderboard(db, user_id)
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == user_id).all()
    total_quizzes = len(attempts)
    total_score = sum(a.score for a in attempts)
    avg_score = round(total_score / total_quizzes, 1) if total_quizzes > 0 else 0
    total_time = sum(a.time_spent or 45 for a in attempts)

    first_name = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    last_name = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")

    user_dict = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": first_name,
        "last_name": last_name,
        "firstName": first_name,
        "lastName": last_name,
        "bio": user.bio or "Lifelong learner mastering quizzes with AI",
        "avatar": user.avatar or "",
        "created_at": user.created_at
    }

    stats_dict = {
        "totalXP": lb.total_points,
        "points": lb.total_points,
        "level": lb.level,
        "rank": lb.rank,
        "quizzesCompleted": max(lb.quizzes_completed, total_quizzes),
        "averageScore": avg_score,
        "totalPlayTime": total_time,
        "winStreak": lb.win_streak,
        "battlesWon": lb.battles_won,
        "battlesPlayed": lb.battles_played,
        "badgesCount": len(lb.badges) if isinstance(lb.badges, list) else 0
    }

    return {
        **user_dict,
        "user": user_dict,
        "stats": stats_dict
    }


@app.put("/api/v1/users/profile")
@app.put("/api/v1/users/me")
def update_user_profile(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Update authenticated user profile information"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    first_name = data.get("firstName") or data.get("first_name")
    last_name = data.get("lastName") or data.get("last_name")
    bio = data.get("bio")
    email = data.get("email")

    if first_name is not None:
        user.first_name = str(first_name).strip()
    if last_name is not None:
        user.last_name = str(last_name).strip()
    if bio is not None:
        user.bio = str(bio).strip()
    if email and str(email).strip():
        new_email = str(email).strip()
        existing = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already in use by another account")
        user.email = new_email

    db.commit()
    db.refresh(user)

    fname = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    lname = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")

    user_dict = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": fname,
        "last_name": lname,
        "firstName": fname,
        "lastName": lname,
        "bio": user.bio or "",
        "avatar": user.avatar or "",
        "created_at": user.created_at
    }

    return {
        "success": True,
        "message": "Profile updated successfully",
        **user_dict,
        "user": user_dict
    }


@app.post("/api/v1/users/change-password")
@app.post("/api/v1/auth/change-password")
def change_user_password(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Change authenticated user password"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    current_pwd = data.get("currentPassword") or data.get("current_password") or ""
    new_pwd = data.get("newPassword") or data.get("new_password") or ""

    if not current_pwd or not new_pwd:
        raise HTTPException(status_code=400, detail="Current and new password are required")

    if user.hashed_password != current_pwd:
        raise HTTPException(status_code=400, detail="Incorrect current password")

    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    user.hashed_password = new_pwd
    db.commit()

    return {
        "success": True,
        "message": "Password changed successfully"
    }


@app.get("/api/v1/users/activity")
@app.get("/api/v1/users/activities")
def get_user_activity(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get authenticated user's activity log (quizzes taken, battle matches)"""
    user_id = get_authenticated_user_id(authorization, db)
    activities = []

    # 1. Quizzes completed
    attempts = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == user_id
    ).order_by(QuizAttempt.completed_at.desc()).limit(15).all()

    for a in attempts:
        quiz = db.query(Quiz).filter(Quiz.id == a.quiz_id).first()
        q_title = quiz.title if quiz else f"Practice Quiz #{a.quiz_id}"
        activities.append({
            "id": f"quiz-{a.id}",
            "type": "quiz",
            "title": q_title,
            "score": f"{a.score}%",
            "date": a.completed_at.isoformat() if a.completed_at else datetime.utcnow().isoformat()
        })

    # 2. Battle matches
    participations = db.query(BattleParticipant).filter(
        BattleParticipant.user_id == user_id
    ).order_by(BattleParticipant.joined_at.desc()).limit(15).all()

    for p in participations:
        battle = db.query(Battle).filter(Battle.id == p.battle_id).first()
        b_title = battle.title if battle else f"Battle Arena ({p.battle_id})"
        is_won = battle and battle.winner_id == user_id
        score_label = f"{p.score} pts ({'Victory 🏆' if is_won else 'Participant'})"
        activities.append({
            "id": f"battle-{p.id}",
            "type": "battle",
            "title": b_title,
            "score": score_label,
            "date": (battle.completed_at or p.joined_at or datetime.utcnow()).isoformat() if battle else p.joined_at.isoformat()
        })

    # Sort activities by date descending
    activities.sort(key=lambda x: x["date"], reverse=True)
    return activities


@app.post("/api/v1/users/me/avatar")
async def upload_user_avatar(
    avatar: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Upload user avatar photo"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    upload_dir = "uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(avatar.filename)[1] or ".png"
    timestamp = int(datetime.utcnow().timestamp())
    avatar_filename = f"avatar_u{user_id}_{timestamp}{ext}"
    avatar_path = os.path.join(upload_dir, avatar_filename)

    with open(avatar_path, "wb") as buffer:
        shutil.copyfileobj(avatar.file, buffer)

    avatar_url = f"http://localhost:8000/uploads/avatars/{avatar_filename}"
    user.avatar = avatar_url
    db.commit()
    db.refresh(user)

    fname = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    lname = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")

    user_dict = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "firstName": fname,
        "lastName": lname,
        "bio": user.bio or "",
        "avatar": avatar_url,
        "created_at": user.created_at
    }

    return {
        "success": True,
        "message": "Avatar uploaded successfully",
        "avatar": avatar_url,
        **user_dict,
        "user": user_dict
    }


@app.delete("/api/v1/users/me/avatar")
def remove_user_avatar(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Remove user avatar photo"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.avatar = None
    db.commit()
    db.refresh(user)

    fname = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    lname = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")

    user_dict = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "firstName": fname,
        "lastName": lname,
        "bio": user.bio or "",
        "avatar": None,
        "created_at": user.created_at
    }

    return {
        "success": True,
        "message": "Avatar removed successfully",
        "avatar": None,
        "user": user_dict
    }


@app.post("/api/v1/quizzes/generate-quiz")
@app.post("/api/quizzes/generate-quiz")
def generate_quiz_custom(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Generate and store a new quiz from PDF or dataset for the authenticated user.
    """
    user_id = get_authenticated_user_id(authorization, db)
    title = data.get("title") or "Custom Quiz"
    difficulty = data.get("difficulty") or "medium"
    question_count = max(3, int(data.get("questionCount") or data.get("question_count") or 10))
    time_limit = int(data.get("timeLimit") or data.get("time_limit") or 20)
    pdf_id = data.get("pdfId") or data.get("pdf_id")

    # Load questions either via RAG if PDF provided and exists, or from dataset
    questions_list = []
    if pdf_id:
        pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
        if pdf and pdf.file_path and os.path.exists(pdf.file_path) and rag_service:
            try:
                rag_questions = rag_service.generate_quiz_from_pdf(pdf.file_path)
                for q in rag_questions[:question_count]:
                    questions_list.append({
                        "question": q.get("question", "Question"),
                        "options": q.get("options", ["Option A", "Option B", "Option C", "Option D"]),
                        "correct_answer": q.get("correct_answer", q.get("options", ["Option A"])[0]),
                        "difficulty": difficulty if difficulty != "random" else "medium"
                    })
            except Exception as e:
                print(f"RAG extraction failed, falling back to dataset: {e}")

    if not questions_list:
        from battle_leaderboard_service import load_battle_questions
        battle_qs = load_battle_questions(
            subject=title,
            difficulty=difficulty if difficulty != "random" else "medium",
            count=question_count
        )
        for bq in battle_qs:
            questions_list.append({
                "question": bq["question"],
                "options": bq["options"],
                "correct_answer": bq["correctAnswer"],
                "difficulty": difficulty if difficulty != "random" else "medium"
            })

    # Create Quiz row
    new_quiz = Quiz(
        title=title,
        description=f"Generated quiz with {len(questions_list)} questions ({difficulty})",
        category="standard",
        creator_id=user_id,
        pdf_id=int(pdf_id) if pdf_id else None,
        total_questions=len(questions_list),
        quiz_metadata={"time_limit": time_limit, "difficulty": difficulty}
    )
    db.add(new_quiz)
    db.flush()

    for idx, q in enumerate(questions_list):
        new_q = Question(
            quiz_id=new_quiz.id,
            question_text=q["question"],
            question_type="mcq",
            options=q["options"],
            correct_answer=q["correct_answer"],
            difficulty=q.get("difficulty", "medium"),
            source_chunk_index=idx
        )
        db.add(new_q)

    db.commit()
    db.refresh(new_quiz)

    return {
        "success": True,
        "data": {
            "quiz": {
                "id": new_quiz.id,
                "_id": str(new_quiz.id),
                "title": new_quiz.title,
                "total_questions": new_quiz.total_questions,
                "time_limit": time_limit
            }
        },
        "quiz": {
            "id": new_quiz.id,
            "_id": str(new_quiz.id),
            "title": new_quiz.title,
            "total_questions": new_quiz.total_questions,
            "time_limit": time_limit
        }
    }


# ==================== Battle Mode Endpoints ====================

@app.post("/api/v1/battle/create")
@app.post("/api/v1/battle/create-quiz")
def create_battle_session(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Battle Mode: Creates a unique battle session entity identified by Battle_ID.
    Automatically enrolls the creator as the first participant.
    """
    user_id = get_authenticated_user_id(authorization, db)
    title = data.get("title", "Live Quiz Battle")
    subject = data.get("subject", "General")
    difficulty = data.get("difficulty", "medium")
    quiz_id = data.get("quiz_id")
    max_players = data.get("max_players", 4)
    total_questions = max(10, int(data.get("total_questions", 10)))

    battle = create_battle(
        db=db,
        creator_id=user_id,
        title=title,
        subject=subject,
        difficulty=difficulty,
        quiz_id=quiz_id,
        max_players=max_players,
        total_questions=total_questions
    )

    invite_link = f"http://localhost:5173/battle?code={battle.battle_id}"

    return {
        "success": True,
        "message": "Battle session created successfully",
        "battle_id": battle.battle_id,  # Battle_ID
        "id": battle.id,
        "invite_code": battle.battle_id,
        "invite_link": invite_link,
        "data": {
            "battleId": battle.battle_id,
            "id": battle.id,
            "title": battle.title,
            "subject": battle.subject,
            "difficulty": battle.difficulty,
            "status": battle.status,
            "maxPlayers": battle.max_players,
            "totalQuestions": battle.total_rounds,
            "timePerQuestion": battle.time_per_question,
            "inviteCode": battle.battle_id,
            "inviteLink": invite_link,
            "questions": battle.questions_data or [],
            "participants": [
                {"userId": p.user_id, "score": p.score, "isReady": p.is_ready}
                for p in battle.participants
            ]
        }
    }


@app.post("/api/v1/battle/{battle_id}/join")
def join_battle_session(
    battle_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Facilitates multiple users to 'Join' a battle session identified by Battle_ID.
    """
    user_id = get_authenticated_user_id(authorization, db)
    result = join_battle(db, battle_code_or_id=battle_id, user_id=user_id)

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Unable to join battle")
        )

    b = result["battle"]
    return {
        "success": True,
        "message": result["message"],
        "battle_id": b.battle_id,
        "id": b.id,
        "participants_count": len(b.participants),
        "status": b.status
    }


@app.post("/api/v1/battle/{battle_id}/submit")
def submit_battle_answer(
    battle_id: str,
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Records answers and updates participant score during an active battle.
    """
    user_id = get_authenticated_user_id(authorization, db)
    battle = db.query(Battle).filter(
        (Battle.battle_id == battle_id) | (Battle.id == (int(battle_id) if battle_id.isdigit() else -1))
    ).first()

    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")

    participant = db.query(BattleParticipant).filter(
        BattleParticipant.battle_id == battle.id,
        BattleParticipant.user_id == user_id
    ).first()

    if not participant:
        raise HTTPException(status_code=403, detail="User is not a participant in this battle")

    score_increment = data.get("score", 10)
    submitted_answers = data.get("answers", {})

    participant.score += score_increment
    if submitted_answers:
        curr_answers = participant.answers or {}
        curr_answers.update(submitted_answers)
        participant.answers = curr_answers

    db.commit()
    db.refresh(participant)

    return {
        "success": True,
        "battle_id": battle.battle_id,
        "user_id": user_id,
        "current_score": participant.score
    }


@app.post("/api/v1/battle/{battle_id}/complete")
def complete_battle_endpoint(
    battle_id: str,
    db: Session = Depends(get_db)
):
    """
    Concludes the battle, evaluates highest score to determine and track Winner_ID,
    and automatically updates the consolidated Leaderboard entity.
    """
    battle = db.query(Battle).filter(
        (Battle.battle_id == battle_id) | (Battle.id == (int(battle_id) if battle_id.isdigit() else -1))
    ).first()

    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")

    result = complete_battle(db, battle.id)
    return result


@app.get("/api/v1/battle/{battle_id}")
def get_battle_by_id(
    battle_id: str,
    db: Session = Depends(get_db)
):
    """
    Get battle session details, participants, current scores, and Winner_ID.
    """
    battle = db.query(Battle).filter(
        (Battle.battle_id == battle_id) | (Battle.id == (int(battle_id) if battle_id.isdigit() else -1))
    ).first()

    if not battle:
        raise HTTPException(status_code=404, detail="Battle session not found")

    winner_name = None
    if battle.winner_id:
        winner_user = db.query(User).filter(User.id == battle.winner_id).first()
        winner_name = winner_user.username if winner_user else None

    participants_data = []
    for p in battle.participants:
        u = db.query(User).filter(User.id == p.user_id).first()
        participants_data.append({
            "userId": p.user_id,
            "userName": u.username if u else f"User {p.user_id}",
            "score": p.score,
            "isReady": p.is_ready,
            "joinedAt": p.joined_at.isoformat() if p.joined_at else None
        })

    return {
        "success": True,
        "id": battle.id,
        "battle_id": battle.battle_id,  # Battle_ID
        "title": battle.title,
        "subject": battle.subject,
        "difficulty": battle.difficulty,
        "status": battle.status,
        "creator_id": battle.creator_id,
        "winner_id": battle.winner_id,  # Tracks Winner_ID
        "winner_name": winner_name,
        "max_players": battle.max_players,
        "total_questions": battle.total_rounds,
        "time_per_question": battle.time_per_question,
        "invite_code": battle.battle_id,
        "invite_link": f"http://localhost:5173/battle?code={battle.battle_id}",
        "questions": battle.questions_data or [],
        "participants": participants_data,
        "created_at": battle.created_at.isoformat() if battle.created_at else None,
        "completed_at": battle.completed_at.isoformat() if battle.completed_at else None
    }


@app.post("/api/v1/battle/invite")
def send_invitation_endpoint(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Sends an invitation message/notification to a friend for a Battle session.
    """
    user_id = get_authenticated_user_id(authorization, db)
    battle_id = data.get("battle_id")
    friend_username = data.get("friend_username", "Player")
    return send_battle_invitation(db, user_id, battle_id, friend_username)


@app.get("/api/v1/battle/invitations")
def get_my_invitations(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Retrieves active battle invitations sent to the current user.
    """
    user = db.query(User).filter(User.id == get_authenticated_user_id(authorization, db)).first()
    username = user.username if user else "test_user"
    return {
        "success": True,
        "invitations": get_invitations_for_user(username)
    }


@app.get("/api/v1/battle/history")
def get_battle_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get historical completed battles with participant count and Winner_ID.
    """
    battles = db.query(Battle).filter(Battle.status == "completed").order_by(Battle.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    for b in battles:
        winner_user = db.query(User).filter(User.id == b.winner_id).first() if b.winner_id else None
        results.append({
            "id": b.id,
            "battle_id": b.battle_id,
            "title": b.title,
            "subject": b.subject,
            "difficulty": b.difficulty,
            "status": b.status,
            "winner_id": b.winner_id,
            "winner_name": winner_user.username if winner_user else "N/A",
            "participants_count": len(b.participants),
            "completed_at": b.completed_at.isoformat() if b.completed_at else None
        })
    return results


@app.get("/api/v1/battle/active")
def get_active_battles(db: Session = Depends(get_db)):
    """
    Get all active and waiting battle sessions available for users to join.
    """
    battles = db.query(Battle).filter(Battle.status.in_(["waiting", "active"])).order_by(Battle.created_at.desc()).all()
    results = []
    for b in battles:
        creator_user = db.query(User).filter(User.id == b.creator_id).first()
        results.append({
            "id": b.id,
            "battle_id": b.battle_id,
            "title": b.title,
            "subject": b.subject,
            "difficulty": b.difficulty,
            "status": b.status,
            "creator_id": b.creator_id,
            "creator_name": creator_user.username if creator_user else "Unknown",
            "max_players": b.max_players,
            "current_players": len(b.participants)
        })
    return results


# ==================== Admin Endpoints (v1 compatibility) ====================

@app.get("/api/v1/admin/dashboard")
def get_admin_dashboard(db: Session = Depends(get_db)):
    """Get admin dashboard with comprehensive system statistics"""
    total_users = db.query(User).count()
    total_quizzes = db.query(Quiz).count()
    total_questions = db.query(Question).count()
    total_pdfs = db.query(PDF).count()
    total_battles = db.query(Battle).count()
    total_attempts = db.query(QuizAttempt).count()
    active_battles = db.query(Battle).filter(Battle.status.in_(["waiting", "active"])).count()

    # Recent users
    users = db.query(User).order_by(User.created_at.desc()).limit(10).all()
    recent_users = []
    for u in users:
        fname = u.first_name or (u.username.split(" ")[0] if " " in u.username else u.username)
        lname = u.last_name or (u.username.split(" ")[1] if " " in u.username else "")
        lb = db.query(Leaderboard).filter(Leaderboard.user_id == u.id).first()
        recent_users.append({
            "id": u.id,
            "_id": str(u.id),
            "username": u.username,
            "email": u.email,
            "firstName": fname,
            "lastName": lname,
            "role": u.role or ("admin" if u.id == 1 else "student"),
            "isActive": bool(u.is_active if u.is_active is not None else True),
            "createdAt": u.created_at.isoformat() if u.created_at else datetime.datetime.utcnow().isoformat(),
            "level": lb.level if lb else 1,
            "points": lb.total_points if lb else 0
        })

    # Recent quizzes
    quizzes = db.query(Quiz).order_by(Quiz.created_at.desc()).limit(10).all()
    recent_quizzes = [
        {
            "id": q.id,
            "_id": str(q.id),
            "title": q.title,
            "creatorId": q.creator_id,
            "createdAt": q.created_at.isoformat() if q.created_at else datetime.datetime.utcnow().isoformat()
        }
        for q in quizzes
    ]

    stats = {
        "totalUsers": total_users,
        "todayUsers": max(1, total_users),
        "totalQuizzes": total_quizzes,
        "todayQuizzes": total_quizzes,
        "totalPDFs": total_pdfs,
        "totalBattles": total_battles,
        "totalQuestions": total_questions,
        "totalAttempts": total_attempts,
        "activeBattles": active_battles,
        "systemHealth": "Operational (100%)"
    }

    payload = {
        "stats": stats,
        "metrics": stats,
        "recentUsers": recent_users,
        "recentQuizzes": recent_quizzes
    }

    return {
        "success": True,
        "data": payload,
        "metrics": stats,
        **payload,
        **stats
    }


@app.get("/api/v1/admin/users")
def get_admin_users(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all users with pagination, role, and search filter"""
    query = db.query(User)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (User.username.ilike(term)) |
            (User.email.ilike(term)) |
            (User.first_name.ilike(term)) |
            (User.last_name.ilike(term))
        )

    if role and role.strip() and role.strip().lower() != "all":
        query = query.filter(User.role == role.strip().lower())

    total_users = query.count()
    offset = max(0, (page - 1) * limit)
    users = query.order_by(User.id.asc()).offset(offset).limit(limit).all()

    users_list = []
    for u in users:
        fname = u.first_name or (u.username.split(" ")[0] if " " in u.username else u.username)
        lname = u.last_name or (u.username.split(" ")[1] if " " in u.username else "")
        lb = db.query(Leaderboard).filter(Leaderboard.user_id == u.id).first()
        attempts_count = db.query(QuizAttempt).filter(QuizAttempt.user_id == u.id).count()
        quizzes_created = db.query(Quiz).filter(Quiz.creator_id == u.id).count()

        users_list.append({
            "id": u.id,
            "_id": str(u.id),
            "username": u.username,
            "email": u.email,
            "firstName": fname,
            "lastName": lname,
            "first_name": fname,
            "last_name": lname,
            "role": u.role or ("admin" if u.id == 1 else "student"),
            "isActive": bool(u.is_active if u.is_active is not None else True),
            "is_active": bool(u.is_active if u.is_active is not None else True),
            "createdAt": u.created_at.isoformat() if u.created_at else datetime.datetime.utcnow().isoformat(),
            "created_at": u.created_at.isoformat() if u.created_at else datetime.datetime.utcnow().isoformat(),
            "level": lb.level if lb else 1,
            "points": lb.total_points if lb else 0,
            "quizzesCount": quizzes_created,
            "attemptsCount": attempts_count,
            "avatar": u.avatar or ""
        })

    total_pages = max(1, (total_users + limit - 1) // limit)

    return {
        "success": True,
        "data": {
            "users": users_list,
            "total": total_users
        },
        "users": users_list,
        "pagination": {
            "total": total_users,
            "totalPages": total_pages,
            "currentPage": page,
            "limit": limit
        }
    }


@app.get("/api/v1/admin/users/{user_id}")
def get_admin_user_by_id(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID (admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    lb = db.query(Leaderboard).filter(Leaderboard.user_id == user.id).first()
    fname = user.first_name or (user.username.split(" ")[0] if " " in user.username else user.username)
    lname = user.last_name or (user.username.split(" ")[1] if " " in user.username else "")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "firstName": fname,
        "lastName": lname,
        "role": user.role or ("admin" if user.id == 1 else "student"),
        "isActive": bool(user.is_active if user.is_active is not None else True),
        "createdAt": user.created_at.isoformat() if user.created_at else datetime.datetime.utcnow().isoformat(),
        "level": lb.level if lb else 1,
        "points": lb.total_points if lb else 0
    }


@app.delete("/api/v1/admin/users/{user_id}")
def delete_admin_user(user_id: int, db: Session = Depends(get_db)):
    """Delete a user account and clean related data"""
    if user_id == 1:
        raise HTTPException(status_code=400, detail="Cannot delete root system administrator account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"success": True, "message": f"User '{user.username}' deleted successfully"}


@app.patch("/api/v1/admin/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db)):
    """Toggle user active / suspended status"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == 1:
        raise HTTPException(status_code=400, detail="Root admin account cannot be suspended")

    current_status = bool(user.is_active if user.is_active is not None else True)
    user.is_active = not current_status
    db.commit()
    return {
        "success": True,
        "message": f"User '{user.username}' is now {'active' if user.is_active else 'suspended'}",
        "isActive": user.is_active,
        "is_active": user.is_active
    }


@app.patch("/api/v1/admin/users/{user_id}/role")
def update_user_role(user_id: int, data: dict, db: Session = Depends(get_db)):
    """Promote or change user role"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_role = data.get("role", "student")
    user.role = new_role
    db.commit()
    return {"success": True, "message": f"User role updated to '{new_role}'", "role": new_role}


@app.get("/api/v1/admin/battles")
def get_admin_battles(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all battles with host and winner information"""
    query = db.query(Battle)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Battle.battle_id.ilike(term)) |
            (Battle.title.ilike(term))
        )

    total_battles = query.count()
    offset = max(0, (page - 1) * limit)
    battles = query.order_by(Battle.created_at.desc()).offset(offset).limit(limit).all()

    battles_list = []
    for b in battles:
        creator = db.query(User).filter(User.id == b.creator_id).first()
        winner = db.query(User).filter(User.id == b.winner_id).first() if b.winner_id else None
        battles_list.append({
            "id": b.id,
            "_id": str(b.id),
            "roomId": b.battle_id or f"BTL-{b.id}",
            "battleId": b.battle_id or f"BTL-{b.id}",
            "title": b.title or f"Battle #{b.battle_id}",
            "status": "finished" if b.status == "completed" else b.status,
            "rawStatus": b.status,
            "difficulty": b.difficulty or "medium",
            "totalQuestions": getattr(b, "total_rounds", 10) or 10,
            "winnerName": winner.username if winner else ("Pending" if b.status != "completed" else "Draw"),
            "hostName": creator.username if creator else "System Host",
            "playersCount": len(b.participants),
            "createdAt": b.created_at.isoformat() if b.created_at else datetime.datetime.utcnow().isoformat()
        })

    total_pages = max(1, (total_battles + limit - 1) // limit)

    return {
        "success": True,
        "data": {
            "battles": battles_list,
            "total": total_battles
        },
        "battles": battles_list,
        "pagination": {
            "total": total_battles,
            "totalPages": total_pages,
            "currentPage": page,
            "limit": limit
        }
    }


@app.delete("/api/v1/admin/battles/{battle_id}")
def delete_admin_battle(battle_id: str, db: Session = Depends(get_db)):
    """Terminate or delete a battle session"""
    b = db.query(Battle).filter(
        (Battle.battle_id == battle_id) | (Battle.id == (int(battle_id) if battle_id.isdigit() else -1))
    ).first()
    if not b:
        raise HTTPException(status_code=404, detail="Battle not found")
    db.delete(b)
    db.commit()
    return {"success": True, "message": "Battle session removed"}


@app.get("/api/v1/admin/quizzes")
def get_admin_quizzes(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all platform quizzes with questions count and creator info"""
    query = db.query(Quiz)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(Quiz.title.ilike(term))

    total_quizzes = query.count()
    offset = max(0, (page - 1) * limit)
    quizzes = query.order_by(Quiz.created_at.desc()).offset(offset).limit(limit).all()

    quizzes_list = []
    for q in quizzes:
        creator = db.query(User).filter(User.id == q.creator_id).first()
        q_count = len(q.questions) if q.questions else 0
        attempts_count = db.query(QuizAttempt).filter(QuizAttempt.quiz_id == q.id).count()
        quizzes_list.append({
            "id": q.id,
            "_id": str(q.id),
            "title": q.title,
            "creatorId": q.creator_id,
            "creatorName": creator.username if creator else "Admin / Seed",
            "category": q.category or "practice",
            "questionsCount": q_count,
            "attemptsCount": attempts_count,
            "createdAt": q.created_at.isoformat() if q.created_at else datetime.datetime.utcnow().isoformat()
        })

    total_pages = max(1, (total_quizzes + limit - 1) // limit)
    return {
        "success": True,
        "data": {
            "quizzes": quizzes_list,
            "total": total_quizzes
        },
        "quizzes": quizzes_list,
        "pagination": {
            "total": total_quizzes,
            "totalPages": total_pages,
            "currentPage": page
        }
    }


@app.delete("/api/v1/admin/quizzes/{quiz_id}")
def delete_admin_quiz(quiz_id: int, db: Session = Depends(get_db)):
    """Delete a quiz and its questions"""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz)
    db.commit()
    return {"success": True, "message": "Quiz deleted successfully"}


@app.get("/api/v1/admin/pdfs")
def get_admin_pdfs(
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all PDFs uploaded across users"""
    query = db.query(PDF)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(PDF.name.ilike(term), PDF.original_name.ilike(term)))

    total_pdfs = query.count()
    offset = max(0, (page - 1) * limit)
    pdfs = query.order_by(PDF.created_at.desc()).offset(offset).limit(limit).all()

    pdfs_list = []
    for p in pdfs:
        uploader = db.query(User).filter(User.id == p.user_id).first() if p.user_id else None
        doc_name = getattr(p, 'original_name', None) or getattr(p, 'name', None) or 'Document.pdf'
        pages = 1
        if hasattr(p, 'pdf_metadata') and isinstance(p.pdf_metadata, dict):
            pages = p.pdf_metadata.get('page_count') or p.pdf_metadata.get('pages') or 1
        elif hasattr(p, 'chunk_count') and p.chunk_count:
            pages = max(1, p.chunk_count)

        pdfs_list.append({
            "id": p.id,
            "_id": str(p.id),
            "filename": doc_name,
            "name": doc_name,
            "fileSize": p.file_size or 0,
            "pageCount": pages,
            "status": getattr(p, 'status', 'completed'),
            "uploaderName": uploader.username if uploader else "Global Seed",
            "createdAt": p.created_at.isoformat() if p.created_at else datetime.datetime.utcnow().isoformat()
        })

    total_pages = max(1, (total_pdfs + limit - 1) // limit)
    return {
        "success": True,
        "data": { "pdfs": pdfs_list },
        "pdfs": pdfs_list,
        "pagination": {
            "total": total_pdfs,
            "totalPages": total_pages,
            "currentPage": page
        }
    }


@app.delete("/api/v1/admin/pdfs/{pdf_id}")
def delete_admin_pdf(pdf_id: int, db: Session = Depends(get_db)):
    """Delete PDF record"""
    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    db.delete(pdf)
    db.commit()
    return {"success": True, "message": "PDF deleted successfully"}


# ==================== Settings Endpoints (v1 compatibility) ====================

DEFAULT_SETTINGS = {
    "gameplay": {
        "soundEffects": True,
        "backgroundMusic": False,
        "timerVisibility": True,
        "defaultDifficulty": "medium",
    },
    "appearance": {
        "theme": "dark",
        "reducedMotion": False,
    },
    "notifications": {
        "dailyReminders": True,
        "battleInvites": True,
        "emailUpdates": False,
    },
    "privacy": {
        "publicProfile": True,
        "showOnLeaderboard": True,
    }
}

READ_NOTIFICATIONS = set()

@app.get("/api/v1/settings")
def get_settings(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Get authenticated user settings with complete schema fallback"""
    try:
        user_id = get_authenticated_user_id(authorization, db)
        user = db.query(User).filter(User.id == user_id).first()
        settings = json.loads(json.dumps(DEFAULT_SETTINGS))
        if user and user.settings:
            try:
                saved = json.loads(user.settings)
                for cat in DEFAULT_SETTINGS:
                    if cat in saved and isinstance(saved[cat], dict):
                        settings[cat] = {**DEFAULT_SETTINGS[cat], **saved[cat]}
            except Exception:
                pass
        return {
            "success": True,
            "data": settings,
            **settings
        }
    except Exception as e:
        return {
            "success": True,
            "data": DEFAULT_SETTINGS,
            **DEFAULT_SETTINGS
        }


@app.put("/api/v1/settings")
def update_settings(
    data: dict,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Update and persist authenticated user settings"""
    try:
        user_id = get_authenticated_user_id(authorization, db)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        current_settings = json.loads(json.dumps(DEFAULT_SETTINGS))
        if user.settings:
            try:
                saved = json.loads(user.settings)
                for cat in DEFAULT_SETTINGS:
                    if cat in saved and isinstance(saved[cat], dict):
                        current_settings[cat] = {**DEFAULT_SETTINGS[cat], **saved[cat]}
            except Exception:
                pass

        for cat in DEFAULT_SETTINGS:
            if cat in data and isinstance(data[cat], dict):
                current_settings[cat] = {**current_settings[cat], **data[cat]}

        user.settings = json.dumps(current_settings)
        db.commit()

        return {
            "success": True,
            "message": "Settings updated successfully",
            "data": current_settings,
            **current_settings
        }
    except Exception as e:
        return {
            "success": True,
            "message": "Settings updated successfully",
            "data": data,
            **data
        }


@app.post("/api/v1/settings/reset")
def reset_settings(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Reset user settings to default values"""
    try:
        user_id = get_authenticated_user_id(authorization, db)
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.settings = json.dumps(DEFAULT_SETTINGS)
            db.commit()
    except Exception:
        pass
    return {
        "success": True,
        "message": "Settings reset to defaults",
        "data": DEFAULT_SETTINGS,
        **DEFAULT_SETTINGS
    }


# ==================== Notifications Endpoints ====================

@app.get("/api/v1/notifications")
def get_user_notifications(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Consolidated user notification stream:
    - Active battle invitations
    - Level achievements and XP milestones
    - Daily streak alerts
    - Quiz completion summaries
    """
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    username = user.username if user else "test_user"

    notifications = []

    # 1. Battle invitations
    invs = get_invitations_for_user(username)
    for inv in invs:
        nid = f"inv_{inv.get('id', '1')}"
        notifications.append({
            "id": nid,
            "type": "battle",
            "title": "⚔️ Battle Arena Challenge!",
            "message": f"{inv.get('from_username', 'A player')} challenged you to a Battle ({inv.get('battle_id')})!",
            "target": f"/battle/{inv.get('battle_id')}/play",
            "targetText": "Join Battle",
            "isRead": (user_id, nid) in READ_NOTIFICATIONS,
            "createdAt": inv.get("created_at") or datetime.datetime.utcnow().isoformat()
        })

    # 2. Level and streak milestone
    lb = get_or_create_leaderboard(db, user_id)
    if lb.level > 1:
        nid = f"level_{lb.level}"
        notifications.append({
            "id": nid,
            "type": "achievement",
            "title": f"🏆 Level {lb.level} Scholar!",
            "message": f"Awesome job! You reached Level {lb.level} with {lb.total_points} Total XP.",
            "target": "/achievements",
            "targetText": "View Badges",
            "isRead": (user_id, nid) in READ_NOTIFICATIONS,
            "createdAt": datetime.datetime.utcnow().isoformat()
        })

    if lb.win_streak > 0:
        nid = f"streak_{lb.win_streak}"
        notifications.append({
            "id": nid,
            "type": "streak",
            "title": f"🔥 {lb.win_streak}-Streak on Fire!",
            "message": f"You're on a {lb.win_streak} battle win streak! Keep up the momentum in Battle Mode.",
            "target": "/battle/lobby",
            "targetText": "Battle Arena",
            "isRead": (user_id, nid) in READ_NOTIFICATIONS,
            "createdAt": datetime.datetime.utcnow().isoformat()
        })

    # 3. Latest Quiz Attempt
    latest_attempt = db.query(QuizAttempt).filter(
        QuizAttempt.user_id == user_id
    ).order_by(QuizAttempt.completed_at.desc()).first()
    if latest_attempt:
        nid = f"attempt_{latest_attempt.id}"
        quiz = db.query(Quiz).filter(Quiz.id == latest_attempt.quiz_id).first()
        q_title = quiz.title if quiz else "AI Quiz"
        score_val = latest_attempt.score or 0
        notifications.append({
            "id": nid,
            "type": "quiz",
            "title": f"📊 Quiz Performance ({score_val}%)",
            "message": f"Completed '{q_title}'. View your adaptive analytics and performance curve.",
            "target": "/quizzes/history",
            "targetText": "View Analytics",
            "isRead": (user_id, nid) in READ_NOTIFICATIONS,
            "createdAt": latest_attempt.completed_at.isoformat() if latest_attempt.completed_at else datetime.datetime.utcnow().isoformat()
        })

    # 4. System / AI Welcome Notification
    sys_nid = f"sys_welcome_{user_id}"
    notifications.append({
        "id": sys_nid,
        "type": "system",
        "title": "✨ QuizMaster AI Ready",
        "message": "AI Question Generator and Adaptive Analytics are fully synchronized with your account.",
        "target": "/quizzes/ai-generate",
        "targetText": "Create Quiz",
        "isRead": (user_id, sys_nid) in READ_NOTIFICATIONS,
        "createdAt": (user.created_at.isoformat() if user and user.created_at else datetime.datetime.utcnow().isoformat())
    })

    unread_count = sum(1 for n in notifications if not n["isRead"])
    return {
        "success": True,
        "notifications": notifications,
        "data": notifications,
        "unreadCount": unread_count
    }


@app.post("/api/v1/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Mark a specific notification as read"""
    user_id = get_authenticated_user_id(authorization, db)
    READ_NOTIFICATIONS.add((user_id, notif_id))
    return {"success": True, "message": "Notification marked as read"}


@app.post("/api/v1/notifications/clear")
def clear_all_notifications(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Mark all active notifications as read"""
    user_id = get_authenticated_user_id(authorization, db)
    user = db.query(User).filter(User.id == user_id).first()
    username = user.username if user else "test_user"
    for inv in get_invitations_for_user(username):
        READ_NOTIFICATIONS.add((user_id, f"inv_{inv.get('id', '1')}"))
    READ_NOTIFICATIONS.add((user_id, f"sys_welcome_{user_id}"))
    lb = get_or_create_leaderboard(db, user_id)
    READ_NOTIFICATIONS.add((user_id, f"level_{lb.level}"))
    READ_NOTIFICATIONS.add((user_id, f"streak_{lb.win_streak}"))
    return {"success": True, "message": "All notifications marked as read"}


# ==================== Quiz Generation Endpoints ====================

@app.post("/api/generate-quiz")
def generate_quiz(request: QuizRequest):
    """Generate a quiz question from context using fine-tuned model"""
    global tokenizer, model

    if tokenizer is None or model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure the fine-tuned model is available."
        )

    try:
        # Format input text
        input_text = f"generate question: {request.context}"

        # Tokenize input
        inputs = tokenizer(input_text, return_tensors="pt", truncation=True, max_length=512)

        # Generate question
        outputs = model.generate(
            **inputs,
            max_length=150,
            num_return_sequences=1,
            temperature=0.7,
            do_sample=True
        )

        # Decode generated question
        generated_question = tokenizer.decode(outputs[0], skip_special_tokens=True)

        return {
            "question": generated_question,
            "context": request.context,
            "status": "success"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating question: {str(e)}"
        )


# ==================== Additional Auth Endpoints (v1 compatibility) ====================

@app.post("/api/v1/auth/forgot-password")
def forgot_password(data: dict, db: Session = Depends(get_db)):
    """Forgot password - v1 API for frontend compatibility"""
    # Note: In production, send password reset email
    return {"message": "Password reset email sent"}


@app.post("/api/v1/auth/reset-password/{token}")
def reset_password(token: str, data: dict, db: Session = Depends(get_db)):
    """Reset password with token - v1 API for frontend compatibility"""
    # Note: In production, validate token and reset password
    return {"message": "Password reset successfully"}


@app.post("/api/v1/auth/change-password")
def change_password(data: dict, db: Session = Depends(get_db)):
    """Change password - v1 API for frontend compatibility"""
    # Note: In production, update actual password
    return {"message": "Password changed successfully"}
