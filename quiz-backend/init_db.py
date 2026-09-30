"""
Initialize database with sample data for QuizMaster AI
Run this script to populate the database with test users and quizzes
"""
from database import engine, Base, SessionLocal
from models import User, Quiz, Question, PDF


def init_database():
    """Create tables and add sample data"""
    print("🔄 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created successfully")

    db = SessionLocal()

    try:
        # Check if data already exists
        existing_users = db.query(User).count()
        if existing_users > 0:
            print("⚠️  Database already contains data. Skipping initialization.")
            return

        print("📝 Adding sample users...")

        # Create sample users
        user1 = User(
            username="demo_user",
            email="demo@example.com",
            hashed_password="demo123"  # TODO: Use hashed passwords in production
        )
        user2 = User(
            username="quiz_master",
            email="quizmaster@example.com",
            hashed_password="quiz123"
        )
        db.add_all([user1, user2])
        db.commit()
        db.refresh(user1)
        db.refresh(user2)

        print(f"✅ Created users: {user1.username}, {user2.username}")

        print("📝 Adding sample quizzes...")

        # Create sample quiz with questions
        quiz1 = Quiz(
            title="Python Programming Basics",
            description="Test your knowledge of Python fundamentals",
            category="Programming",
            creator_id=user1.id
        )
        db.add(quiz1)
        db.flush()

        # Add questions to quiz1
        questions1 = [
            Question(
                quiz_id=quiz1.id,
                question_text="What is the correct way to create a function in Python?",
                options=["def my_function():", "function my_function():", "create my_function():", "func my_function():"],
                correct_answer="def my_function():",
                difficulty="easy"
            ),
            Question(
                quiz_id=quiz1.id,
                question_text="Which data type is immutable in Python?",
                options=["List", "Dictionary", "Tuple", "Set"],
                correct_answer="Tuple",
                difficulty="medium"
            ),
            Question(
                quiz_id=quiz1.id,
                question_text="What keyword is used to import a module in Python?",
                options=["include", "import", "require", "using"],
                correct_answer="import",
                difficulty="easy"
            )
        ]
        db.add_all(questions1)

        # Create another quiz
        quiz2 = Quiz(
            title="Web Development Fundamentals",
            description="Basic web development concepts",
            category="Web Development",
            creator_id=user2.id
        )
        db.add(quiz2)
        db.flush()

        # Add questions to quiz2
        questions2 = [
            Question(
                quiz_id=quiz2.id,
                question_text="What does HTML stand for?",
                options=["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"],
                correct_answer="Hyper Text Markup Language",
                difficulty="easy"
            ),
            Question(
                quiz_id=quiz2.id,
                question_text="Which CSS property is used to change text color?",
                options=["text-color", "font-color", "color", "text-style"],
                correct_answer="color",
                difficulty="easy"
            )
        ]
        db.add_all(questions2)

        db.commit()

        print(f"✅ Created quiz: {quiz1.title} with {len(questions1)} questions")
        print(f"✅ Created quiz: {quiz2.title} with {len(questions2)} questions")
        print("\n🎉 Database initialization completed successfully!")
        print("\n📊 Summary:")
        print(f"   - Users: {db.query(User).count()}")
        print(f"   - Quizzes: {db.query(Quiz).count()}")
        print(f"   - Questions: {db.query(Question).count()}")

    except Exception as e:
        print(f"❌ Error during initialization: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
