#!/usr/bin/env python3
"""Extract bytebytego.com cookies from Chrome's cookie database (macOS).
Decrypts httpOnly cookies using the Chrome Safe Storage keychain key.
Outputs a single cookie header string to stdout or writes to cookie file.
"""

import hashlib
import sqlite3
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("pip install cryptography", file=sys.stderr)
    sys.exit(1)

CHROME_COOKIES_DB = Path.home() / "Library/Application Support/Google/Chrome/Default/Cookies"
COOKIE_FILE = Path.home() / ".config/go-bytebytego/cookie.txt"


def get_chrome_key():
    """Get Chrome Safe Storage key from macOS Keychain."""
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "Chrome Safe Storage", "-w"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError("Could not get Chrome Safe Storage key from Keychain")
    return result.stdout.strip()


def decrypt_cookie(encrypted_value: bytes, key_16: bytes) -> str:
    """Decrypt Chrome v10 cookie (AES-128-CBC, skip 32-byte nonce artifact)."""
    if encrypted_value[:3] != b"v10":
        return encrypted_value.decode("utf-8", errors="replace")
    data = encrypted_value[3:]
    iv = b" " * 16
    cipher = Cipher(algorithms.AES(key_16), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()
    decrypted = decryptor.update(data) + decryptor.finalize()
    padding_len = decrypted[-1]
    if 1 <= padding_len <= 16:
        decrypted = decrypted[:-padding_len]
    # Newer Chrome prepends a 12-byte key version nonce before the actual
    # ciphertext. After CBC decryption, this produces 32 bytes of garbage
    # at the start (2 AES blocks). Skip them.
    if len(decrypted) > 32:
        return decrypted[32:].decode("utf-8", errors="replace")
    return decrypted.decode("utf-8", errors="replace")


def main():
    # Derive AES key from Chrome's password (PBKDF2, 1003 iterations, 16-byte key)
    chrome_password = get_chrome_key().encode("utf-8")
    key_16 = hashlib.pbkdf2_hmac("sha1", chrome_password, b"saltysalt", 1003, dklen=16)

    # Copy the DB to avoid locking issues if Chrome is running
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        tmp_path = tmp.name
        shutil.copy2(CHROME_COOKIES_DB, tmp_path)

    try:
        conn = sqlite3.connect(tmp_path)
        cursor = conn.execute(
            "SELECT name, encrypted_value FROM cookies "
            "WHERE host_key LIKE '%bytebytego.com%' ORDER BY name"
        )

        cookies = {}
        for name, encrypted_value in cursor:
            value = decrypt_cookie(encrypted_value, key_16)
            if value:
                cookies[name] = value

        conn.close()
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if not cookies:
        print("No bytebytego.com cookies found!", file=sys.stderr)
        sys.exit(1)

    cookie_str = "; ".join(f"{k}={v}" for k, v in sorted(cookies.items()))

    print(f"Found {len(cookies)} cookies: {', '.join(sorted(cookies.keys()))}", file=sys.stderr)

    if "--write" in sys.argv:
        COOKIE_FILE.parent.mkdir(parents=True, exist_ok=True)
        COOKIE_FILE.write_text(cookie_str + "\n", )
        COOKIE_FILE.chmod(0o600)
        print(f"Wrote {len(cookies)} cookies to {COOKIE_FILE}", file=sys.stderr)
    else:
        print(cookie_str)


if __name__ == "__main__":
    main()
