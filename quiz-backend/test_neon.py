import os
import socket
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")

print(f"DATABASE_URL: {DATABASE_URL[:40]}...")

# Parse the URL
if DATABASE_URL.startswith("postgresql+"):
    url = DATABASE_URL.replace("postgresql+psycopg2://", "").replace("postgresql+pg8000://", "")
    url = url.split("?")[0]
    user_pass_host_db = url.split("@")
    user_pass = user_pass_host_db[0].split(":")
    user = user_pass[0]
    password = user_pass[1]
    host_db = user_pass_host_db[1].split("/")
    host = host_db[0]
    db = host_db[1]

    print(f"\nConnection details:")
    print(f"  Host: {host}")
    print(f"  Port: 5432")
    print(f"  User: {user}")
    print(f"  Database: {db}")
    print(f"  Password length: {len(password)} chars")

    # Test TCP connection
    print(f"\n🔗 Testing TCP connection to {host}:5432...")
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, 5432))
        sock.close()

        if result == 0:
            print("✅ TCP connection successful")
        else:
            print(f"❌ TCP connection failed with error code: {result}")
    except Exception as e:
        print(f"❌ TCP connection error: {e}")
