"""Tests for src/encryption.py — AES-256-GCM encrypt/decrypt."""
import sys
import types
import unittest.mock as mock

# ---------------------------------------------------------------------------
# Patch src.config before importing the encryption module so it never reads
# real environment variables.
# ---------------------------------------------------------------------------
TEST_SECRET = "test-secret-32-characters-long!!"

# Create a minimal fake config module
_fake_config = types.ModuleType("src.config")
_fake_config.ENCRYPTION_SECRET = TEST_SECRET  # type: ignore[attr-defined]
sys.modules.setdefault("src.config", _fake_config)
# Also make sure any already-cached copy uses our test secret
sys.modules["src.config"].ENCRYPTION_SECRET = TEST_SECRET  # type: ignore[attr-defined]

# Now import the module under test (config is already patched above)
from src.encryption import encrypt, decrypt  # noqa: E402


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_encrypt_returns_string():
    result = encrypt("hello world")
    assert isinstance(result, str)
    assert len(result) > 0


def test_decrypt_roundtrip():
    original = "super secret value"
    ciphertext = encrypt(original)
    assert decrypt(ciphertext) == original


def test_different_values_produce_different_ciphertext():
    ct_foo = encrypt("foo")
    ct_bar = encrypt("bar")
    assert ct_foo != ct_bar


def test_empty_string_roundtrip():
    ct = encrypt("")
    assert decrypt(ct) == ""


def test_encrypt_format_has_three_parts():
    """Encrypted string must follow iv_hex:tag_hex:ciphertext_hex format."""
    ct = encrypt("test")
    parts = ct.split(":")
    assert len(parts) == 3
    iv_hex, tag_hex, _ = parts
    # IV is 12 bytes → 24 hex chars; tag is 16 bytes → 32 hex chars
    assert len(iv_hex) == 24
    assert len(tag_hex) == 32


def test_encrypt_produces_different_iv_each_call():
    """Two encryptions of the same plaintext must use different IVs."""
    ct1 = encrypt("same plaintext")
    ct2 = encrypt("same plaintext")
    # Different ciphertexts (random IV)
    assert ct1 != ct2
    # But both decrypt correctly
    assert decrypt(ct1) == "same plaintext"
    assert decrypt(ct2) == "same plaintext"
