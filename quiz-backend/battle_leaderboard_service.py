import os
import math
import uuid
import random
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from models import User, Quiz, Question, QuizAttempt, Battle, BattleParticipant, Leaderboard

# ─── System Standard Badges Catalog ──────────────────────────────────────────
BADGES_CATALOG = [
    {
        "id": "badge_first_step",
        "name": "First Step",
        "description": "Completed your first quiz successfully",
        "icon": "🎯",
        "category": "quiz",
        "requirement": "Complete 1 quiz"
    },
    {
        "id": "badge_quiz_scholar",
        "name": "Quiz Scholar",
        "description": "Completed 5 quizzes on the platform",
        "icon": "📚",
        "category": "quiz",
        "requirement": "Complete 5 quizzes"
    },
    {
        "id": "badge_quiz_master",
        "name": "Quiz Master",
        "description": "Completed 10 or more quizzes with high accuracy",
        "icon": "🎓",
        "category": "quiz",
        "requirement": "Complete 10 quizzes"
    },
    {
        "id": "badge_perfect_100",
        "name": "Perfectionist",
        "description": "Scored 100% on any quiz",
        "icon": "💯",
        "category": "performance",
        "requirement": "Score 100% in a quiz"
    },
    {
        "id": "badge_speed_demon",
        "name": "Speed Demon",
        "description": "Completed a quiz in record time",
        "icon": "⚡",
        "category": "speed",
        "requirement": "Complete a quiz under 60 seconds"
    },
    {
        "id": "badge_first_battle",
        "name": "Gladiator",
        "description": "Joined and participated in your first live battle session",
        "icon": "⚔️",
        "category": "battle",
        "requirement": "Join 1 battle"
    },
    {
        "id": "badge_battle_victor",
        "name": "Battle Victor",
        "description": "Won your first competitive battle session",
        "icon": "🏆",
        "category": "battle",
        "requirement": "Win 1 battle"
    },
    {
        "id": "badge_win_streak",
        "name": "On Fire",
        "description": "Maintained a win streak of 3 consecutive battles",
        "icon": "🔥",
        "category": "battle",
        "requirement": "Achieve 3 battle win streak"
    },
    {
        "id": "badge_conqueror",
        "name": "Grand Champion",
        "description": "Won 5 or more multiplayer battles",
        "icon": "👑",
        "category": "battle",
        "requirement": "Win 5 battles"
    }
]


def calculate_level(total_points: int) -> int:
    """
    Calculates user level dynamically using a progressive XP scaling curve.
    Levels start smoothly and progressively require more XP as rank rises.
    Prevents unrealistic giant level jumps.
    """
    if total_points <= 0:
        return 1

    # Progressive XP thresholds:
    # L1: 0, L2: 500, L3: 1200, L4: 2200, L5: 3500, L6: 5200, L7: 7200,
    # L8: 9600, L9: 12500, L10: 16000, L11: 20000, L12: 25000, L13: 31000...
    thresholds = [
        0, 500, 1200, 2200, 3500, 5200, 7200, 9600, 12500, 16000,
        20000, 25000, 31000, 38000, 46000, 55000, 65000, 76000, 88000, 101000
    ]

    for lvl, th in enumerate(thresholds, start=1):
        if total_points < th:
            return max(1, lvl - 1)

    extra_points = total_points - thresholds[-1]
    extra_levels = extra_points // 15000
    return min(100, 20 + extra_levels)


