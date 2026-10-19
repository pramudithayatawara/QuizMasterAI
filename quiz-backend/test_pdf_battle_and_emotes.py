import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import SessionLocal
from models import User, PDF, PDFChunk, Battle
from battle_leaderboard_service import get_or_create_leaderboard

client = TestClient(app)

def test_rag_pdf_battle_and_emotes():
    print("=" * 70)
    print("🧪 TESTING RAG PDF BATTLE CREATION & LIVE EMOTES")
    print("=" * 70)

    db = SessionLocal()

    # 1. Ensure test user & test PDF exist
    u = db.query(User).filter(User.username == "verify_player1").first()
    assert u is not None

    test_pdf = db.query(PDF).filter(PDF.user_id == u.id).first()
    if not test_pdf:
        sample_text = (
            "Supervised learning involves training a model on labeled data where input-output pairs are provided. "
            "Unsupervised learning discovers hidden patterns from unlabeled inputs without supervision. "
            "Reinforcement learning trains agents through trial, error, reward, and penalty signals to maximize cumulative payoff."
        )
        test_pdf = PDF(
            name="Machine_Learning_Lecture_Notes.pdf",
            original_name="Machine Learning Lecture Notes",
            file_path="/dummy/Machine_Learning_Lecture_Notes.pdf",
            file_size=1024,
            status="completed",
            chunk_count=1,
            user_id=u.id
        )
        db.add(test_pdf)
        db.commit()
        db.refresh(test_pdf)

        # Add chunk
        chunk = PDFChunk(
            pdf_id=test_pdf.id,
            chunk_index=0,
            content=sample_text
        )
        db.add(chunk)
        db.commit()

    token = f"Bearer token_{u.id}_{u.username}"
    pdf_title = getattr(test_pdf, "original_name", None) or getattr(test_pdf, "name", "Lecture Notes")

    # 2. Create Battle with PDF ID (RAG Battle)
    print("\n[STEP 1] Creating Battle Session using Uploaded PDF (RAG)...")
    res = client.post(
        "/api/v1/battle/create",
        json={
            "title": f"RAG Battle: {pdf_title}",
            "subject": pdf_title,
            "difficulty": "medium",
            "total_questions": 10,
            "pdf_id": test_pdf.id
        },
        headers={"Authorization": token}
    )
    assert res.status_code == 200, f"Create battle failed: {res.text}"
    battle_data = res.json()["data"]
    battle_code = battle_data["battleId"]
    questions = battle_data["questions"]

    assert len(questions) >= 10, f"Expected at least 10 questions, got {len(questions)}"
    print(f"  ✓ Battle successfully created with Code: {battle_code}")
    print(f"  ✓ Questions synthesized from PDF: {len(questions)} questions")
    print(f"  ✓ Sample Question: {questions[0]['question']}")

    # 3. Test Sending Live Emote
    print("\n[STEP 2] Testing Live Emote Reaction (POST /api/v1/battle/{id}/emote)...")
    res_emote = client.post(
        f"/api/v1/battle/{battle_code}/emote",
        json={"emote": "🔥"},
        headers={"Authorization": token}
    )
    assert res_emote.status_code == 200
    assert res_emote.json()["emote"] == "🔥"
    print(f"  ✓ Emote '🔥' sent successfully!")

    # 4. Test Live State Polling reflecting the emote & question answered indices
    print("\n[STEP 3] Testing Live State Polling with Emote & Answered Indices...")
    res_live = client.get(
        f"/api/v1/battle/{battle_code}/live-state",
        headers={"Authorization": token}
    )
    assert res_live.status_code == 200
    live_state = res_live.json()
    assert live_state["latest_emote"] is not None
    assert live_state["latest_emote"]["emote"] == "🔥"
    assert "answeredIndices" in live_state["my_state"]
    print(f"  ✓ Live state reflects latest emote: {live_state['latest_emote']['emote']} from {live_state['latest_emote']['userName']}")
    print(f"  ✓ Live state includes answered indices: {live_state['my_state']['answeredIndices']}")

    print("\n" + "=" * 70)
    print("🎯 RAG PDF BATTLE & EMOTES VERIFIED 100% SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    test_rag_pdf_battle_and_emotes()
