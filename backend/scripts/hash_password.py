"""Generate a bcrypt password hash for DOCTOR_PASSWORD_HASH in .env"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from core.security import hash_password

if __name__ == "__main__":
    import getpass
    pw = getpass.getpass("Enter doctor password: ")
    print(f"\nDOCTOR_PASSWORD_HASH={hash_password(pw)}")