def get_or_create_leaderboard(db: Session, user_id: int) -> Leaderboard:
    """Fetches or initializes the consolidated Leaderboard record for a user."""
    entry = db.query(Leaderboard).filter(Leaderboard.user_id == user_id).first()
    if not entry:
        entry = Leaderboard(
            user_id=user_id,
            total_points=0,
            quizzes_completed=0,
            battles_played=0,
            battles_won=0,
            win_streak=0,
            rank=1,
            level=1,
            badges=[]
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
    return entry


def recalculate_all_ranks(db: Session):
    """
    Recalculates the consolidated rank for every user on the leaderboard
    based on descending total_points.
    """
    all_entries = db.query(Leaderboard).order_by(desc(Leaderboard.total_points)).all()
    for idx, entry in enumerate(all_entries, 1):
        entry.rank = idx
    db.commit()


# ─── Results Entity -> Leaderboard Updater ────────────────────────────────────

def update_leaderboard_from_quiz_result(
    db: Session,
    user_id: int,
    score: int,
    total_questions: int,
    time_spent: Optional[int] = None
) -> Leaderboard:
    """
    Consolidated trigger: Called by the Results entity when a QuizAttempt is saved.
    Updates points, level, unlocks badges, and recalibrates ranks.
    """
    leaderboard = get_or_create_leaderboard(db, user_id)

    # 1. Calculate points/XP in a balanced, realistic range (30 - 150 XP per quiz)
    earned_points = min(150, max(25, int(score * 1.2) + 25))
    leaderboard.total_points += earned_points
    leaderboard.quizzes_completed += 1
    leaderboard.level = calculate_level(leaderboard.total_points)

    # 2. Check and unlock badges
    existing_badge_ids = {b.get("id") for b in leaderboard.badges if isinstance(b, dict)}
    updated_badges = list(leaderboard.badges)

    def award_badge(badge_id: str):
        if badge_id not in existing_badge_ids:
            badge_meta = next((b for b in BADGES_CATALOG if b["id"] == badge_id), None)
            if badge_meta:
                unlocked_badge = {
                    **badge_meta,
                    "unlocked": True,
                    "unlocked_at": datetime.datetime.utcnow().isoformat()
                }
                updated_badges.append(unlocked_badge)
                existing_badge_ids.add(badge_id)

    # Badge rules
    if leaderboard.quizzes_completed >= 1:
        award_badge("badge_first_step")
    if leaderboard.quizzes_completed >= 5:
        award_badge("badge_quiz_scholar")
    if leaderboard.quizzes_completed >= 10:
        award_badge("badge_quiz_master")
    if total_questions > 0 and score == total_questions:
        award_badge("badge_perfect_100")
    if time_spent and time_spent <= 60 and score > 0:
        award_badge("badge_speed_demon")

    leaderboard.badges = updated_badges
    leaderboard.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(leaderboard)

    # Recalculate ranks across the system
    recalculate_all_ranks(db)
    return leaderboard


def update_leaderboard_from_battle_result(
    db: Session,
    battle: Battle
) -> None:
    """
    Consolidated trigger: Called by the Results entity when a Battle session completes.
    Awards bonus points, tracks battles won/played, win streak, and awards battle badges.
    """
    participants = db.query(BattleParticipant).filter(BattleParticipant.battle_id == battle.id).all()
    winner_id = battle.winner_id
    is_draw = (winner_id is None and len(participants) > 1)

    for p in participants:
        lb = get_or_create_leaderboard(db, p.user_id)
        lb.battles_played += 1

        if is_draw:
            # Draw / Tie condition: Both receive equal draw points and preserve win streak
            lb.total_points += 60 + (p.score * 5)
        elif p.user_id == winner_id:
            lb.battles_won += 1
            lb.win_streak += 1
            # Winner bonus: 100 XP + battle score points
            lb.total_points += 100 + (p.score * 8)
        else:
            lb.win_streak = 0
            # Participation bonus: 35 XP + battle score points
            lb.total_points += 35 + (p.score * 4)

        lb.level = calculate_level(lb.total_points)

        # Check battle badges
        existing_badge_ids = {b.get("id") for b in lb.badges if isinstance(b, dict)}
        updated_badges = list(lb.badges)

        def award_badge(badge_id: str):
            if badge_id not in existing_badge_ids:
                badge_meta = next((b for b in BADGES_CATALOG if b["id"] == badge_id), None)
                if badge_meta:
                    unlocked_badge = {
                        **badge_meta,
                        "unlocked": True,
                        "unlocked_at": datetime.datetime.utcnow().isoformat()
                    }
                    updated_badges.append(unlocked_badge)
                    existing_badge_ids.add(badge_id)

        if lb.battles_played >= 1:
            award_badge("badge_first_battle")
        if lb.battles_won >= 1:
            award_badge("badge_battle_victor")
        if lb.win_streak >= 3:
            award_badge("badge_win_streak")
        if lb.battles_won >= 5:
            award_badge("badge_conqueror")

        lb.badges = updated_badges
        lb.updated_at = datetime.datetime.utcnow()
        db.commit()

    recalculate_all_ranks(db)


# ─── Battle Mode Operations ──────────────────────────────────────────────────

def generate_battle_id() -> str:
    """Generates a human-friendly unique Battle_ID e.g. BTL-8F29"""
    code = uuid.uuid4().hex[:6].upper()
    return f"BTL-{code}"


# ─── Active Invitations Registry with Disk Persistence ─────────────────────────
import json

INVITATIONS_FILE = os.path.join(os.path.dirname(__file__), "active_invitations.json")


def load_persisted_invitations() -> List[Dict[str, Any]]:
    if os.path.exists(INVITATIONS_FILE):
        try:
            with open(INVITATIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_persisted_invitations(invitations: List[Dict[str, Any]]):
    try:
        with open(INVITATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(invitations, f, indent=2)
    except Exception as e:
        print(f"Failed to persist invitations: {e}")


ACTIVE_INVITATIONS = load_persisted_invitations()


def load_battle_questions(
    subject: str = "General",
    difficulty: str = "medium",
    count: int = 10
) -> List[Dict[str, Any]]:
    """
    Loads curated questions from the 3,300 benchmark dataset.
    Guarantees at least 10 questions conditioned on subject and difficulty.
    """
    import csv
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, "quiz_dataset_3000.csv")
    if not os.path.exists(csv_path):
        csv_path = "/Users/user/Desktop/RUSL_reserch/QuizMasterAI/quiz_dataset_3000.csv"
    count = max(10, count)

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = list(csv.DictReader(f))

        # Filter by subject & difficulty
        matches = [
            r for r in reader
            if (subject.lower() in r["subject"].lower() or subject.lower() == "general" or "random" in subject.lower())
            and r["difficulty_level"].lower() == difficulty.lower()
        ]
        if len(matches) < count:
            matches = [r for r in reader if r["difficulty_level"].lower() == difficulty.lower()]
        if len(matches) < count:
            matches = reader

        selected = random.sample(matches, min(count, len(matches)))
        formatted = []
        for idx, row in enumerate(selected, 1):
            correct_key = row["correct_answer"].strip().upper()
            correct_text = row.get(f"answer_{correct_key}", "")
            formatted.append({
                "_id": f"q_{idx}",
                "question": row["question"],
                "type": "mcq",
                "options": [row["answer_A"], row["answer_B"], row["answer_C"], row["answer_D"]],
                "correctAnswer": correct_text,
                "correctOption": correct_key
            })
        return formatted
    except Exception as e:
        print(f"Fallback question generator: {e}")
        return [
            {
                "_id": f"q_{i}",
                "question": f"{subject} Challenge Question #{i}: What is the primary characteristic of this concept?",
                "type": "mcq",
                "options": ["Standard Definition", "Alternative Variant", "Theoretical Framework", "Practical Application"],
                "correctAnswer": "Standard Definition",
                "correctOption": "A",
                "explanation": f"Core foundation of {subject} concepts."
            }
            for i in range(1, count + 1)
        ]


def load_battle_questions_from_pdf(
    db: Session,
    pdf_id: int,
    count: int = 10,
    difficulty: str = "medium"
) -> List[Dict[str, Any]]:
    """
    RAG Battle Integration: Extracts content chunks from the selected uploaded PDF
    and synthesizes high-quality MCQ battle questions for both players.
    """
    count = max(10, count)
    from models import PDF, PDFChunk

    pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
    if not pdf:
        return load_battle_questions("General", difficulty, count)

    chunks_db = db.query(PDFChunk).filter(PDFChunk.pdf_id == pdf_id).order_by(PDFChunk.chunk_index.asc()).all()
    chunk_texts = [
        (getattr(c, "content", None) or getattr(c, "chunk_text", "") or "").strip()
        for c in chunks_db
    ]
    chunk_texts = [t for t in chunk_texts if len(t) > 20]

    pdf_name = getattr(pdf, "original_name", None) or getattr(pdf, "name", "Lecture Document")

    if not chunk_texts:
        return load_battle_questions(pdf_name, difficulty, count)

    try:
        from mcq_generator import MCQGenerator, MCQGenerationRequest, DifficultyLevel
        gen = MCQGenerator()
        diff_enum = DifficultyLevel.MEDIUM
        if difficulty.lower() == "easy":
            diff_enum = DifficultyLevel.EASY
        elif difficulty.lower() == "hard":
            diff_enum = DifficultyLevel.HARD

        req = MCQGenerationRequest(
            content_chunks=chunk_texts,
            num_questions=min(count, 20),
            difficulty=diff_enum,
            topic=pdf_name
        )
        res = gen.generate_mcqs_from_chunks(req)
        formatted = []
        for idx, q in enumerate(res.questions, 1):
            q_text = getattr(q, "question_text", None) or getattr(q, "question", "")
            raw_opts = getattr(q, "options", [])
            opt_strings = []
            correct_opt = "A"
            for o_idx, opt in enumerate(raw_opts):
                opt_str = opt.option_text if hasattr(opt, "option_text") else str(opt)
                opt_strings.append(opt_str)
                if hasattr(opt, "is_correct") and opt.is_correct:
                    correct_opt = chr(65 + o_idx)

            formatted.append({
                "_id": f"q_pdf_{idx}",
                "question": q_text,
                "type": "mcq",
                "options": opt_strings,
                "correctAnswer": getattr(q, "correct_answer", ""),
                "correctOption": correct_opt,
                "explanation": getattr(q, "explanation", "") or f"Extracted from PDF: {pdf_name}"
            })
        if len(formatted) >= count:
            return formatted[:count]
        extra = load_battle_questions(pdf_name, difficulty, count - len(formatted))
        return formatted + extra
    except Exception as e:
        print(f"MCQ Generator on PDF: {e}, using direct chunk synthesis")
        formatted = []
        for idx, text in enumerate(chunk_texts[:count], 1):
            sentences = [s.strip() for s in text.replace("\n", " ").split(".") if len(s.strip()) > 25]
            lead_sentence = sentences[0] if sentences else text[:80]
            words = [w for w in lead_sentence.split() if len(w) > 3]
            key_term = words[min(2, len(words)-1)] if words else "Concept"
            
            formatted.append({
                "_id": f"q_pdf_{idx}",
                "question": f"Based on '{pdf_name}': \"{lead_sentence[:100]}...\" — Which of the following is correct?",
                "type": "mcq",
                "options": [
                    f"Directly verifies {key_term} principles",
                    f"Contradicts standard {key_term} theory",
                    f"Exclusively applies to external systems",
                    f"Irrelevant to {key_term} architecture"
                ],
                "correctAnswer": f"Directly verifies {key_term} principles",
                "correctOption": "A",
                "explanation": f"Quoted from document '{pdf_name}': {lead_sentence[:120]}"
            })
        if len(formatted) < count:
            extra = load_battle_questions("General", difficulty, count - len(formatted))
            formatted.extend(extra)
        return formatted[:count]


def create_battle(
    db: Session,
    creator_id: int,
    title: str = "Live Quiz Battle",
    subject: str = "General",
    difficulty: str = "medium",
    quiz_id: Optional[int] = None,
    pdf_id: Optional[int] = None,
    max_players: int = 4,
    total_questions: int = 10
) -> Battle:
    """
    Creates a new Battle session entity identified by a unique Battle_ID.
    - If pdf_id is specified: loads questions synthesized from the uploaded PDF document (RAG).
    - Otherwise loads from benchmark dataset.
    - Minimum 10 questions.
    - Base time: 15s per question (+3s for each question beyond 10).
    """
    battle_code = generate_battle_id()
    count = max(10, total_questions)
    time_per_question = 15 + max(0, (count - 10) * 3)

    if pdf_id:
        questions = load_battle_questions_from_pdf(db, pdf_id, count, difficulty)
    else:
        questions = load_battle_questions(subject, difficulty, count)

    new_battle = Battle(
        battle_id=battle_code,
        title=title,
        subject=subject,
        difficulty=difficulty,
        quiz_id=quiz_id,
        creator_id=creator_id,
        winner_id=None,
        status="waiting",
        max_players=max_players,
        time_per_question=time_per_question,
        total_rounds=count,
        questions_data=questions
    )
    db.add(new_battle)
    db.commit()
    db.refresh(new_battle)

    # Add creator as first participant
    creator_participant = BattleParticipant(
        battle_id=new_battle.id,
        user_id=creator_id,
        score=0,
        answers={},
        is_ready=True
    )
    db.add(creator_participant)
    db.commit()
    db.refresh(new_battle)

    return new_battle


def send_battle_invitation(
    db: Session,
    host_user_id: int,
    battle_id_code: str,
    friend_identifier: str
) -> Dict[str, Any]:
    """
    Registers an invitation sent to a friend so they receive a notification/message.
    Strictly validates that the recipient is an existing registered user and not the sender.
    """
    cleaned = (friend_identifier or "").strip().lower()
    if not cleaned:
        return {"success": False, "message": "Please enter or select a valid username"}

    # Find recipient user by username or email
    target_user = db.query(User).filter(
        (func.lower(User.username) == cleaned) | (func.lower(User.email) == cleaned)
    ).first()

    if not target_user:
        return {
            "success": False,
            "message": f"User '{friend_identifier}' was not found. Please choose a valid registered user."
        }

    if target_user.id == host_user_id:
        return {
            "success": False,
            "message": "You cannot send a battle challenge invitation to yourself."
        }

    host_user = db.query(User).filter(User.id == host_user_id).first()
    host_name = host_user.username if host_user else "QuizMaster Player"

    invitation = {
        "id": f"inv_{uuid.uuid4().hex[:6]}",
        "battle_id": battle_id_code,
        "from_user_id": host_user_id,
        "from_username": host_name,
        "to_user_id": target_user.id,
        "to_username": target_user.username,
        "created_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": "pending"
    }
    ACTIVE_INVITATIONS.append(invitation)
    save_persisted_invitations(ACTIVE_INVITATIONS)
    return {
        "success": True,
        "message": f"Invitation successfully sent to @{target_user.username}",
        "invitation": invitation
    }


def get_invitations_for_user(username: str) -> List[Dict[str, Any]]:
    """Fetches any pending battle invitations sent to this user."""
    return [
        inv for inv in ACTIVE_INVITATIONS
        if inv["to_username"].lower() == username.lower() or inv["to_username"].lower() == "all"
    ]


def join_battle(
    db: Session,
    battle_code_or_id: str,
    user_id: int
) -> Dict[str, Any]:
    """
    Facilitates multiple users to 'Join' a battle session by Battle_ID or integer ID.
    """
    # Lookup by battle_id string or integer primary key
    battle = db.query(Battle).filter(
        (Battle.battle_id == battle_code_or_id) | (Battle.id == (int(battle_code_or_id) if battle_code_or_id.isdigit() else -1))
    ).first()

    if not battle:
        return {"success": False, "message": "Battle session not found", "error_type": "not_found"}

    if battle.status != "waiting":
        return {"success": False, "message": f"Cannot join battle. Current status is '{battle.status}'", "error_type": "not_waiting"}

    # Check if already joined
    existing = db.query(BattleParticipant).filter(
        BattleParticipant.battle_id == battle.id,
        BattleParticipant.user_id == user_id
    ).first()

    if existing:
        return {"success": True, "message": "Already in this battle session", "battle": battle, "already_joined": True}

    current_count = db.query(BattleParticipant).filter(BattleParticipant.battle_id == battle.id).count()
    if current_count >= battle.max_players:
        return {"success": False, "message": "Battle session is full", "error_type": "full"}

    # Join session
    participant = BattleParticipant(
        battle_id=battle.id,
        user_id=user_id,
        score=0,
        answers={},
        is_ready=True
    )
    db.add(participant)
    db.commit()
    db.refresh(battle)

    return {
        "success": True,
        "message": "Successfully joined the battle session",
        "battle_id": battle.battle_id,
        "battle": battle
    }


# ─── Live Emotes Registry ───────────────────────────────────────────────────
BATTLE_EMOTES: Dict[str, Dict[str, Any]] = {}


def send_battle_emote(
    battle_id: str,
    user_id: int,
    username: str,
    emote: str
) -> Dict[str, Any]:
    """
    Registers a live visual reaction/emote for real-time multiplayer feedback.
    """
    import time
    BATTLE_EMOTES[battle_id] = {
        "userId": user_id,
        "userName": username,
        "emote": emote,
        "timestamp": time.time()
    }
    return {"success": True, "emote": emote, "battle_id": battle_id}


def build_detailed_review(db: Session, battle: Battle, participants: List[BattleParticipant]) -> List[Dict[str, Any]]:
    """Generates an academic question-by-question comparative breakdown for post-match review."""
    questions = battle.questions_data or []
    p_map = {p.user_id: (p.answers or {}) for p in participants}
    p_names = {}
    for p in participants:
        u = db.query(User).filter(User.id == p.user_id).first()
        p_names[p.user_id] = u.username if u else f"User {p.user_id}"

    detailed_review = []
    for idx, q in enumerate(questions):
        correct_ans = q.get("correctAnswer") or q.get("correctOption")
        item = {
            "index": idx + 1,
            "question": q.get("question", f"Question {idx+1}"),
            "options": q.get("options", []),
            "correctAnswer": correct_ans,
            "explanation": q.get("explanation") or "Standard curriculum concept.",
            "playerAnswers": {
                str(u_id): {
                    "userName": p_names.get(u_id, "Player"),
                    "answer": p_answers.get(str(idx)),
                    "isCorrect": str(p_answers.get(str(idx))).strip().lower() == str(correct_ans).strip().lower()
                }
                for u_id, p_answers in p_map.items()
            }
        }
        detailed_review.append(item)
    return detailed_review


def complete_battle(
    db: Session,
    battle_id: int
) -> Dict[str, Any]:
    """
    Concludes the Battle session, computes scores, sets Winner_ID,
    and updates the consolidated Leaderboard entity.
    Guarantees idempotency (prevents race condition / duplicate reward increments).
    Includes detailed question-by-question head-to-head review.
    """
    battle = db.query(Battle).filter(Battle.id == battle_id).first()
    if not battle:
        return {"success": False, "message": "Battle not found"}

    participants = db.query(BattleParticipant).filter(BattleParticipant.battle_id == battle.id).all()
    review = build_detailed_review(db, battle, participants)

    # Idempotent guard: if already completed, return existing results safely
    if battle.status == "completed":
        winner_user = db.query(User).filter(User.id == battle.winner_id).first() if battle.winner_id else None
        winner_name = winner_user.username if winner_user else ("Draw" if battle.winner_id is None else "Unknown")
        return {
            "success": True,
            "message": f"Battle concluded. Winner is {winner_name}",
            "battle_id": battle.battle_id,
            "winner_id": battle.winner_id,
            "winner_name": winner_name,
            "is_draw": battle.winner_id is None and len(participants) > 1,
            "participants_count": len(participants),
            "detailed_review": review,
            "scores": [
                {
                    "user_id": p.user_id,
                    "score": p.score,
                    "is_winner": (p.user_id == battle.winner_id and battle.winner_id is not None)
                }
                for p in sorted(participants, key=lambda p: p.score, reverse=True)
            ]
        }

    if not participants:
        battle.status = "completed"
        battle.completed_at = datetime.datetime.utcnow()
        db.commit()
        return {"success": True, "battle": battle, "winner_id": None, "detailed_review": []}

    # Determine highest scoring participant as the Winner or detect a Draw
    sorted_participants = sorted(participants, key=lambda p: p.score, reverse=True)
    is_draw = len(sorted_participants) > 1 and (sorted_participants[0].score == sorted_participants[1].score)

    if is_draw:
        battle.winner_id = None
        winner_name = "Draw"
    else:
        winner_participant = sorted_participants[0]
        battle.winner_id = winner_participant.user_id
        winner_user = db.query(User).filter(User.id == battle.winner_id).first()
        winner_name = winner_user.username if winner_user else "Unknown"

    battle.status = "completed"
    battle.completed_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(battle)

    # Trigger Results -> Leaderboard Update
    update_leaderboard_from_battle_result(db, battle)

    return {
        "success": True,
        "message": f"Battle completed! Winner is {winner_name}",
        "battle_id": battle.battle_id,
        "winner_id": battle.winner_id,
        "winner_name": winner_name,
        "is_draw": is_draw,
        "participants_count": len(participants),
        "detailed_review": review,
        "scores": [
            {
                "user_id": p.user_id,
                "score": p.score,
                "is_winner": (p.user_id == battle.winner_id and battle.winner_id is not None)
            }
            for p in sorted_participants
        ]
    }


def cancel_battle(
    db: Session,
    battle_code_or_id: str,
    user_id: int
) -> Dict[str, Any]:
    """Cancels a waiting battle session if user leaves matchmaking queue."""
    battle = db.query(Battle).filter(
        (Battle.battle_id == battle_code_or_id) | (Battle.id == (int(battle_code_or_id) if battle_code_or_id.isdigit() else -1))
    ).first()
    if not battle:
        return {"success": False, "message": "Battle not found"}

    if battle.creator_id == user_id and battle.status == "waiting":
        battle.status = "cancelled"
        db.commit()
        return {"success": True, "message": "Matchmaking search cancelled"}

    return {"success": False, "message": "Battle cannot be cancelled"}


def quick_match(
    db: Session,
    user_id: int,
    subject: str = "General",
    difficulty: str = "medium"
) -> Dict[str, Any]:
    """
    Intelligent skill-based Matchmaking algorithm:
    1. Searches active waiting battles created in the last 15 minutes.
    2. Sorts candidates by closest player level (|my_level - host_level|), 
       matching difficulty, and queue wait time.
    3. Pairs with the best candidate and automatically transitions status to 'active'
       so both players launch simultaneously into the arena.
    4. If no opponent is currently queued, registers a new waiting queue room.
    """
    my_lb = get_or_create_leaderboard(db, user_id)
    my_level = my_lb.level if my_lb else 1

    fifteen_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=15)
    waiting_battles = db.query(Battle).filter(
        Battle.status == "waiting",
        Battle.creator_id != user_id,
        Battle.created_at >= fifteen_mins_ago
    ).all()

    valid_candidates = []
    for b in waiting_battles:
        p_count = db.query(BattleParticipant).filter(BattleParticipant.battle_id == b.id).count()
        if p_count >= b.max_players:
            continue

        host_lb = db.query(Leaderboard).filter(Leaderboard.user_id == b.creator_id).first()
        host_level = host_lb.level if host_lb else 1
        level_diff = abs(my_level - host_level)

        valid_candidates.append({
            "battle": b,
            "host_level": host_level,
            "level_diff": level_diff,
            "same_difficulty": 0 if b.difficulty == difficulty else 1,
            "same_subject": 0 if b.subject == subject else 1,
            "created_at": b.created_at
        })

    if valid_candidates:
        # Sort: Closest level first, then difficulty match, then oldest queued
        valid_candidates.sort(key=lambda x: (x["level_diff"], x["same_difficulty"], x["same_subject"], x["created_at"]))
        best = valid_candidates[0]
        b = best["battle"]
        host_level = best["host_level"]

        join_res = join_battle(db, b.battle_id, user_id)
        if join_res.get("success"):
            # Mark battle as active so both players auto-launch!
            b.status = "active"
            db.commit()
            db.refresh(b)

            host_user = db.query(User).filter(User.id == b.creator_id).first()
            host_name = host_user.username if host_user else "Opponent"

            return {
                "success": True,
                "matched": True,
                "battle_id": b.battle_id,
                "id": b.id,
                "subject": b.subject,
                "difficulty": b.difficulty,
                "total_questions": b.total_rounds or 10,
                "time_per_question": b.time_per_question or 15,
                "questions": b.questions_data or [],
                "opponent": {
                    "user_id": b.creator_id,
                    "username": host_name,
                    "level": host_level
                },
                "message": f"Matched with {host_name} (Level {host_level})!"
            }

    # Reuse existing fresh waiting room if user was already searching in the last 2 minutes
    two_mins_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=2)
    existing_room = db.query(Battle).filter(
        Battle.status == "waiting",
        Battle.creator_id == user_id,
        Battle.created_at >= two_mins_ago
    ).order_by(Battle.created_at.desc()).first()

    if existing_room:
        return {
            "success": True,
            "matched": False,
            "waiting": True,
            "battle_id": existing_room.battle_id,
            "id": existing_room.id,
            "subject": existing_room.subject,
            "difficulty": existing_room.difficulty,
            "total_questions": existing_room.total_rounds or 10,
            "time_per_question": existing_room.time_per_question or 15,
            "questions": existing_room.questions_data or [],
            "message": f"In matchmaking queue (Level {my_level}). Searching for opponent..."
        }

    # No match currently waiting -> create new matchmaking waiting room
    new_b = create_battle(
        db=db,
        creator_id=user_id,
        title=f"Quick Match Battle",
        subject=subject,
        difficulty=difficulty,
        max_players=2,
        total_questions=10
    )
    return {
        "success": True,
        "matched": False,
        "waiting": True,
        "battle_id": new_b.battle_id,
        "id": new_b.id,
        "subject": new_b.subject,
        "difficulty": new_b.difficulty,
        "total_questions": 10,
        "time_per_question": new_b.time_per_question or 15,
        "questions": new_b.questions_data or [],
        "message": f"In matchmaking queue (Level {my_level}). Searching for opponent..."
    }


