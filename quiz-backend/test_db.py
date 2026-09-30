"""
Test database connection and basic operations
"""
from database import engine, Base, SessionLocal
from models import User, Quiz, Question


def test_database():
    """Test database connection and CRUD operations"""
    print("🔗 Testing database connection...")

    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")

        db = SessionLocal()

        try:
            # Test creating a user
            print("\n📝 Testing user creation...")
            test_user = User(
                username="test_user",
                email="test@example.com",
                hashed_password="test123"
            )
            db.add(test_user)
            db.commit()
            db.refresh(test_user)
            print(f"✅ User created: {test_user.username} (ID: {test_user.id})")

            # Test creating a quiz
            print("\n📝 Testing quiz creation...")
            test_quiz = Quiz(
                title="Test Quiz",
                description="A test quiz",
                category="Test",
                creator_id=test_user.id
            )
            db.add(test_quiz)
            db.commit()
            db.refresh(test_quiz)
            print(f"✅ Quiz created: {test_quiz.title} (ID: {test_quiz.id})")

            # Test creating a question
            print("\n📝 Testing question creation...")
            test_question = Question(
                quiz_id=test_quiz.id,
                question_text="What is 2+2?",
                options=["3", "4", "5", "6"],
                correct_answer="4",
                difficulty="easy"
            )
            db.add(test_question)
            db.commit()
            db.refresh(test_question)
            print(f"✅ Question created: {test_question.question_text[:20]}... (ID: {test_question.id})")

            # Test querying
            print("\n� Testing queries...")
            user_count = db.query(User).count()
            quiz_count = db.query(Quiz).count()
            question_count = db.query(Question).count()
            print(f"✅ Users: {user_count}, Quizzes: {quiz_count}, Questions: {question_count}")

            print("\n🎉 All database tests passed!")

        except Exception as e:
            print(f"❌ Error during database operations: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        raise


if __name__ == "__main__":
    test_database()
