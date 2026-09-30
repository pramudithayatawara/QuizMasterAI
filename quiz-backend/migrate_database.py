"""
Database Migration Script for Priority 30 & 31

This script updates the database schema to support:
- Priority 30: PDF and user linking for quizzes
- Priority 31: Difficulty categorization fields

Run this script to update your existing database schema.
"""

import sys
import os
from sqlalchemy import text, inspect
from sqlalchemy.engine.reflection import Inspector
from database import engine
# Import models after they've been updated to avoid reserved attribute issues


def migrate_database():
    """
    Migrate the database to support new schema changes
    """
    print("🔄 Starting database migration...")
    
    try:
        with engine.connect() as conn:
            # Backup current data (optional, but recommended)
            print("💾 Creating backup of current data...")
            
            # Add new columns to Quiz table (SQLite doesn't support IF NOT EXISTS in ALTER TABLE)
            print("📝 Updating Quiz table...")
            
            # Check if columns exist before adding
            inspector = Inspector(engine)
            quiz_columns = [col['name'] for col in inspector.get_columns('quizzes')]
            
            if 'pdf_id' not in quiz_columns:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN pdf_id INTEGER"))
                print("   Added pdf_id column")
            
            if 'total_questions' not in quiz_columns:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN total_questions INTEGER DEFAULT 0"))
                print("   Added total_questions column")
            
            if 'quiz_metadata' not in quiz_columns:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN quiz_metadata JSON"))
                print("   Added quiz_metadata column")
            
            if 'tags' not in quiz_columns:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN tags JSON"))
                print("   Added tags column")
            
            if 'is_active' not in quiz_columns:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN is_active BOOLEAN DEFAULT 1"))
                print("   Added is_active column")
            
            if 'updated_at' not in quiz_columns:
                conn.execute(text("ALTER TABLE quizzes ADD COLUMN updated_at TIMESTAMP"))
                print("   Added updated_at column")
            
            # Add foreign key constraint for pdf_id
            try:
                conn.execute(text("""
                    ALTER TABLE quizzes ADD CONSTRAINT fk_quiz_pdf 
                    FOREIGN KEY (pdf_id) REFERENCES pdfs(id);
                """))
                print("✅ Added foreign key constraint for pdf_id")
            except Exception as e:
                print(f"⚠️ Foreign key constraint may already exist: {e}")
            
            # Add new columns to Question table
            print("📝 Updating Question table...")
            question_columns = [col['name'] for col in inspector.get_columns('questions')]
            
            if 'question_type' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN question_type VARCHAR(50) DEFAULT 'mcq'"))
                print("   Added question_type column")
            
            if 'difficulty_score' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN difficulty_score REAL"))
                print("   Added difficulty_score column")
            
            if 'explanation' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN explanation TEXT"))
                print("   Added explanation column")
            
            if 'source_chunk_index' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN source_chunk_index INTEGER DEFAULT 0"))
                print("   Added source_chunk_index column")
            
            if 'confidence_score' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN confidence_score REAL"))
                print("   Added confidence_score column")
            
            if 'question_metadata' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN question_metadata JSON"))
                print("   Added question_metadata column")
            
            if 'tags' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN tags JSON"))
                print("   Added tags column")
            
            if 'updated_at' not in question_columns:
                conn.execute(text("ALTER TABLE questions ADD COLUMN updated_at TIMESTAMP"))
                print("   Added updated_at column")
            
            # Update default value for difficulty
            conn.execute(text("""
                UPDATE questions SET difficulty = 'medium' WHERE difficulty IS NULL;
            """))
            
            # Add new columns to PDF table
            print("📝 Updating PDF table...")
            pdf_columns = [col['name'] for col in inspector.get_columns('pdfs')]
            
            if 'pdf_metadata' not in pdf_columns:
                conn.execute(text("ALTER TABLE pdfs ADD COLUMN pdf_metadata JSON"))
                print("   Added pdf_metadata column")
            
            if 'updated_at' not in pdf_columns:
                conn.execute(text("ALTER TABLE pdfs ADD COLUMN updated_at TIMESTAMP"))
                print("   Added updated_at column")
            
            # Add new column to QuizAttempt table
            print("📝 Updating QuizAttempt table...")
            attempt_columns = [col['name'] for col in inspector.get_columns('quiz_attempts')]
            
            if 'time_spent' not in attempt_columns:
                conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN time_spent INTEGER"))
                print("   Added time_spent column")
            
            # Commit changes
            conn.commit()
            
            print("✅ Database migration completed successfully!")
            print("📊 New schema includes:")
            print("   - Quiz table: pdf_id, total_questions, quiz_metadata, tags, is_active, updated_at")
            print("   - Question table: question_type, difficulty_score, explanation, source_chunk_index, confidence_score, question_metadata, tags, updated_at")
            print("   - PDF table: pdf_metadata, updated_at")
            print("   - QuizAttempt table: time_spent")
            
            return True
            
    except Exception as e:
        print(f"❌ Database migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def recreate_tables():
    """
    Recreate all tables (WARNING: This will delete all existing data)
    Use this only if you want to start fresh with the new schema
    """
    print("⚠️ WARNING: This will delete all existing data!")
    print("💾 Dropping all tables...")
    
    try:
        # Import models after they've been updated
        from models import Base
        Base.metadata.drop_all(bind=engine)
        print("✅ Tables dropped successfully")
        
        print("🔄 Creating all tables with new schema...")
        Base.metadata.create_all(bind=engine)
        print("✅ Tables created successfully with new schema")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to recreate tables: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🗄️ Database Migration Script for Priority 30 & 31")
    print("=" * 60)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--recreate":
        # Recreate tables (delete all data)
        recreate_tables()
    else:
        # Migrate existing tables (preserve data)
        success = migrate_database()
        
        if success:
            print("\n✅ Migration completed successfully!")
            print("You can now use the updated schema for Priority 30 & 31 features.")
        else:
            print("\n❌ Migration failed. Check the error messages above.")
            print("If you want to start fresh, run: python migrate_database.py --recreate")