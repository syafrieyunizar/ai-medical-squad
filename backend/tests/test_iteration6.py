"""
Backend API Tests for AI Medical Squad - Iteration 6
Tests: Password verification, prompts, whitelist bypass, rate limiting
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = (
    os.environ.get("BACKEND_URL")
    or os.environ.get("VITE_BACKEND_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or ""
).rstrip("/")
if BASE_URL and not BASE_URL.endswith("/api"):
    BASE_URL = f"{BASE_URL}/api"

class TestPasswordVerification:
    """Test POST /api/whitelist/verify-password endpoint"""
    
    def test_verify_password_correct(self):
        """Test correct password 'buriead' returns valid: true"""
        client_id = f"test_iter6_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "buriead", "client_id": client_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("valid") == True
    
    def test_verify_password_wrong(self):
        """Test wrong password returns 401 with attempts_remaining"""
        client_id = f"test_iter6_wrong_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "wrongpassword", "client_id": client_id}
        )
        assert response.status_code == 401
        data = response.json()
        assert "attempts_remaining" in data or "detail" in data


class TestPrompts:
    """Test GET /api/prompts endpoint"""
    
    def test_get_prompts_returns_all_four(self):
        """Test GET /api/prompts returns all 5 prompts (anam, oppa, diag, palui, smart)"""
        response = requests.get(f"{BASE_URL}/api/prompts")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all 4 prompts exist
        assert "anam" in data, "Missing 'anam' prompt"
        assert "oppa" in data, "Missing 'oppa' prompt"
        assert "diag" in data, "Missing 'diag' prompt"
        assert "palui" in data, "Missing 'palui' prompt"
        assert "smart" in data, "Missing 'smart' prompt"
        
        # Verify prompts are non-empty strings
        assert isinstance(data["anam"], str) and len(data["anam"]) > 0
        assert isinstance(data["oppa"], str) and len(data["oppa"]) > 0
        assert isinstance(data["diag"], str) and len(data["diag"]) > 0
        assert isinstance(data["palui"], str) and len(data["palui"]) > 0
        assert isinstance(data["smart"], str) and len(data["smart"]) > 0


class TestWhitelistBypass:
    """Test GET /api/whitelist/bypass endpoint"""
    
    def test_get_bypass_settings(self):
        """Test GET /api/whitelist/bypass returns bypass settings"""
        response = requests.get(f"{BASE_URL}/api/whitelist/bypass")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "is_active" in data, "Missing 'is_active' field"
        assert isinstance(data["is_active"], bool)


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_rate_limiting_locks_after_3_attempts(self):
        """Test that 3 wrong attempts locks the client for 24h"""
        client_id = f"test_ratelimit_{uuid.uuid4().hex[:8]}"
        
        # Make 3 wrong attempts
        for i in range(3):
            response = requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": "wrongpassword", "client_id": client_id}
            )
            if i < 2:
                assert response.status_code == 401
            else:
                # 3rd attempt should trigger lockout
                assert response.status_code in [401, 429]
        
        # 4th attempt should be locked (429)
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "buriead", "client_id": client_id}
        )
        assert response.status_code == 429, f"Expected 429 after lockout, got {response.status_code}"
    
    def test_correct_password_after_lockout_still_blocked(self):
        """Test that even correct password is blocked after lockout"""
        client_id = f"test_lockout_{uuid.uuid4().hex[:8]}"
        
        # Trigger lockout with 3 wrong attempts
        for _ in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": "wrong", "client_id": client_id}
            )
        
        # Try correct password - should still be blocked
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "buriead", "client_id": client_id}
        )
        assert response.status_code == 429


class TestWhitelistEmails:
    """Test whitelist email management endpoints"""
    
    def test_get_whitelist_emails(self):
        """Test GET /api/whitelist/emails returns list"""
        response = requests.get(f"{BASE_URL}/api/whitelist/emails")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_add_and_delete_whitelist_email(self):
        """Test adding and deleting a whitelist email"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        # Add email
        add_response = requests.post(
            f"{BASE_URL}/api/whitelist/emails",
            json={"email": test_email}
        )
        assert add_response.status_code in [200, 201]
        
        # Verify email is in list
        list_response = requests.get(f"{BASE_URL}/api/whitelist/emails")
        emails = [e.get("email") for e in list_response.json()]
        assert test_email in emails
        
        # Delete email
        delete_response = requests.delete(f"{BASE_URL}/api/whitelist/emails/{test_email}")
        assert delete_response.status_code == 200
        
        # Verify email is removed
        list_response2 = requests.get(f"{BASE_URL}/api/whitelist/emails")
        emails2 = [e.get("email") for e in list_response2.json()]
        assert test_email not in emails2


class TestPasswordStatus:
    """Test password status endpoint"""
    
    def test_get_password_status(self):
        """Test GET /api/whitelist/password-status/{client_id}"""
        client_id = f"test_status_{uuid.uuid4().hex[:8]}"
        response = requests.get(f"{BASE_URL}/api/whitelist/password-status/{client_id}")
        assert response.status_code == 200
        data = response.json()
        assert "is_locked" in data
        assert "attempts_remaining" in data


class TestResetTimer:
    """Test reset timer functionality"""
    
    def test_reset_timer_with_correct_password(self):
        """Test POST /api/whitelist/reset-timer resets lockout"""
        client_id = f"test_reset_{uuid.uuid4().hex[:8]}"
        
        # Trigger lockout
        for _ in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": "wrong", "client_id": client_id}
            )
        
        # Verify locked
        locked_response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "buriead", "client_id": client_id}
        )
        assert locked_response.status_code == 429
        
        # Reset timer
        reset_response = requests.post(
            f"{BASE_URL}/api/whitelist/reset-timer",
            json={"password": "buriead", "client_id": client_id}
        )
        assert reset_response.status_code == 200
        
        # Verify unlocked
        unlocked_response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "buriead", "client_id": client_id}
        )
        assert unlocked_response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
