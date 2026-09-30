"""
Test different SSL configurations for Neon PostgreSQL
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Test different SSL configurations
test_configs = [
    # Configuration 1: Basic connection (let Neon handle SSL)
    "postgresql://neondb_owner:npg_Y3q8dIZMAEUl@ep-mute-moon-b5c0nzsy-pooler.c-7.us-east-2.aws.neon.tech/neondb",
    
    # Configuration 2: SSL mode prefer
    "postgresql://neondb_owner:npg_Y3q8dIZMAEUl@ep-mute-moon-b5c0nzsy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=prefer",
    
    # Configuration 3: SSL mode allow
    "postgresql://neondb_owner:npg_Y3q8dIZMAEUl@ep-mute-moon-b5c0nzsy-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=allow",
]

for i, db_url in enumerate(test_configs, 1):
    print(f"\n🔗 Testing Configuration {i}: {db_url[:60]}...")
    
    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            echo=False,
            connect_args={"connect_timeout": 5}
        )
        
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1;"))
            print(f"✅ Configuration {i} - SUCCESS!")
            print(f"🎉 Working URL: {db_url}")
            
            # Test table creation
            connection.execute(text("""
                CREATE TABLE IF NOT EXISTS ssl_test (
                    id SERIAL PRIMARY KEY,
                    test_text VARCHAR(100)
                );
            """))
            connection.commit()
            print("✅ Table creation successful")
            
            # Clean up
            connection.execute(text("DROP TABLE IF EXISTS ssl_test;"))
            connection.commit()
            print("✅ Cleanup successful")
            
            # Exit on first success
            print(f"\n🎉 RECOMMENDED CONFIGURATION: Configuration {i}")
            print(f"📝 Use this URL in your .env file:")
            print(f"DATABASE_URL={db_url}")
            break
            
    except Exception as e:
        print(f"❌ Configuration {i} - FAILED: {str(e)[:100]}")
        continue

print("\n🏁 SSL configuration testing complete")
