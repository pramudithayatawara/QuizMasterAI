"""
Simple test script to verify Neon PostgreSQL database connection
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Database connection URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Y3q8dIZMAEUl@ep-mute-moon-b5c0nzsy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"
)

print(f"🔗 Testing connection to Neon PostgreSQL...")
print(f"📊 Database URL: {DATABASE_URL[:50]}...")

try:
    # Create engine with minimal settings
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=False  # Disable SQL logging for now
    )
    
    # Test connection
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1;"))
        print(f"✅ Successfully connected to PostgreSQL!")
        
    print("🎉 Database connection test passed!")
    
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    import traceback
    traceback.print_exc()
