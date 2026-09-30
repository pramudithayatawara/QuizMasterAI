import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Database configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "quizmaster.db")
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL or DATABASE_URL == "sqlite:///./quizmaster.db":
    DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"

# Detect database type from URL
is_postgresql = DATABASE_URL.startswith("postgresql://")
is_sqlite = DATABASE_URL.startswith("sqlite:///")

if is_postgresql:
    print(f"📊 Using database: Neon PostgreSQL")
    # PostgreSQL-specific configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=5,         # Connection pool size
        max_overflow=10,     # Maximum overflow connections
        echo=False,          # Set to True for SQL query logging during development
        connect_args={
            "sslmode": "require",  # Require SSL connection
            "connect_timeout": 10  # Connection timeout in seconds
        }
    )
elif is_sqlite:
    print(f"📊 Using database: SQLite")
    # SQLite-specific configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=False,  # Set to True for SQL query logging during development
        connect_args={"check_same_thread": False}  # Required for SQLite
    )
else:
    print(f"📊 Using database: {DATABASE_URL[:50]}...")
    # Generic configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        echo=False
    )

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session.
    Use this in FastAPI endpoints with: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
