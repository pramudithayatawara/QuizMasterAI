"""
Test script to verify Neon PostgreSQL database connection
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Database connection URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_Y3q8dIZMAEUl@ep-mute-moon-b5c0nzsy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)

print(f"🔗 Testing connection to Neon PostgreSQL...")
print(f"📊 Database URL: {DATABASE_URL[:50]}...")

try:
    # Create engine
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        echo=True  # Enable SQL logging for testing
    )
    
    # Test connection
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        version = result.fetchone()[0]
        print(f"✅ Successfully connected to PostgreSQL!")
        print(f"📌 Database version: {version}")
        
        # Test creating a simple table
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS test_connection (
                id SERIAL PRIMARY KEY,
                test_text VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        connection.commit()
        print("✅ Test table created successfully")
        
        # Test inserting data
        connection.execute(text("""
            INSERT INTO test_connection (test_text) 
            VALUES ('Neon PostgreSQL connection test');
        """))
        connection.commit()
        print("✅ Test data inserted successfully")
        
        # Test querying data
        result = connection.execute(text("SELECT * FROM test_connection;"))
        rows = result.fetchall()
        print(f"✅ Retrieved {len(rows)} test rows")
        
        # Clean up
        connection.execute(text("DROP TABLE IF EXISTS test_connection;"))
        connection.commit()
        print("✅ Test table cleaned up")
        
    print("🎉 All database connection tests passed!")
    
except Exception as e:
    print(f"❌ Database connection failed: {e}")
    import traceback
    traceback.print_exc()
