"""
Backend API Tests for AI Medical Squad - Iteration 3
Testing: Rate Limiting, Reset Timer, Prompt Editor, and Whitelist Management

Features tested:
- Password verification with rate limiting (3 attempts max)
- Lockout mechanism (24h lockout after 3 failed attempts)
- Reset timer functionality (with its own 3-attempt limit)
- Prompt CRUD operations (anam, oppa, diag, palui)
- Whitelist email management (CRUD)
- Bypass mode toggle
"""

import pytest
import requests
import os
import uuid
import time

# Get BASE_URL from environment
BASE_URL = (
    os.environ.get("BACKEND_URL")
    or os.environ.get("VITE_BACKEND_URL")
    or os.environ.get("REACT_APP_BACKEND_URL")
    or ""
).rstrip("/")
if BASE_URL and not BASE_URL.endswith("/api"):
    BASE_URL = f"{BASE_URL}/api"
if not BASE_URL:
    raise ValueError("BACKEND_URL or VITE_BACKEND_URL environment variable not set")

ADMIN_PASSWORD = "buriead"


class TestPasswordVerification:
    """Test password verification endpoint with rate limiting"""
    
    def test_correct_password_returns_valid(self):
        """Verify correct password 'buriead' returns {valid: true}"""
        client_id = f"test_correct_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("valid") == True, f"Expected valid=True, got {data}"
    
    def test_wrong_password_returns_401_with_attempts(self):
        """Verify wrong password returns 401 with attempts_remaining"""
        client_id = f"test_wrong_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "wrongpassword", "client_id": client_id}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        data = response.json()
        detail = data.get("detail", {})
        assert "attempts_remaining" in detail, f"Expected attempts_remaining in response: {data}"
        assert detail["attempts_remaining"] == 2, f"Expected 2 attempts remaining, got {detail['attempts_remaining']}"


class TestRateLimiting:
    """Test rate limiting - 3 consecutive wrong attempts should lock for 24h"""
    
    def test_lockout_after_3_wrong_attempts(self):
        """3 consecutive wrong attempts should lock for 24h (status 429)"""
        client_id = f"test_lockout_{uuid.uuid4().hex[:8]}"
        
        # First wrong attempt
        r1 = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "wrong1", "client_id": client_id}
        )
        assert r1.status_code == 401
        assert r1.json()["detail"]["attempts_remaining"] == 2
        
        # Second wrong attempt
        r2 = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "wrong2", "client_id": client_id}
        )
        assert r2.status_code == 401
        assert r2.json()["detail"]["attempts_remaining"] == 1
        
        # Third wrong attempt - should trigger lockout
        r3 = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "wrong3", "client_id": client_id}
        )
        assert r3.status_code == 429, f"Expected 429 after 3 wrong attempts, got {r3.status_code}: {r3.text}"
        detail = r3.json().get("detail", {})
        assert "locked_until" in detail, f"Expected locked_until in response: {r3.json()}"
        assert "can_reset" in detail, f"Expected can_reset in response: {r3.json()}"
    
    def test_correct_password_blocked_after_lockout(self):
        """After lockout, even correct password should return 429"""
        client_id = f"test_blocked_{uuid.uuid4().hex[:8]}"
        
        # Trigger lockout with 3 wrong attempts
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": f"wrong{i}", "client_id": client_id}
            )
        
        # Now try correct password - should still be locked
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        
        assert response.status_code == 429, f"Expected 429 even with correct password after lockout, got {response.status_code}"


