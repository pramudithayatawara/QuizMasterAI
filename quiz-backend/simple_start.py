#!/usr/bin/env python3
import sys
import os

# Current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🚀 Starting QuizMaster AI Backend...")

try:
    from database import engine, Base
    from init_db import init_db
    
    # Test database connection
    print("🔗 Testing database connection...")
    with engine.connect() as conn:
        from sqlalchemy import text
        result = conn.execute(text("SELECT 1"))
        print("✅ Database connection successful!")
    
    # Create tables
    print("🔧 Creating database tables...")
    init_db()
    
    print("✅ Database setup complete!")
    
except Exception as e:
    print(f"❌ Database setup failed: {e}")
    print("⚠️ Continuing without database...")

# Start FastAPI server
print("🌐 Starting FastAPI server...")
import uvicorn
uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)