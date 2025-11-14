"""
Test MongoDB connection
"""
import sys
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from config import MONGODB_URI, MONGODB_DB_NAME

print("=" * 60)
print("MongoDB Connection Test")
print("=" * 60)
print(f"\nMongoDB URI: {MONGODB_URI[:50]}...")
print(f"Database Name: {MONGODB_DB_NAME}\n")

try:
    print("Attempting to connect...")
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
    
    # Test connection
    print("Testing connection...")
    client.admin.command('ping')
    print("✓ Connection successful!")
    
    # Get database
    db = client[MONGODB_DB_NAME]
    print(f"✓ Database '{MONGODB_DB_NAME}' accessed")
    
    # List collections
    collections = db.list_collection_names()
    print(f"\nCollections in database: {collections if collections else 'None'}")
    
    # Check for users collection
    if 'users' in collections:
        user_count = db.users.count_documents({})
        print(f"✓ Users collection exists with {user_count} user(s)")
        
        # Check for admin user
        admin = db.users.find_one({"username": "admin"})
        if admin:
            print("✓ Admin user exists")
        else:
            print("⚠ Admin user not found")
    
    if 'pending_registrations' in collections:
        pending_count = db.pending_registrations.count_documents({})
        print(f"✓ Pending registrations: {pending_count}")
    
    if 'projects' in collections:
        project_count = db.projects.count_documents({})
        print(f"✓ Projects: {project_count}")
    
    print("\n" + "=" * 60)
    print("Connection test completed successfully!")
    print("=" * 60)
    
    client.close()
    
except ServerSelectionTimeoutError as e:
    print(f"\n✗ Connection timeout: {e}")
    print("\nPossible issues:")
    print("1. Network connection problem")
    print("2. MongoDB Atlas IP whitelist - add your IP address")
    print("3. Incorrect connection string")
    print("4. MongoDB service is down")
    sys.exit(1)
    
except ConnectionFailure as e:
    print(f"\n✗ Connection failed: {e}")
    print("\nPlease check:")
    print("1. MongoDB connection string is correct")
    print("2. Network access is configured in MongoDB Atlas")
    print("3. Username and password are correct")
    sys.exit(1)
    
except Exception as e:
    print(f"\n✗ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

