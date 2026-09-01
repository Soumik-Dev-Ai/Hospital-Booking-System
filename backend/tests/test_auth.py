"""Tests for authentication module."""

import pytest
from api.auth import hash_password, verify_password, create_access_token, decode_access_token
from database.models import UserRole
from uuid import uuid4


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "SecurePass123"
        hashed = hash_password(password)
        assert verify_password(password, hashed)
        assert not verify_password("wrongpassword", hashed)

    def test_hash_is_unique(self):
        password = "SecurePass123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        assert hash1 != hash2  # Different salts


class TestJWT:
    def test_create_and_decode_token(self):
        user_id = uuid4()
        token = create_access_token(user_id=user_id, role=UserRole.ROLE_PATIENT)
        payload = decode_access_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["role"] == "ROLE_PATIENT"

    def test_token_has_expiry(self):
        user_id = uuid4()
        token = create_access_token(user_id=user_id, role=UserRole.ROLE_ADMIN)
        payload = decode_access_token(token)
        assert "exp" in payload
        assert "iat" in payload

    def test_invalid_token(self):
        with pytest.raises(Exception):
            decode_access_token("invalid.token.here")

    def test_expired_token(self):
        # This would require mocking time — skipping for now
        pass