class TestResetTimer:
    """Test reset timer functionality"""
    
    def test_reset_timer_with_correct_password(self):
        """Reset lockout with correct password 'buriead'"""
        client_id = f"test_reset_{uuid.uuid4().hex[:8]}"
        
        # First trigger lockout
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": f"wrong{i}", "client_id": client_id}
            )
        
        # Verify locked
        verify_locked = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        assert verify_locked.status_code == 429, "Should be locked"
        
        # Reset timer with correct password
        reset_response = requests.post(
            f"{BASE_URL}/api/whitelist/reset-timer",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        
        assert reset_response.status_code == 200, f"Expected 200, got {reset_response.status_code}: {reset_response.text}"
        data = reset_response.json()
        assert "reset_attempts_remaining" in data, f"Expected reset_attempts_remaining: {data}"
        assert data["reset_attempts_remaining"] == 2, f"Expected 2 reset attempts remaining, got {data['reset_attempts_remaining']}"
    
    def test_verify_password_works_after_reset(self):
        """After reset, verify-password with correct password should work again"""
        client_id = f"test_after_reset_{uuid.uuid4().hex[:8]}"
        
        # Trigger lockout
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": f"wrong{i}", "client_id": client_id}
            )
        
        # Reset timer
        requests.post(
            f"{BASE_URL}/api/whitelist/reset-timer",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        
        # Now verify password should work
        response = requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        
        assert response.status_code == 200, f"Expected 200 after reset, got {response.status_code}: {response.text}"
        assert response.json().get("valid") == True
    
    def test_reset_timer_wrong_password_returns_401(self):
        """Reset timer with wrong password returns 401"""
        client_id = f"test_reset_wrong_{uuid.uuid4().hex[:8]}"
        
        # Trigger lockout
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": f"wrong{i}", "client_id": client_id}
            )
        
        # Try reset with wrong password
        response = requests.post(
            f"{BASE_URL}/api/whitelist/reset-timer",
            json={"password": "wrongpassword", "client_id": client_id}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
    
    def test_reset_timer_has_own_limit(self):
        """Reset timer has its own 3-attempt limit"""
        client_id = f"test_reset_limit_{uuid.uuid4().hex[:8]}"
        
        # Trigger lockout and reset 3 times
        for reset_num in range(3):
            # Trigger lockout
            for i in range(3):
                requests.post(
                    f"{BASE_URL}/api/whitelist/verify-password",
                    json={"password": f"wrong{i}", "client_id": client_id}
                )
            
            # Reset
            reset_response = requests.post(
                f"{BASE_URL}/api/whitelist/reset-timer",
                json={"password": ADMIN_PASSWORD, "client_id": client_id}
            )
            
            if reset_num < 2:
                assert reset_response.status_code == 200, f"Reset {reset_num+1} should succeed"
                expected_remaining = 2 - reset_num
                assert reset_response.json()["reset_attempts_remaining"] == expected_remaining
            else:
                # Third reset should still work but remaining should be 0
                assert reset_response.status_code == 200
                assert reset_response.json()["reset_attempts_remaining"] == 0
        
        # Trigger lockout again
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/whitelist/verify-password",
                json={"password": f"wrong{i}", "client_id": client_id}
            )
        
        # Fourth reset should fail with 429
        final_reset = requests.post(
            f"{BASE_URL}/api/whitelist/reset-timer",
            json={"password": ADMIN_PASSWORD, "client_id": client_id}
        )
        
        assert final_reset.status_code == 429, f"Expected 429 after 3 resets, got {final_reset.status_code}: {final_reset.text}"