def get_battle_live_state(
    db: Session,
    battle_code_or_id: str,
    user_id: int
) -> Dict[str, Any]:
    """
    Ultra-low-latency real-time state payload for 800ms polling loop.
    Returns myState, opponentState, answering status, and live emotes.
    """
    import time
    battle = db.query(Battle).filter(
        (Battle.battle_id == battle_code_or_id) | (Battle.id == (int(battle_code_or_id) if battle_code_or_id.isdigit() else -1))
    ).first()
    if not battle:
        return {"success": False, "message": "Battle not found"}

    participants = db.query(BattleParticipant).filter(BattleParticipant.battle_id == battle.id).all()
    my_p = next((p for p in participants if p.user_id == user_id), None)
    opp_p = next((p for p in participants if p.user_id != user_id), None)

    opp_user = None
    opp_lb = None
    if opp_p:
        opp_user = db.query(User).filter(User.id == opp_p.user_id).first()
        opp_lb = db.query(Leaderboard).filter(Leaderboard.user_id == opp_p.user_id).first()

    my_lb = db.query(Leaderboard).filter(Leaderboard.user_id == user_id).first()
    my_user = db.query(User).filter(User.id == user_id).first()

    # Emote check (last 4 seconds)
    latest_emote = None
    if battle.battle_id in BATTLE_EMOTES:
        e = BATTLE_EMOTES[battle.battle_id]
        if time.time() - e.get("timestamp", 0) < 4.0:
            latest_emote = e

    my_answers = my_p.answers or {} if my_p else {}
    opp_answers = opp_p.answers or {} if opp_p else {}
    total_q = battle.total_rounds or (len(battle.questions_data) if battle.questions_data else 10)

    # Auto-conclude battle if all participants have finished
    all_done = (
        len(participants) >= 1 and all(
            (p.completed_at is not None or len(p.answers or {}) >= total_q)
            for p in participants
        )
    )
    if all_done and battle.status != "completed":
        complete_battle(db, battle.id)
        db.refresh(battle)

    winner_user = db.query(User).filter(User.id == battle.winner_id).first() if battle.winner_id else None
    winner_name = winner_user.username if winner_user else ("Draw" if (battle.status == "completed" and battle.winner_id is None) else None)

    my_finished = (my_p.completed_at is not None or len(my_answers) >= total_q) if my_p else False
    opp_finished = (opp_p.completed_at is not None or len(opp_answers) >= total_q) if opp_p else False

    return {
        "success": True,
        "battle_id": battle.battle_id,
        "id": battle.id,
        "status": battle.status,
        "winner_id": battle.winner_id,
        "winner_name": winner_name,
        "total_questions": total_q,
        "time_per_question": battle.time_per_question,
        "participants_count": len(participants),
        "latest_emote": latest_emote,
        "my_state": {
            "userId": user_id,
            "userName": my_user.username if my_user else "You",
            "level": my_lb.level if my_lb else 1,
            "score": my_p.score if my_p else 0,
            "answersCount": len(my_answers),
            "answeredIndices": [str(k) for k in my_answers.keys()],
            "isReady": my_p.is_ready if my_p else False,
            "isFinished": my_finished
        },
        "opponent_state": {
            "userId": opp_p.user_id if opp_p else None,
            "userName": opp_user.username if opp_user else "Waiting for opponent...",
            "level": opp_lb.level if opp_lb else 1,
            "score": opp_p.score if opp_p else 0,
            "answersCount": len(opp_answers),
            "answeredIndices": [str(k) for k in opp_answers.keys()],
            "isReady": opp_p.is_ready if opp_p else False,
            "hasJoined": opp_p is not None,
            "isFinished": opp_finished
        }
    }


