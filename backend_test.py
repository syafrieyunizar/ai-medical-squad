import requests
import sys
import json
from datetime import datetime, timedelta

class WhitelistAPITester:
    def __init__(self, base_url="https://patient-report-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_password = "buriead"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_basic_api(self):
        """Test basic API connectivity"""
        return self.run_test("Basic API connectivity", "GET", "", 200)

    def test_password_verification_wrong(self):
        """Test password verification with wrong password"""
        return self.run_test(
            "Password verification (wrong password)",
            "POST",
            "whitelist/verify-password",
            401,
            data={"password": "wrongpassword"}
        )

    def test_password_verification_correct(self):
        """Test password verification with correct password"""
        return self.run_test(
            "Password verification (correct password)",
            "POST",
            "whitelist/verify-password",
            200,
            data={"password": self.admin_password}
        )

    def test_get_whitelist_emails(self):
        """Test getting whitelist emails"""
        return self.run_test(
            "Get whitelist emails",
            "GET",
            "whitelist/emails",
            200
        )

    def test_add_whitelist_email_lifetime(self):
        """Test adding email to whitelist with lifetime access"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@example.com"
        return self.run_test(
            "Add whitelist email (lifetime)",
            "POST",
            "whitelist/emails",
            200,
            data={"email": test_email, "expiry_datetime": None}
        ), test_email

    def test_add_whitelist_email_custom(self):
        """Test adding email to whitelist with custom expiry"""
        test_email = f"test_custom_{datetime.now().strftime('%H%M%S')}@example.com"
        future_date = (datetime.now() + timedelta(days=30)).isoformat()
        return self.run_test(
            "Add whitelist email (custom expiry)",
            "POST",
            "whitelist/emails",
            200,
            data={"email": test_email, "expiry_datetime": future_date}
        ), test_email

    def test_check_whitelist_email(self, email):
        """Test checking if email is whitelisted"""
        return self.run_test(
            f"Check whitelist status for {email}",
            "GET",
            f"whitelist/check/{email}",
            200
        )

    def test_delete_whitelist_email(self, email):
        """Test deleting email from whitelist"""
        return self.run_test(
            f"Delete whitelist email {email}",
            "DELETE",
            f"whitelist/emails/{email}",
            200
        )

    def test_get_bypass_settings(self):
        """Test getting bypass settings"""
        return self.run_test(
            "Get bypass settings",
            "GET",
            "whitelist/bypass",
            200
        )

    def test_set_bypass_active_lifetime(self):
        """Test setting bypass active with lifetime"""
        return self.run_test(
            "Set bypass active (lifetime)",
            "POST",
            "whitelist/bypass",
            200,
            data={"is_active": True, "expiry_datetime": None}
        )

    def test_set_bypass_active_custom(self):
        """Test setting bypass active with custom expiry"""
        future_date = (datetime.now() + timedelta(hours=1)).isoformat()
        return self.run_test(
            "Set bypass active (custom expiry)",
            "POST",
            "whitelist/bypass",
            200,
            data={"is_active": True, "expiry_datetime": future_date}
        )

    def test_set_bypass_inactive(self):
        """Test setting bypass inactive"""
        return self.run_test(
            "Set bypass inactive",
            "POST",
            "whitelist/bypass",
            200,
            data={"is_active": False, "expiry_datetime": None}
        )

    def test_check_non_whitelisted_email(self):
        """Test checking non-whitelisted email"""
        non_whitelisted_email = f"nonwhitelisted_{datetime.now().strftime('%H%M%S')}@example.com"
        return self.run_test(
            f"Check non-whitelisted email {non_whitelisted_email}",
            "GET",
            f"whitelist/check/{non_whitelisted_email}",
            200
        )

def main():
    print("🚀 Starting AI Medical Squad Whitelist API Tests")
    print("=" * 60)
    
    tester = WhitelistAPITester()
    
    # Test basic connectivity
    success, _ = tester.test_basic_api()
    if not success:
        print("❌ Basic API connectivity failed, stopping tests")
        return 1

    # Test password verification
    tester.test_password_verification_wrong()
    tester.test_password_verification_correct()

    # Test bypass settings
    tester.test_get_bypass_settings()
    tester.test_set_bypass_inactive()  # Start with bypass off
    tester.test_set_bypass_active_lifetime()
    tester.test_set_bypass_active_custom()
    tester.test_set_bypass_inactive()  # Reset to off

    # Test whitelist email management
    tester.test_get_whitelist_emails()
    
    # Add test emails
    (success1, test_email1) = tester.test_add_whitelist_email_lifetime()
    (success2, test_email2) = tester.test_add_whitelist_email_custom()
    
    # Check whitelist status
    if success1:
        tester.test_check_whitelist_email(test_email1)
    if success2:
        tester.test_check_whitelist_email(test_email2)
    
    # Test non-whitelisted email
    tester.test_check_non_whitelisted_email()
    
    # Clean up - delete test emails
    if success1:
        tester.test_delete_whitelist_email(test_email1)
    if success2:
        tester.test_delete_whitelist_email(test_email2)

    # Final results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())