class TestPasswordStatus:
    """Test password status endpoint"""
    
    def test_get_password_status_new_client(self):
        """GET /api/whitelist/password-status/{client_id} returns correct status for new client"""
        client_id = f"test_status_{uuid.uuid4().hex[:8]}"
        
        response = requests.get(f"{BASE_URL}/api/whitelist/password-status/{client_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["is_locked"] == False
        assert data["attempts_remaining"] == 3
        assert data["reset_attempts_remaining"] == 3
    
    def test_get_password_status_after_failed_attempt(self):
        """Password status updates after failed attempt"""
        client_id = f"test_status_fail_{uuid.uuid4().hex[:8]}"
        
        # Make one failed attempt
        requests.post(
            f"{BASE_URL}/api/whitelist/verify-password",
            json={"password": "wrong", "client_id": client_id}
        )
        
        response = requests.get(f"{BASE_URL}/api/whitelist/password-status/{client_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["attempts_remaining"] == 2


class TestPromptsCRUD:
    """Test prompts CRUD operations"""
    
    def test_get_all_prompts(self):
        """GET /api/prompts returns all 4 prompts (anam, oppa, diag, palui)"""
        response = requests.get(f"{BASE_URL}/api/prompts")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify all 4 agent prompts exist
        assert "anam" in data, "Missing anam prompt"
        assert "oppa" in data, "Missing oppa prompt"
        assert "diag" in data, "Missing diag prompt"
        assert "palui" in data, "Missing palui prompt"
        
        # Verify prompts are non-empty strings
        for agent_id in ["anam", "oppa", "diag", "palui"]:
            assert isinstance(data[agent_id], str), f"{agent_id} prompt should be string"
            assert len(data[agent_id]) > 0, f"{agent_id} prompt should not be empty"
    
    def test_get_single_prompt(self):
        """GET /api/prompts/{agent_id} returns specific prompt"""
        response = requests.get(f"{BASE_URL}/api/prompts/anam")
        
        assert response.status_code == 200
        data = response.json()
        assert "agent_id" in data or "prompt" in data
    
    def test_update_prompt(self):
        """POST /api/prompts updates a prompt successfully"""
        test_prompt = f"TEST_PROMPT_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/prompts",
            json={"agent_id": "anam", "prompt": test_prompt}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("message") == "Prompt updated"
        assert data.get("agent_id") == "anam"
        
        # Verify the update persisted
        verify_response = requests.get(f"{BASE_URL}/api/prompts")
        verify_data = verify_response.json()
        assert verify_data["anam"] == test_prompt, "Prompt update did not persist"
    
    def test_reset_prompt_to_default(self):
        """POST /api/prompts/reset/{agent_id} resets prompt to default"""
        # First update the prompt
        requests.post(
            f"{BASE_URL}/api/prompts",
            json={"agent_id": "anam", "prompt": "TEMPORARY_TEST_PROMPT"}
        )
        
        # Reset to default
        response = requests.post(f"{BASE_URL}/api/prompts/reset/anam")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("message") == "Prompt reset to default"
        assert data.get("agent_id") == "anam"
        assert "prompt" in data, "Reset response should include default prompt"
        assert len(data["prompt"]) > 0, "Default prompt should not be empty"
    
    def test_invalid_agent_id_returns_400(self):
        """Invalid agent_id returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/prompts",
            json={"agent_id": "invalid_agent", "prompt": "test"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestWhitelistEmails:
    """Test whitelist email management"""
    
    def test_get_whitelist_emails(self):
        """GET /api/whitelist/emails returns whitelist emails"""
        response = requests.get(f"{BASE_URL}/api/whitelist/emails")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_add_email_to_whitelist(self):
        """POST /api/whitelist/emails adds email to whitelist"""
        test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/whitelist/emails",
            json={"email": test_email, "expiry_datetime": None}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "email" in data
        assert data["email"] == test_email.lower()
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/whitelist/emails/{test_email}")
    
    def test_delete_email_from_whitelist(self):
        """DELETE /api/whitelist/emails/{email} deletes email from whitelist"""
        test_email = f"test_delete_{uuid.uuid4().hex[:8]}@example.com"
        
        # First add the email
        requests.post(
            f"{BASE_URL}/api/whitelist/emails",
            json={"email": test_email, "expiry_datetime": None}
        )
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/whitelist/emails/{test_email}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("message") == "Email removed"
    
    def test_delete_nonexistent_email_returns_404(self):
        """DELETE nonexistent email returns 404"""
        response = requests.delete(f"{BASE_URL}/api/whitelist/emails/nonexistent_{uuid.uuid4().hex}@example.com")
        
        assert response.status_code == 404


class TestBypassMode:
    """Test bypass mode functionality"""
    
    def test_get_bypass_settings(self):
        """GET /api/whitelist/bypass returns bypass settings"""
        response = requests.get(f"{BASE_URL}/api/whitelist/bypass")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "is_active" in data, "Response should include is_active"
    
    def test_toggle_bypass_mode(self):
        """POST /api/whitelist/bypass toggles bypass mode"""
        # Get current state
        current = requests.get(f"{BASE_URL}/api/whitelist/bypass").json()
        current_state = current.get("is_active", False)
        
        # Toggle to opposite
        response = requests.post(
            f"{BASE_URL}/api/whitelist/bypass",
            json={"is_active": not current_state, "expiry_datetime": None}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("is_active") == (not current_state)
        
        # Restore original state
        requests.post(
            f"{BASE_URL}/api/whitelist/bypass",
            json={"is_active": current_state, "expiry_datetime": None}
        )


class TestWhitelistCheck:
    """Test whitelist check endpoint"""
    
    def test_check_whitelisted_email(self):
        """GET /api/whitelist/check/{email} returns correct status"""
        test_email = f"test_check_{uuid.uuid4().hex[:8]}@example.com"
        
        # Add email to whitelist
        requests.post(
            f"{BASE_URL}/api/whitelist/emails",
            json={"email": test_email, "expiry_datetime": None}
        )
        
        # Check if whitelisted
        response = requests.get(f"{BASE_URL}/api/whitelist/check/{test_email}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("is_whitelisted") == True
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/whitelist/emails/{test_email}")
    
    def test_check_non_whitelisted_email(self):
        """Non-whitelisted email returns is_whitelisted=False"""
        test_email = f"nonexistent_{uuid.uuid4().hex}@example.com"
        
        response = requests.get(f"{BASE_URL}/api/whitelist/check/{test_email}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("is_whitelisted") == False


# Cleanup fixture to remove test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_prompts():
    """Reset prompts to default after tests"""
    yield
    # Reset all prompts to default
    for agent_id in ["anam", "oppa", "diag", "palui"]:
        requests.post(f"{BASE_URL}/api/prompts/reset/{agent_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
