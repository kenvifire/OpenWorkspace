"""AES-256-GCM encryption matching the NestJS EncryptionService format.

Stored format: iv_hex:tag_hex:ciphertext_hex
"""
import hashlib
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from src.config import ENCRYPTION_SECRET

IV_LENGTH = 12


def _derive_key() -> bytes:
    return hashlib.sha256(ENCRYPTION_SECRET.encode()).digest()


def encrypt(plaintext: str) -> str:
    iv = os.urandom(IV_LENGTH)
    key = _derive_key()
    aesgcm = AESGCM(key)
    # AESGCM.encrypt returns ciphertext + 16-byte tag appended
    ct_with_tag = aesgcm.encrypt(iv, plaintext.encode(), None)
    ciphertext = ct_with_tag[:-16]
    tag = ct_with_tag[-16:]
    return f"{iv.hex()}:{tag.hex()}:{ciphertext.hex()}"


def decrypt(stored: str) -> str:
    iv_hex, tag_hex, ct_hex = stored.split(":")
    iv = bytes.fromhex(iv_hex)
    tag = bytes.fromhex(tag_hex)
    ciphertext = bytes.fromhex(ct_hex)

    key = _derive_key()
    aesgcm = AESGCM(key)
    # cryptography lib expects ciphertext + tag concatenated
    plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
    return plaintext.decode()
