import math
import uuid
import random
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
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
    """Calculates user level dynamically based on earned XP points (1000 XP per level)."""
    return max(1, (total_points // 1000) + 1)


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

    # 1. Calculate points/XP
    # 50 points per correct answer + 20 points completion bonus
    earned_points = (score * 50) + 20
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

    for p in participants:
        lb = get_or_create_leaderboard(db, p.user_id)
        lb.battles_played += 1

        is_winner = (p.user_id == winner_id)
        if is_winner:
            lb.battles_won += 1
            lb.win_streak += 1
            # Winner bonus: 250 XP + battle score points
            lb.total_points += 250 + (p.score * 20)
        else:
            lb.win_streak = 0
            # Participation bonus: 60 XP + battle score points
            lb.total_points += 60 + (p.score * 10)

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


# ─── Active Invitations Registry ──────────────────────────────────────────────
ACTIVE_INVITATIONS = []


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
                "correctOption": "A"
            }
            for i in range(1, count + 1)
        ]


def create_battle(
    db: Session,
    creator_id: int,
    title: str = "Live Quiz Battle",
    subject: str = "General",
    difficulty: str = "medium",
    quiz_id: Optional[int] = None,
    max_players: int = 4,
    total_questions: int = 10
) -> Battle:
    """
    Creates a new Battle session entity identified by a unique Battle_ID.
    - Minimum 10 questions.
    - Base time: 15s per question.
    - For each question added beyond 10, adds 3s: time_per_question = 15 + (count - 10) * 3
    - Pre-loads authentic questions from dataset.
    """
    battle_code = generate_battle_id()
    count = max(10, total_questions)
    time_per_question = 15 + max(0, (count - 10) * 3)

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
    """
    host_user = db.query(User).filter(User.id == host_user_id).first()
    host_name = host_user.username if host_user else "QuizMaster Player"

    invitation = {
        "id": f"inv_{uuid.uuid4().hex[:6]}",
        "battle_id": battle_id_code,
        "from_user_id": host_user_id,
        "from_username": host_name,
        "to_username": friend_identifier.strip(),
        "created_at": datetime.datetime.utcnow().isoformat(),
        "status": "pending"
    }
    ACTIVE_INVITATIONS.append(invitation)
    return {
        "success": True,
        "message": f"Invitation successfully sent to {friend_identifier}",
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
        return {"success": False, "message": "Battle session not found"}

    if battle.status != "waiting":
        return {"success": False, "message": f"Cannot join battle. Current status is '{battle.status}'"}

    # Check if already joined
    existing = db.query(BattleParticipant).filter(
        BattleParticipant.battle_id == battle.id,
        BattleParticipant.user_id == user_id
    ).first()

    if existing:
        return {"success": True, "message": "Already in this battle session", "battle": battle}

    current_count = db.query(BattleParticipant).filter(BattleParticipant.battle_id == battle.id).count()
    if current_count >= battle.max_players:
        return {"success": False, "message": "Battle session is full"}

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


def complete_battle(
    db: Session,
    battle_id: int
) -> Dict[str, Any]:
    """
    Concludes the Battle session, computes scores, sets Winner_ID,
    and updates the consolidated Leaderboard entity.
    """
    battle = db.query(Battle).filter(Battle.id == battle_id).first()
    if not battle:
        return {"success": False, "message": "Battle not found"}

    participants = db.query(BattleParticipant).filter(BattleParticipant.battle_id == battle.id).all()
    if not participants:
        battle.status = "completed"
        battle.completed_at = datetime.datetime.utcnow()
        db.commit()
        return {"success": True, "battle": battle, "winner_id": None}

    # Determine highest scoring participant as the Winner
    sorted_participants = sorted(participants, key=lambda p: p.score, reverse=True)
    winner_participant = sorted_participants[0]

    battle.winner_id = winner_participant.user_id
    battle.status = "completed"
    battle.completed_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(battle)

    # Trigger Results -> Leaderboard Update
    update_leaderboard_from_battle_result(db, battle)

    # Format winner details
    winner_user = db.query(User).filter(User.id == battle.winner_id).first()
    winner_name = winner_user.username if winner_user else "Unknown"

    return {
        "success": True,
        "message": f"Battle completed! Winner is {winner_name}",
        "battle_id": battle.battle_id,
        "winner_id": battle.winner_id,
        "winner_name": winner_name,
        "participants_count": len(participants),
        "scores": [
            {
                "user_id": p.user_id,
                "score": p.score,
                "is_winner": (p.user_id == battle.winner_id)
            }
            for p in sorted_participants
        ]
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