# ─── Gamification & Leaderboard View Helpers ─────────────────────────────────

def get_leaderboard_data(db: Session, limit: int = 100) -> List[Dict[str, Any]]:
    """
    Returns consolidated leaderboard rankings matching frontend format:
    [{_id, userId, userName, rank, level, totalPoints, badgesCount, winStreak}, ...]
    """
    entries = db.query(Leaderboard).order_by(Leaderboard.rank.asc()).limit(limit).all()

    result = []
    for entry in entries:
        user = db.query(User).filter(User.id == entry.user_id).first()
        username = user.username if user else f"User {entry.user_id}"
        badges_list = entry.badges if isinstance(entry.badges, list) else []

        result.append({
            "_id": f"lb-{entry.id}",
            "id": entry.id,
            "userId": entry.user_id,
            "userName": username,
            "name": username,
            "rank": entry.rank,
            "level": entry.level,
            "totalPoints": entry.total_points,
            "totalXP": entry.total_points,
            "badgesCount": len(badges_list),
            "winStreak": entry.win_streak,
            "battlesWon": entry.battles_won,
            "quizzesCompleted": entry.quizzes_completed
        })
    return result


def get_user_profile_data(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Returns the user's personal gamification profile.
    """
    lb = get_or_create_leaderboard(db, user_id)
    user = db.query(User).filter(User.id == user_id).first()
    username = user.username if user else "User"

    badges_list = lb.badges if isinstance(lb.badges, list) else []

    return {
        "user_id": user_id,
        "username": username,
        "totalXP": lb.total_points,
        "points": lb.total_points,
        "level": lb.level,
        "rank": lb.rank,
        "winStreak": lb.win_streak,
        "quizStreak": max(1, lb.quizzes_completed // 2),
        "battlesWon": lb.battles_won,
        "battlesPlayed": lb.battles_played,
        "totalQuizzes": lb.quizzes_completed,
        "badgesCount": len(badges_list)
    }


def get_user_badges_data(db: Session, user_id: int) -> List[Dict[str, Any]]:
    """
    Returns all system badges indicating which ones the user has unlocked.
    """
    lb = get_or_create_leaderboard(db, user_id)
    unlocked_ids = {b.get("id") for b in lb.badges if isinstance(b, dict)}

    result = []
    for badge in BADGES_CATALOG:
        is_unlocked = badge["id"] in unlocked_ids
        result.append({
            **badge,
            "unlocked": is_unlocked
        })
    return result
