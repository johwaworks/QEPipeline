"""
Configuration file for QEPipeline backend
"""
import os

# MongoDB Configuration
# IMPORTANT: Set MONGODB_URI as an environment variable for security
# Do not hardcode credentials in source code
MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise ValueError("MONGODB_URI environment variable is not set. Please set it before running the application.")

MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "qepipeline")

# Admin Configuration
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise ValueError("ADMIN_PASSWORD environment variable is not set. Please set it before running the application.")

# Flask Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

