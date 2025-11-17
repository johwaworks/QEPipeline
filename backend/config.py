"""
Configuration file for QEPipeline backend
"""
import os

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    from pathlib import Path
    # Load .env file from project root (parent directory)
    backend_dir = Path(__file__).parent
    project_root = backend_dir.parent
    env_path = project_root / '.env'
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    # python-dotenv not installed, skip loading .env file
    pass
except Exception:
    # Error loading .env file, continue with system environment variables
    pass

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb+srv://johwa:UDWScW728969d9Q7@cluster0.rrxr0hw.mongodb.net/?retryWrites=true&w=majority")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "qepipeline")

# Admin Configuration
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "NSRM0902@")

# Flask Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

