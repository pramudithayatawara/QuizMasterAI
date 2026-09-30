"""
Integration test script to verify FastAPI backend works with frontend
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(endpoint, method="GET", data=None, description=""):
    """Test a single API endpoint"""
    print(f"\n{'='*60}")
    print(f"Testing: {description}")
    print(f"Endpoint: {method} {endpoint}")
    print(f"{'='*60}")

    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{endpoint}")
        elif method == "POST":
            response = requests.post(
                f"{BASE_URL}{endpoint}",
                json=data,
                headers={"Content-Type": "application/json"}
            )

        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code < 400:
            print("✅ PASSED")
            return True
        else:
            print("❌ FAILED")
            return False

    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False


def main():
    """Run all integration tests"""
    print("🧪 QuizMaster AI - Backend Integration Tests")
    print(f"Testing against: {BASE_URL}")
    print(f"{'='*60}")

    results = []

    # Test health endpoint
    results.append(test_endpoint(
        "/",
        "GET",
        description="Health check"
    ))

    # Test user registration
    results.append(test_endpoint(
        "/api/v1/auth/register",
        "POST",
        data={
            "username": "integration_test_user",
            "email": "integration_test@example.com",
            "password": "test123"
        },
        description="User registration"
    ))

    # Test user login
    results.append(test_endpoint(
        "/api/v1/auth/login",
        "POST",
        data={
            "email": "integration_test@example.com",
            "password": "test123"
        },
        description="User login"
    ))

    # Test get current user
    results.append(test_endpoint(
        "/api/v1/auth/me",
        "GET",
        description="Get current user"
    ))

    # Test get quizzes
    results.append(test_endpoint(
        "/api/v1/quizzes",
        "GET",
        description="Get all quizzes"
    ))

    # Test gamification profile
    results.append(test_endpoint(
        "/api/v1/gamification/profile/me",
        "GET",
        description="Get gamification profile"
    ))

    # Test gamification badges
    results.append(test_endpoint(
        "/api/v1/gamification/badges/me",
        "GET",
        description="Get user badges"
    ))

    # Test leaderboard
    results.append(test_endpoint(
        "/api/v1/gamification/leaderboard",
        "GET",
        description="Get leaderboard"
    ))

    # Test results analytics
    results.append(test_endpoint(
        "/api/v1/results/analytics/me",
        "GET",
        description="Get results analytics"
    ))

    # Summary
    print(f"\n{'='*60}")
    print("📊 TEST SUMMARY")
    print(f"{'='*60}")
    total = len(results)
    passed = sum(results)
    failed = total - passed

    print(f"Total Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")

    if failed == 0:
        print("\n🎉 All tests passed! Backend is ready for frontend integration.")
    else:
        print(f"\n⚠️  {failed} test(s) failed. Please check the errors above.")

    return failed == 0


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
