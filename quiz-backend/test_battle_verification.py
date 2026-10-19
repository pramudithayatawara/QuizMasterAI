import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from database import get_db, SessionLocal
from models import User, Battle, BattleParticipant, Leaderboard
from battle_leaderboard_service import get_or_create_leaderboard

client = TestClient(app)

def run_tests():
    print("=" * 70)
    print("🚀 RUNNING COMPREHENSIVE MULTIPLAYER BATTLE ENGINE VERIFICATION")
    print("=" * 70)

    db = SessionLocal()

    # 1. Setup Test Users
    # User 1: Host / Player 1 (Level 1)
    # User 2: Player 2 (Level 1)
    # User 3: High Level Player (Level 5)
    u1 = db.query(User).filter(User.username == "verify_player1").first()
    if not u1:
        u1 = User(username="verify_player1", email="verify_player1@quizmaster.com", role="student", hashed_password="dummy")
        db.add(u1)
        db.commit()
        db.refresh(u1)

    u2 = db.query(User).filter(User.username == "verify_player2").first()
    if not u2:
        u2 = User(username="verify_player2", email="verify_player2@quizmaster.com", role="student", hashed_password="dummy")
        db.add(u2)
        db.commit()
        db.refresh(u2)

    u3 = db.query(User).filter(User.username == "verify_player3_pro").first()
    if not u3:
        u3 = User(username="verify_player3_pro", email="verify_player3_pro@quizmaster.com", role="student", hashed_password="dummy")
        db.add(u3)
        db.commit()
        db.refresh(u3)

    # Reset leaderboards for clean verification
    lb1 = get_or_create_leaderboard(db, u1.id)
    lb1.level = 1
    lb1.total_points = 50
    lb1.battles_played = 0
    lb1.battles_won = 0
    lb1.win_streak = 0
    lb1.badges = []

    lb2 = get_or_create_leaderboard(db, u2.id)
    lb2.level = 1
    lb2.total_points = 50
    lb2.battles_played = 0
    lb2.battles_won = 0
    lb2.win_streak = 0
    lb2.badges = []

    lb3 = get_or_create_leaderboard(db, u3.id)
    lb3.level = 5  # High level
    lb3.total_points = 5000
    lb3.battles_played = 0
    lb3.battles_won = 0
    lb3.win_streak = 0
    lb3.badges = []

    # Clean any stale waiting battles from previous sessions
    db.query(Battle).filter(Battle.status == "waiting").update({"status": "completed"})
    db.commit()

    token1 = f"Bearer token_{u1.id}_{u1.username}"
    token2 = f"Bearer token_{u2.id}_{u2.username}"
    token3 = f"Bearer token_{u3.id}_{u3.username}"

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 1: Matchmaking & Level Pairing Tolerance |Level_A - Level_B| <= 1
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 1] Matchmaking & Level Pairing (|Δlvl| <= 1)...")
    
    # User 1 calls quick-match -> No rooms exist, creates a waiting room
    res1 = client.post("/api/v1/battle/quick-match", json={"subject": "Science", "difficulty": "medium"}, headers={"Authorization": token1})
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.text}"
    data1 = res1.json()
    assert data1["matched"] is False, "Should be waiting since no opponent is waiting"
    assert data1["waiting"] is True
    battle_code = data1["battle_id"]
    print(f"  ✓ User 1 created waiting room: {battle_code}")

    # User 3 (Level 5) calls quick-match -> Level difference is |5 - 1| = 4 > 1 -> MUST NOT pair!
    res3 = client.post("/api/v1/battle/quick-match", json={"subject": "Science", "difficulty": "medium"}, headers={"Authorization": token3})
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["matched"] is False, "Level 5 player should NOT pair with Level 1 room!"
    assert data3["battle_id"] != battle_code, "Level 5 player should have a separate waiting room!"
    print(f"  ✓ Level 5 player (Level difference 4 > 1) was rejected by tolerance and assigned separate room: {data3['battle_id']}")

    # User 2 (Level 1) calls quick-match -> |1 - 1| = 0 <= 1 -> MUST PAIR with User 1!
    res2 = client.post("/api/v1/battle/quick-match", json={"subject": "Science", "difficulty": "medium"}, headers={"Authorization": token2})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["matched"] is True, "Level 1 player should pair with Level 1 room!"
    assert data2["battle_id"] == battle_code, f"Expected room {battle_code}, got {data2['battle_id']}"
    assert data2["opponent"]["user_id"] == u1.id
    print(f"  ✓ User 2 (Level 1) successfully matched with User 1 (Level 1) in room {battle_code}!")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 2: Join Robustness (Invalid Code, Full Room, Self-Joining)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 2] Join Robustness (Invalid Code, Full Room, Self-Joining)...")

    # Invalid room code
    res_inv = client.post("/api/v1/battle/BTL-INVALID999/join", headers={"Authorization": token2})
    assert res_inv.status_code == 404, f"Expected 404, got {res_inv.status_code}"
    print(f"  ✓ Invalid room code correctly returned 404 Not Found")

    # Full room check (Room already has User 1 and User 2, max_players = 2)
    res_full = client.post(f"/api/v1/battle/{battle_code}/join", headers={"Authorization": token3})
    assert res_full.status_code == 400, f"Expected 400, got {res_full.status_code}"
    assert "full" in res_full.json()["detail"].lower()
    print(f"  ✓ 3rd player joining full room correctly returned 400 Bad Request (Room Full)")

    # Self-joining check (User 1 joining again)
    res_self = client.post(f"/api/v1/battle/{battle_code}/join", headers={"Authorization": token1})
    assert res_self.status_code == 200, f"Expected 200, got {res_self.status_code}"
    assert res_self.json()["already_joined"] is True
    print(f"  ✓ Host self-joining handled gracefully (200 OK, already_joined=True)")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 3: Ultra-Low Latency Live State Polling (/live-state)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 3] Ultra-Low Latency Live State Polling (/live-state)...")
    res_live1 = client.get(f"/api/v1/battle/{battle_code}/live-state", headers={"Authorization": token1})
    assert res_live1.status_code == 200
    state1 = res_live1.json()
    assert state1["my_state"]["userName"] == "verify_player1"
    assert state1["opponent_state"]["userName"] == "verify_player2"
    assert state1["opponent_state"]["hasJoined"] is True
    assert state1["opponent_state"]["level"] == 1
    print(f"  ✓ Live-state payload verified: Local User: {state1['my_state']['userName']}, Peer: {state1['opponent_state']['userName']} (Lvl {state1['opponent_state']['level']})")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 4: Live Answer Submissions & Score Tracking
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 4] Live Answer Submissions & Score Tracking...")

    # Player 1 submits answer for Q0 (125 points)
    res_sub1 = client.post(f"/api/v1/battle/{battle_code}/submit", json={"score": 125, "answers": {"0": "B"}}, headers={"Authorization": token1})
    assert res_sub1.status_code == 200
    assert res_sub1.json()["current_score"] == 125

    # Player 2 submits answer for Q0 (90 points)
    res_sub2 = client.post(f"/api/v1/battle/{battle_code}/submit", json={"score": 90, "answers": {"0": "A"}}, headers={"Authorization": token2})
    assert res_sub2.status_code == 200
    assert res_sub2.json()["current_score"] == 90

    # Verify Player 1's live state shows Player 2's score as 90
    res_live1_updated = client.get(f"/api/v1/battle/{battle_code}/live-state", headers={"Authorization": token1})
    opp_state = res_live1_updated.json()["opponent_state"]
    assert opp_state["score"] == 90, f"Expected opponent score 90, got {opp_state['score']}"
    assert opp_state["answersCount"] == 1
    print(f"  ✓ Live score sync verified: Player 1 sees Player 2's score = {opp_state['score']} pts")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 5: Winner Determination & Gamification Rewards (+250 XP, Streak, Badges)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 5] Winner Determination & Rewards (+250 XP, Win Streak, Badges)...")

    # Conclude the battle
    res_comp = client.post(f"/api/v1/battle/{battle_code}/complete")
    assert res_comp.status_code == 200
    comp_data = res_comp.json()
    assert comp_data["winner_id"] == u1.id, f"Expected Player 1 ({u1.id}) to win with 125 > 90, got {comp_data['winner_id']}"
    assert comp_data["winner_name"] == "verify_player1"
    print(f"  ✓ Battle completed: Winner is {comp_data['winner_name']} (Score: 125 vs 90)")

    # Verify Database state for Winner (Player 1)
    db.expire_all()
    lb1_after = db.query(Leaderboard).filter(Leaderboard.user_id == u1.id).first()
    assert lb1_after.battles_won == 1, f"Expected 1 battle won, got {lb1_after.battles_won}"
    assert lb1_after.win_streak == 1, f"Expected win streak 1, got {lb1_after.win_streak}"
    # Total points = initial 50 + 250 (winner bonus) + 125 * 20 (2500) = 2800
    expected_pts1 = 50 + 250 + (125 * 20)
    assert lb1_after.total_points == expected_pts1, f"Expected {expected_pts1} pts, got {lb1_after.total_points}"
    badge_ids1 = [b["id"] for b in lb1_after.badges if isinstance(b, dict)]
    assert "badge_first_battle" in badge_ids1, "Winner must receive Gladiator (badge_first_battle)"
    assert "badge_battle_victor" in badge_ids1, "Winner must receive Battle Victor (badge_battle_victor)"
    print(f"  ✓ Winner Leaderboard verified: Points = {lb1_after.total_points} (+250 XP Bonus), Streak = {lb1_after.win_streak}")
    print(f"  ✓ Winner Badges verified: {badge_ids1}")

    # Verify Database state for Runner-up (Player 2)
    lb2_after = db.query(Leaderboard).filter(Leaderboard.user_id == u2.id).first()
    assert lb2_after.battles_won == 0
    assert lb2_after.win_streak == 0
    # Total points = initial 50 + 60 (participation bonus) + 90 * 10 (900) = 1010
    expected_pts2 = 50 + 60 + (90 * 10)
    assert lb2_after.total_points == expected_pts2, f"Expected {expected_pts2} pts, got {lb2_after.total_points}"
    badge_ids2 = [b["id"] for b in lb2_after.badges if isinstance(b, dict)]
    assert "badge_first_battle" in badge_ids2, "Runner-up must receive Gladiator (badge_first_battle)"
    print(f"  ✓ Runner-up Leaderboard verified: Points = {lb2_after.total_points} (+60 XP Participation), Streak = 0")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 6: Idempotency & Race Condition Mitigation (Simultaneous /complete Calls)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 6] Idempotency & Race Condition Check (Duplicate /complete Calls)...")
    res_comp2 = client.post(f"/api/v1/battle/{battle_code}/complete")
    assert res_comp2.status_code == 200
    # Confirm points did NOT increase again
    db.expire_all()
    lb1_check = db.query(Leaderboard).filter(Leaderboard.user_id == u1.id).first()
    assert lb1_check.total_points == expected_pts1, f"Points doubled! Expected {expected_pts1}, got {lb1_check.total_points}"
    print(f"  ✓ Idempotency verified: Subsequent /complete calls safely return existing result without duplicate rewards.")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 7: Tie / Draw Handling
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n[TEST 7] Tie / Draw Match Handling...")
    # Create a new battle for tie testing
    tie_b_res = client.post("/api/v1/battle/quick-match", json={"subject": "Math"}, headers={"Authorization": token1})
    tie_code = tie_b_res.json()["battle_id"]
    client.post(f"/api/v1/battle/{tie_code}/join", headers={"Authorization": token2})

    # Both players score exactly 100 points
    client.post(f"/api/v1/battle/{tie_code}/submit", json={"score": 100}, headers={"Authorization": token1})
    client.post(f"/api/v1/battle/{tie_code}/submit", json={"score": 100}, headers={"Authorization": token2})

    res_tie_comp = client.post(f"/api/v1/battle/{tie_code}/complete")
    assert res_tie_comp.status_code == 200
    tie_data = res_tie_comp.json()
    assert tie_data["is_draw"] is True, f"Expected is_draw=True, got {tie_data}"
    assert tie_data["winner_id"] is None, f"Expected None for draw winner, got {tie_data['winner_id']}"
    assert tie_data["winner_name"] == "Draw"
    print(f"  ✓ Draw match correctly detected: is_draw=True, winner_name='Draw'")

    print("\n" + "=" * 70)
    print("🎯 ALL 7 MULTIPLAYER BATTLE ENGINE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
