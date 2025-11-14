"""
MongoDB database connection and operations
"""
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError
import bcrypt
from datetime import datetime
from typing import Optional, Dict, List
from config import MONGODB_URI, MONGODB_DB_NAME, ADMIN_USERNAME, ADMIN_PASSWORD


class Database:
    """MongoDB database handler for QEPipeline"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.connect()
        self.initialize_database()
    
    def connect(self):
        """Connect to MongoDB"""
        try:
            self.client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            # Test connection
            self.client.admin.command('ping')
            self.db = self.client[MONGODB_DB_NAME]
            print(f"Connected to MongoDB: {MONGODB_DB_NAME}")
        except ConnectionFailure as e:
            print(f"MongoDB connection failed: {e}")
            print("\nPlease check:")
            print("1. MongoDB is installed and running (for local MongoDB)")
            print("2. Connection string is correct (for MongoDB Atlas)")
            print("3. Run 'python check_mongodb.py' to diagnose the issue")
            raise
    
    def create_or_update_admin(self, password: str):
        """Create or update admin user with specified password"""
        hashed_password = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        )
        
        admin_user = self.db.users.find_one({"username": ADMIN_USERNAME})
        if admin_user:
            # Update existing admin
            self.db.users.update_one(
                {"username": ADMIN_USERNAME},
                {"$set": {
                    "password_hash": hashed_password,
                    "is_admin": True,
                    "approved": True
                }}
            )
            print(f"Admin user '{ADMIN_USERNAME}' password updated")
        else:
            # Create new admin
            self.db.users.insert_one({
                "username": ADMIN_USERNAME,
                "password_hash": hashed_password,
                "approved": True,
                "is_admin": True,
                "created_at": datetime.utcnow()
            })
            print(f"Admin user '{ADMIN_USERNAME}' created")
    
    def initialize_database(self):
        """Initialize database with indexes and admin user"""
        # Create indexes
        self.db.users.create_index("username", unique=True)
        self.db.pending_registrations.create_index("username", unique=True)
        self.db.projects.create_index("owner")
        self.db.projects.create_index("members")
        self.db.projects.create_index("workers")
        self.db.shots.create_index("project_id")
        self.db.pending_deletions.create_index("project_id", unique=True)
        self.db.messages.create_index("project_id")
        self.db.messages.create_index("shot_id")
        self.db.messages.create_index("created_at")
        self.db.files.create_index("project_id")
        self.db.files.create_index("shot_id")
        self.db.files.create_index("created_at")
        # Chat rooms indexes
        self.db.chat_rooms.create_index("project_id")
        self.db.chat_rooms.create_index("shot_id")
        self.db.chat_rooms.create_index("participants")
        self.db.chat_rooms.create_index("chat_type")  # "project", "shot", "personal"
        self.db.messages.create_index("chat_room_id")
        
        # Create admin user if it doesn't exist (using default password)
        admin_user = self.db.users.find_one({"username": ADMIN_USERNAME})
        if not admin_user:
            self.create_or_update_admin(ADMIN_PASSWORD)
    
    def hash_password(self, password: str) -> bytes:
        """Hash a password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    def verify_password(self, password: str, password_hash) -> bool:
        """Verify a password against a hash"""
        # Handle both bytes and str types from MongoDB
        if isinstance(password_hash, str):
            password_hash = password_hash.encode('utf-8')
        elif not isinstance(password_hash, bytes):
            return False
        
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash)
        except Exception as e:
            print(f"Password verification error: {e}")
            return False
    
    def create_user(self, username: str, password: str, name: str = "", role: str = "", birthdate: str = "", approved: bool = False) -> bool:
        """
        Create a new user
        Returns True if successful, False if user already exists
        """
        try:
            # Check if user already exists
            if self.db.users.find_one({"username": username}):
                return False
            
            # Check if pending registration exists
            if self.db.pending_registrations.find_one({"username": username}):
                return False
            
            # Hash password
            password_hash = self.hash_password(password)
            
            # Prepare user data
            user_data = {
                "username": username,
                "password_hash": password_hash,
                "name": name,
                "role": role,
                "birthdate": birthdate,
                "created_at": datetime.utcnow()
            }
            
            if approved:
                # Create approved user
                user_data.update({
                    "approved": True,
                    "is_admin": False
                })
                self.db.users.insert_one(user_data)
            else:
                # Create pending registration
                self.db.pending_registrations.insert_one(user_data)
            
            return True
        except DuplicateKeyError:
            return False
    
    def get_user(self, username: str) -> Optional[Dict]:
        """Get user by username"""
        user = self.db.users.find_one({"username": username})
        if user:
            # Convert ObjectId to string and remove password_hash from response
            user['_id'] = str(user['_id'])
            return user
        return None
    
    def authenticate_user(self, username: str, password: str) -> bool:
        """Authenticate a user"""
        user = self.db.users.find_one({"username": username})
        if not user:
            return False
        
        if not user.get("approved", False):
            return False
        
        password_hash = user.get("password_hash")
        if not password_hash:
            return False
        
        # Verify password
        is_valid = self.verify_password(password, password_hash)
        
        # Update last activity time on successful authentication
        if is_valid:
            self.update_user_activity(username)
        
        return is_valid
    
    def update_user_activity(self, username: str) -> bool:
        """Update user's last activity time"""
        try:
            self.db.users.update_one(
                {"username": username},
                {"$set": {"last_activity": datetime.utcnow()}},
                upsert=False
            )
            return True
        except Exception as e:
            print(f"Error updating user activity: {e}")
            return False
    
    def send_partner_request(self, from_username: str, to_username: str) -> bool:
        """Send a partner request from one user to another"""
        try:
            # Check if target user exists
            target_user = self.db.users.find_one({"username": to_username})
            if not target_user:
                return False
            
            # Check if already a partner
            from_user = self.db.users.find_one({"username": from_username})
            if not from_user:
                return False
            
            partners = from_user.get("partners", [])
            if to_username in partners:
                return False  # Already a partner
            
            # Check if request already exists
            partner_requests = target_user.get("partner_requests", [])
            if from_username in partner_requests:
                return False  # Request already sent
            
            # Add request to target user's partner_requests
            self.db.users.update_one(
                {"username": to_username},
                {"$push": {"partner_requests": from_username}}
            )
            return True
        except Exception as e:
            print(f"Error sending partner request: {e}")
            return False
    
    def accept_partner_request(self, username: str, from_username: str) -> bool:
        """Accept a partner request"""
        try:
            user = self.db.users.find_one({"username": username})
            if not user:
                return False
            
            partner_requests = user.get("partner_requests", [])
            if from_username not in partner_requests:
                return False  # Request not found
            
            # Remove from requests and add to partners (both ways)
            self.db.users.update_one(
                {"username": username},
                {"$pull": {"partner_requests": from_username}, "$push": {"partners": from_username}}
            )
            
            # Also add to requester's partners
            self.db.users.update_one(
                {"username": from_username},
                {"$push": {"partners": username}}
            )
            
            return True
        except Exception as e:
            print(f"Error accepting partner request: {e}")
            return False
    
    def reject_partner_request(self, username: str, from_username: str) -> bool:
        """Reject a partner request"""
        try:
            self.db.users.update_one(
                {"username": username},
                {"$pull": {"partner_requests": from_username}}
            )
            return True
        except Exception as e:
            print(f"Error rejecting partner request: {e}")
            return False
    
    def get_partner_requests(self, username: str) -> List[Dict]:
        """Get all pending partner requests for a user"""
        try:
            user = self.db.users.find_one({"username": username})
            if not user:
                return []
            
            request_usernames = user.get("partner_requests", [])
            if not request_usernames:
                return []
            
            # Get requester user details
            requesters = list(self.db.users.find({"username": {"$in": request_usernames}}))
            
            result = []
            for requester in requesters:
                result.append({
                    "username": requester.get("username", ""),
                    "name": requester.get("name", requester.get("username", "")),
                    "role": requester.get("role", "")
                })
            
            return result
        except Exception as e:
            print(f"Error getting partner requests: {e}")
            return []
    
    def remove_partner(self, username: str, partner_username: str) -> bool:
        """Remove a partner (friend) from a user"""
        try:
            self.db.users.update_one(
                {"username": username},
                {"$pull": {"partners": partner_username}}
            )
            return True
        except Exception as e:
            print(f"Error removing partner: {e}")
            return False
    
    def get_partners(self, username: str) -> List[Dict]:
        """Get all partners (friends) of a user"""
        try:
            user = self.db.users.find_one({"username": username})
            if not user:
                return []
            
            partners_usernames = user.get("partners", [])
            if not partners_usernames:
                return []
            
            # Get partner user details
            partners = list(self.db.users.find({"username": {"$in": partners_usernames}}))
            
            result = []
            for partner in partners:
                result.append({
                    "username": partner.get("username", ""),
                    "name": partner.get("name", partner.get("username", "")),
                    "role": partner.get("role", "")
                })
            
            return result
        except Exception as e:
            print(f"Error getting partners: {e}")
            return []
    
    def get_active_users(self, minutes: int = 5) -> List[Dict]:
        """Get users who were active in the last N minutes"""
        try:
            from datetime import timedelta
            cutoff_time = datetime.utcnow() - timedelta(minutes=minutes)
            
            # Get users with last_activity field set and within the time window
            users = list(self.db.users.find({
                "approved": True,
                "last_activity": {"$exists": True, "$gte": cutoff_time}
            }).sort("last_activity", -1))
            
            user_list = []
            for user in users:
                last_activity = user.get("last_activity")
                user_list.append({
                    "username": user.get("username"),
                    "name": user.get("name", user.get("username")),
                    "role": user.get("role", ""),
                    "last_activity": last_activity.isoformat() if last_activity else None
                })
            return user_list
        except Exception as e:
            print(f"Error getting active users: {e}")
            return []
    
    def get_pending_registrations(self) -> List[Dict]:
        """Get all pending registrations"""
        pending = list(self.db.pending_registrations.find())
        for reg in pending:
            reg['_id'] = str(reg['_id'])
            # Don't return password_hash
            if 'password_hash' in reg:
                del reg['password_hash']
        return pending
    
    def approve_registration(self, username: str, approve: bool = True) -> bool:
        """
        Approve or reject a registration
        Returns True if successful, False if registration not found
        """
        pending = self.db.pending_registrations.find_one({"username": username})
        if not pending:
            return False
        
        if approve:
            # Move to users collection with all user data
            self.db.users.insert_one({
                "username": username,
                "password_hash": pending["password_hash"],
                "name": pending.get("name", ""),
                "role": pending.get("role", ""),
                "birthdate": pending.get("birthdate", ""),
                "approved": True,
                "is_admin": False,
                "created_at": pending.get("created_at", datetime.utcnow())
            })
        
        # Remove from pending
        self.db.pending_registrations.delete_one({"username": username})
        return True
    
    def get_user_profile(self, username: str) -> Optional[Dict]:
        """Get user profile information"""
        user = self.db.users.find_one({"username": username})
        if not user:
            return None
        
        # Return profile without sensitive data
        profile = {
            "_id": str(user["_id"]),
            "username": user.get("username"),
            "name": user.get("name", ""),
            "role": user.get("role", ""),
            "birthdate": user.get("birthdate", ""),
            "created_at": user.get("created_at"),
            "is_admin": user.get("is_admin", False)
        }
        return profile
    
    def is_admin(self, username: str, password: str) -> bool:
        """Check if user is admin with correct password"""
        user = self.db.users.find_one({"username": username})
        if not user:
            return False
        
        if not user.get("is_admin", False):
            return False
        
        password_hash = user.get("password_hash")
        if not password_hash:
            return False
        
        return self.verify_password(password, password_hash)
    
    def get_projects(self, username: str = None) -> List[Dict]:
        """Get all projects, optionally filtered by username"""
        query = {}
        if username:
            # Get projects where user is in workers list only
            query = {"workers": username}
        
        projects = list(self.db.projects.find(query).sort("updated_at", -1))
        for project in projects:
            project['_id'] = str(project['_id'])
        return projects
    
    def create_project(self, name: str, owner: str, director: str = "", deadline: str = "", 
                      production_status: str = "Pre-Production", vfx_supervisors: List[str] = None, 
                      members: List[str] = None, workers: List[str] = None, description: str = "") -> Optional[str]:
        """Create a new project"""
        try:
            if vfx_supervisors is None:
                vfx_supervisors = []
            if members is None:
                members = [owner]
            elif owner not in members:
                members.append(owner)
            if workers is None:
                workers = []
            
            result = self.db.projects.insert_one({
                "name": name,
                "description": description,
                "owner": owner,
                "director": director,
                "deadline": deadline,
                "production_status": production_status,
                "vfx_supervisors": vfx_supervisors,
                "members": members,
                "workers": workers,
                "status": "active",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            project_id = str(result.inserted_id)
            
            # Create project chat room automatically
            chat_room_id = self.create_chat_room(
                chat_type="project",
                name=name,
                project_id=project_id,
                created_by=owner
            )
            
            if chat_room_id and workers:
                # Add all workers to the chat room
                self.add_participants_to_chat_room(chat_room_id, workers)
            
            return project_id
        except Exception as e:
            print(f"Error creating project: {e}")
            return None
    
    def update_project(self, project_id: str, name: str = None, director: str = None, 
                      deadline: str = None, production_status: str = None, 
                      vfx_supervisors: List[str] = None, members: List[str] = None, 
                      workers: List[str] = None, description: str = None) -> bool:
        """Update a project"""
        try:
            from bson import ObjectId
            update_data = {
                "updated_at": datetime.utcnow()
            }
            
            if name is not None:
                update_data["name"] = name.strip()
            if director is not None:
                update_data["director"] = director.strip()
            if deadline is not None:
                update_data["deadline"] = deadline.strip()
            if production_status is not None:
                update_data["production_status"] = production_status.strip()
            if vfx_supervisors is not None:
                update_data["vfx_supervisors"] = vfx_supervisors
            if members is not None:
                update_data["members"] = members
            if workers is not None:
                update_data["workers"] = workers
            if description is not None:
                update_data["description"] = description.strip()
            
            result = self.db.projects.update_one(
                {"_id": ObjectId(project_id)},
                {"$set": update_data}
            )
            
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating project: {e}")
            return False
    
    def get_all_users(self) -> List[Dict]:
        """Get all approved users (for project member selection)"""
        users = list(self.db.users.find({"approved": True}))
        user_list = []
        for user in users:
            user_list.append({
                "username": user.get("username"),
                "name": user.get("name", ""),
                "role": user.get("role", "")
            })
        return user_list
    
    def get_project(self, project_id: str) -> Optional[Dict]:
        """Get a single project by ID"""
        try:
            from bson import ObjectId
            project = self.db.projects.find_one({"_id": ObjectId(project_id)})
            if project:
                project['_id'] = str(project['_id'])
                
                # Collect all usernames that need user info
                usernames_to_lookup = set()
                if 'vfx_supervisors' in project and project['vfx_supervisors']:
                    usernames_to_lookup.update(project['vfx_supervisors'])
                if 'members' in project and project['members']:
                    usernames_to_lookup.update(project['members'])
                if 'workers' in project and project['workers']:
                    usernames_to_lookup.update(project['workers'])
                
                # Fetch all users in one query
                user_map = {}
                if usernames_to_lookup:
                    users = list(self.db.users.find({"username": {"$in": list(usernames_to_lookup)}}))
                    for user in users:
                        username = user.get("username")
                        name = user.get("name", username)
                        role = user.get("role", "")
                        user_map[username] = {
                            "name": name,
                            "role": role
                        }
                
                # Convert VFX Supervisor usernames to names
                if 'vfx_supervisors' in project and project['vfx_supervisors']:
                    vfx_supervisors = project['vfx_supervisors']
                    vfx_supervisors_info = []
                    for username in vfx_supervisors:
                        user_info = user_map.get(username, {"name": username, "role": ""})
                        if isinstance(user_info, str):
                            # Backward compatibility: if user_map has string values
                            user_info = {"name": user_info, "role": ""}
                        vfx_supervisors_info.append({
                            "username": username,
                            "name": user_info.get("name", username),
                            "role": user_info.get("role", "")
                        })
                    project['vfx_supervisors_info'] = vfx_supervisors_info
                
                # Convert members usernames to names (for consistency)
                if 'members' in project and project['members']:
                    members = project['members']
                    members_info = []
                    for username in members:
                        user_info = user_map.get(username, {"name": username, "role": ""})
                        if isinstance(user_info, str):
                            # Backward compatibility: if user_map has string values
                            user_info = {"name": user_info, "role": ""}
                        members_info.append({
                            "username": username,
                            "name": user_info.get("name", username),
                            "role": user_info.get("role", "")
                        })
                    project['members_info'] = members_info
                
                # Convert workers usernames to names
                if 'workers' in project and project['workers']:
                    workers = project['workers']
                    workers_info = []
                    for username in workers:
                        user_info = user_map.get(username, {"name": username, "role": ""})
                        if isinstance(user_info, str):
                            # Backward compatibility: if user_map has string values
                            user_info = {"name": user_info, "role": ""}
                        workers_info.append({
                            "username": username,
                            "name": user_info.get("name", username),
                            "role": user_info.get("role", "")
                        })
                    project['workers_info'] = workers_info
                else:
                    project['workers'] = []
                    project['workers_info'] = []
                    
            return project
        except Exception as e:
            print(f"Error getting project: {e}")
            return None
    
    def get_shots(self, project_id: str) -> List[Dict]:
        """Get all shots for a project"""
        try:
            from bson import ObjectId
            print(f"Getting shots for project_id: {project_id}")
            shots = list(self.db.shots.find({"project_id": project_id}).sort("created_at", -1))
            print(f"Found {len(shots)} shots")
            for shot in shots:
                shot['_id'] = str(shot['_id'])
            return shots
        except Exception as e:
            print(f"Error getting shots: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_shot(self, shot_id: str) -> Optional[Dict]:
        """Get a single shot by ID"""
        try:
            from bson import ObjectId
            shot = self.db.shots.find_one({"_id": ObjectId(shot_id)})
            if shot:
                shot['_id'] = str(shot['_id'])
                # Get project info
                project = self.db.projects.find_one({"_id": ObjectId(shot.get("project_id"))})
                if project:
                    shot['project'] = {
                        "_id": str(project['_id']),
                        "name": project.get("name", ""),
                        "director": project.get("director", ""),
                        "production_status": project.get("production_status", "Pre-Production")
                    }
            return shot
        except Exception as e:
            print(f"Error getting shot: {e}")
            return None
    
    def update_shot_thumbnail(self, shot_id: str, thumbnail_path: Optional[str]) -> bool:
        """Update thumbnail path for a shot"""
        try:
            from bson import ObjectId
            if thumbnail_path:
                result = self.db.shots.update_one(
                    {"_id": ObjectId(shot_id)},
                    {"$set": {"thumbnail_path": thumbnail_path}}
                )
            else:
                result = self.db.shots.update_one(
                    {"_id": ObjectId(shot_id)},
                    {"$unset": {"thumbnail_path": ""}}
                )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot thumbnail: {e}")
            return False
    
    def update_shot_resolution(self, shot_id: str, width: int, height: int) -> bool:
        """Update resolution for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"resolution": {"width": width, "height": height}}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot resolution: {e}")
            return False
    
    def update_shot_description(self, shot_id: str, description: str) -> bool:
        """Update description for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"description": description, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot description: {e}")
            return False
    
    def update_shot_resolution_lock(self, shot_id: str, locked: bool) -> bool:
        """Update resolution lock status for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"resolution_locked": locked, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot resolution lock: {e}")
            return False
    
    def update_shot_description_lock(self, shot_id: str, locked: bool) -> bool:
        """Update description lock status for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"description_locked": locked, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot description lock: {e}")
            return False
    
    def update_shot_workers(self, shot_id: str, shot_workers: List[str]) -> bool:
        """Update shot workers (participants) for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"shot_workers": shot_workers, "updated_at": datetime.utcnow()}}
            )
            
            # Update shot chat room participants to match shot_workers
            if result.modified_count > 0 or result.matched_count > 0:
                # Find the shot's chat room
                shot_chat_room = self.db.chat_rooms.find_one({
                    "shot_id": ObjectId(shot_id),
                    "chat_type": "shot"
                })
                
                if shot_chat_room:
                    # Update participants to match shot_workers
                    self.set_chat_room_participants(str(shot_chat_room["_id"]), shot_workers)
            
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot workers: {e}")
            return False
    
    def update_shot_workers_assignment(self, shot_id: str, workers_assignment: Dict) -> bool:
        """Update workers assignment for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"workers_assignment": workers_assignment, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot workers assignment: {e}")
            return False
    
    def update_shot_duration(self, shot_id: str, start_frame: Optional[int], end_frame: Optional[int], total_frames: Optional[int]) -> bool:
        """Update duration for a shot"""
        try:
            from bson import ObjectId
            
            # Get current shot to preserve existing duration fields
            shot = self.db.shots.find_one({"_id": ObjectId(shot_id)})
            if not shot:
                return False
            
            # Get existing duration or create new one
            duration = shot.get("duration", {})
            
            # Update only provided fields
            if start_frame is not None:
                duration["start_frame"] = start_frame
            if end_frame is not None:
                duration["end_frame"] = end_frame
            if total_frames is not None:
                duration["total_frames"] = total_frames
            
            # Update shot with duration object
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"duration": duration, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot duration: {e}")
            return False
    
    def update_shot_duration_lock(self, shot_id: str, locked: bool) -> bool:
        """Update duration lock status for a shot"""
        try:
            from bson import ObjectId
            result = self.db.shots.update_one(
                {"_id": ObjectId(shot_id)},
                {"$set": {"duration_locked": locked, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0 or result.matched_count > 0
        except Exception as e:
            print(f"Error updating shot duration lock: {e}")
            return False
    
    def create_project_message(self, project_id: str, username: str, content: str) -> Optional[str]:
        """Create a new message for a project"""
        try:
            from bson import ObjectId
            
            # Get user info
            user = self.db.users.find_one({"username": username})
            author_name = user.get("name") if user else None
            
            message = {
                "project_id": ObjectId(project_id),
                "author_username": username,
                "author_name": author_name,
                "content": content,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            result = self.db.messages.insert_one(message)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating project message: {e}")
            return None
    
    def get_project_messages(self, project_id: str) -> List[Dict]:
        """Get all messages for a project"""
        try:
            from bson import ObjectId
            
            messages = list(self.db.messages.find(
                {"project_id": ObjectId(project_id)}
            ).sort("created_at", 1))
            
            # Convert ObjectId to string
            for message in messages:
                message["_id"] = str(message["_id"])
                message["project_id"] = str(message["project_id"])
                # Convert datetime to ISO format string
                if "created_at" in message:
                    message["created_at"] = message["created_at"].isoformat()
                if "updated_at" in message:
                    message["updated_at"] = message["updated_at"].isoformat()
            
            return messages
            
        except Exception as e:
            print(f"Error getting project messages: {e}")
            return []
    
    def get_project_message(self, message_id: str) -> Optional[Dict]:
        """Get a single message by ID"""
        try:
            from bson import ObjectId
            
            message = self.db.messages.find_one({"_id": ObjectId(message_id)})
            
            if message:
                message["_id"] = str(message["_id"])
                if "project_id" in message:
                    message["project_id"] = str(message["project_id"])
                if "shot_id" in message:
                    message["shot_id"] = str(message["shot_id"])
                # Convert datetime to ISO format string
                if "created_at" in message:
                    message["created_at"] = message["created_at"].isoformat()
                if "updated_at" in message:
                    message["updated_at"] = message["updated_at"].isoformat()
            
            return message
            
        except Exception as e:
            print(f"Error getting project message: {e}")
            return None
    
    def create_shot_message(self, shot_id: str, username: str, content: str, file_id: Optional[str] = None) -> Optional[str]:
        """Create a new message for a shot"""
        try:
            from bson import ObjectId
            
            # Get user info
            user = self.db.users.find_one({"username": username})
            author_name = user.get("name") if user else None
            
            message = {
                "shot_id": ObjectId(shot_id),
                "author_username": username,
                "author_name": author_name,
                "content": content,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            # Add file_id if provided
            if file_id:
                message["file_id"] = ObjectId(file_id)
            
            result = self.db.messages.insert_one(message)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating shot message: {e}")
            return None
    
    def get_shot_messages(self, shot_id: str) -> List[Dict]:
        """Get all messages for a shot"""
        try:
            from bson import ObjectId
            
            messages = list(self.db.messages.find(
                {"shot_id": ObjectId(shot_id)}
            ).sort("created_at", 1))
            
            # Convert ObjectId to string and include file info
            for message in messages:
                message["_id"] = str(message["_id"])
                message["shot_id"] = str(message["shot_id"])
                
                # If message has file_id, get file info
                if "file_id" in message:
                    file_id = message["file_id"]
                    # Convert ObjectId to string if needed
                    if not isinstance(file_id, str):
                        file_id = str(file_id)
                    message["file_id"] = file_id
                    
                    # Get file record
                    file_record = self.db.files.find_one({"_id": ObjectId(file_id)})
                    if file_record:
                        message["file"] = {
                            "id": str(file_record["_id"]),
                            "filename": file_record.get("filename", ""),
                            "file_type": file_record.get("file_type", ""),
                            "file_size": file_record.get("file_size", 0),
                        }
                
                # Convert datetime to ISO format string
                if "created_at" in message:
                    message["created_at"] = message["created_at"].isoformat()
                if "updated_at" in message:
                    message["updated_at"] = message["updated_at"].isoformat()
            
            return messages
            
        except Exception as e:
            print(f"Error getting shot messages: {e}")
            return []
    
    def get_shot_message(self, message_id: str) -> Optional[Dict]:
        """Get a single message by ID"""
        try:
            from bson import ObjectId
            
            message = self.db.messages.find_one({"_id": ObjectId(message_id)})
            
            if message:
                message["_id"] = str(message["_id"])
                if "project_id" in message:
                    message["project_id"] = str(message["project_id"])
                if "shot_id" in message:
                    message["shot_id"] = str(message["shot_id"])
                
                # If message has file_id, get file info
                if "file_id" in message:
                    file_id = message["file_id"]
                    # Convert ObjectId to string if needed
                    if not isinstance(file_id, str):
                        file_id = str(file_id)
                    message["file_id"] = file_id
                    
                    # Get file record
                    file_record = self.db.files.find_one({"_id": ObjectId(file_id)})
                    if file_record:
                        message["file"] = {
                            "id": str(file_record["_id"]),
                            "filename": file_record.get("filename", ""),
                            "file_type": file_record.get("file_type", ""),
                            "file_size": file_record.get("file_size", 0),
                        }
                
                # Convert datetime to ISO format string
                if "created_at" in message:
                    message["created_at"] = message["created_at"].isoformat()
                if "updated_at" in message:
                    message["updated_at"] = message["updated_at"].isoformat()
            
            return message
            
        except Exception as e:
            print(f"Error getting shot message: {e}")
            return None
    
    def create_project_file(self, project_id: str, username: str, filename: str, file_path: str, file_size: int, file_type: str) -> Optional[str]:
        """Create a new file record for a project"""
        try:
            from bson import ObjectId
            
            # Get user info
            user = self.db.users.find_one({"username": username})
            author_name = user.get("name") if user else None
            
            file_record = {
                "project_id": ObjectId(project_id),
                "author_username": username,
                "author_name": author_name,
                "filename": filename,
                "file_path": file_path,
                "file_size": file_size,
                "file_type": file_type,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            result = self.db.files.insert_one(file_record)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating project file: {e}")
            return None
    
    def get_project_files(self, project_id: str) -> List[Dict]:
        """Get all files for a project"""
        try:
            from bson import ObjectId
            
            files = list(self.db.files.find(
                {"project_id": ObjectId(project_id)}
            ).sort("created_at", -1))
            
            # Convert ObjectId to string
            for file_record in files:
                file_record["_id"] = str(file_record["_id"])
                file_record["project_id"] = str(file_record["project_id"])
                # Convert datetime to ISO format string
                if "created_at" in file_record:
                    file_record["created_at"] = file_record["created_at"].isoformat()
                if "updated_at" in file_record:
                    file_record["updated_at"] = file_record["updated_at"].isoformat()
            
            return files
            
        except Exception as e:
            print(f"Error getting project files: {e}")
            return []
    
    def create_shot_file(self, shot_id: str, username: str, filename: str, file_path: str, file_size: int, file_type: str) -> Optional[str]:
        """Create a new file record for a shot"""
        try:
            from bson import ObjectId
            
            # Get user info
            user = self.db.users.find_one({"username": username})
            author_name = user.get("name") if user else None
            
            file_record = {
                "shot_id": ObjectId(shot_id),
                "author_username": username,
                "author_name": author_name,
                "filename": filename,
                "file_path": file_path,
                "file_size": file_size,
                "file_type": file_type,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            result = self.db.files.insert_one(file_record)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating shot file: {e}")
            return None
    
    def get_shot_files(self, shot_id: str) -> List[Dict]:
        """Get all files for a shot"""
        try:
            from bson import ObjectId
            
            files = list(self.db.files.find(
                {"shot_id": ObjectId(shot_id)}
            ).sort("created_at", -1))
            
            # Convert ObjectId to string
            for file_record in files:
                file_record["_id"] = str(file_record["_id"])
                file_record["shot_id"] = str(file_record["shot_id"])
                # Convert datetime to ISO format string
                if "created_at" in file_record:
                    file_record["created_at"] = file_record["created_at"].isoformat()
                if "updated_at" in file_record:
                    file_record["updated_at"] = file_record["updated_at"].isoformat()
            
            return files
            
        except Exception as e:
            print(f"Error getting shot files: {e}")
            return []
    
    def delete_file(self, file_id: str) -> bool:
        """Delete a file record"""
        try:
            from bson import ObjectId
            
            result = self.db.files.delete_one({"_id": ObjectId(file_id)})
            return result.deleted_count > 0
            
        except Exception as e:
            print(f"Error deleting file: {e}")
            return False
    
    def create_shot(self, project_id: str, shot_name: str, description: str = "") -> Optional[str]:
        """Create a new shot"""
        try:
            from bson import ObjectId
            # Verify project exists
            project = self.db.projects.find_one({"_id": ObjectId(project_id)})
            if not project:
                return None
            
            result = self.db.shots.insert_one({
                "project_id": project_id,
                "shot_name": shot_name,
                "description": description,
                "status": "active",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            shot_id = str(result.inserted_id)
            
            # Create shot chat room automatically
            chat_room_id = self.create_chat_room(
                chat_type="shot",
                name=shot_name,
                project_id=project_id,
                shot_id=shot_id,
                created_by=None  # Can be set later if needed
            )
            
            if chat_room_id:
                # Get project workers to add to shot chat room
                project = self.db.projects.find_one({"_id": ObjectId(project_id)})
                if project and project.get("workers"):
                    workers = project.get("workers", [])
                    if workers:
                        self.add_participants_to_chat_room(chat_room_id, workers)
            
            return shot_id
        except Exception as e:
            print(f"Error creating shot: {e}")
            return None
    
    def request_project_deletion(self, project_id: str, username: str, project_name: str) -> bool:
        """Request project deletion (pending admin approval)"""
        try:
            from bson import ObjectId
            # Verify project exists
            project = self.db.projects.find_one({"_id": ObjectId(project_id)})
            if not project:
                return False
            
            # Check if deletion request already exists
            existing = self.db.pending_deletions.find_one({"project_id": project_id})
            if existing:
                return False
            
            self.db.pending_deletions.insert_one({
                "project_id": project_id,
                "project_name": project_name,
                "requested_by": username,
                "created_at": datetime.utcnow()
            })
            return True
        except Exception as e:
            print(f"Error requesting project deletion: {e}")
            return False
    
    def get_pending_deletions(self) -> List[Dict]:
        """Get all pending project deletion requests"""
        deletions = list(self.db.pending_deletions.find().sort("created_at", -1))
        for deletion in deletions:
            deletion['_id'] = str(deletion['_id'])
        return deletions
    
    def approve_project_deletion(self, project_id: str, approve: bool = True) -> bool:
        """Approve or reject project deletion"""
        try:
            from bson import ObjectId
            deletion = self.db.pending_deletions.find_one({"project_id": project_id})
            if not deletion:
                return False
            
            if approve:
                # Delete project and all associated shots
                self.db.projects.delete_one({"_id": ObjectId(project_id)})
                self.db.shots.delete_many({"project_id": project_id})
            
            # Remove deletion request
            self.db.pending_deletions.delete_one({"project_id": project_id})
            return True
        except Exception as e:
            print(f"Error approving project deletion: {e}")
            return False
    
    def create_chat_room(self, chat_type: str, name: str, project_id: str = None, shot_id: str = None, created_by: str = None) -> Optional[str]:
        """Create a new chat room"""
        try:
            from bson import ObjectId
            
            chat_room = {
                "chat_type": chat_type,  # "project", "shot", "personal"
                "name": name,
                "participants": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            if project_id:
                chat_room["project_id"] = ObjectId(project_id)
            if shot_id:
                chat_room["shot_id"] = ObjectId(shot_id)
            if created_by:
                chat_room["created_by"] = created_by
            
            result = self.db.chat_rooms.insert_one(chat_room)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating chat room: {e}")
            return None
    
    def get_chat_room(self, chat_room_id: str) -> Optional[Dict]:
        """Get a chat room by ID"""
        try:
            from bson import ObjectId
            
            chat_room = self.db.chat_rooms.find_one({"_id": ObjectId(chat_room_id)})
            if chat_room:
                chat_room["_id"] = str(chat_room["_id"])
                if "project_id" in chat_room:
                    chat_room["project_id"] = str(chat_room["project_id"])
                if "shot_id" in chat_room:
                    chat_room["shot_id"] = str(chat_room["shot_id"])
                if "created_at" in chat_room:
                    chat_room["created_at"] = chat_room["created_at"].isoformat()
                if "updated_at" in chat_room:
                    chat_room["updated_at"] = chat_room["updated_at"].isoformat()
                
                # Get last message time and content for this chat room
                last_message = self.db.messages.find_one(
                    {"chat_room_id": ObjectId(chat_room["_id"])},
                    sort=[("created_at", -1)]
                )
                if last_message:
                    if "created_at" in last_message:
                        chat_room["lastMessageTime"] = last_message["created_at"].isoformat()
                    if "content" in last_message:
                        chat_room["lastMessage"] = last_message.get("content", "")[:100]  # First 100 chars
                    if "author_username" in last_message:
                        chat_room["lastMessageAuthor"] = last_message.get("author_username", "")
                
                return chat_room
            
        except Exception as e:
            print(f"Error getting chat room: {e}")
            return None
    
    def get_project_chat_room(self, project_id: str) -> Optional[Dict]:
        """Get or create chat room for a project"""
        try:
            from bson import ObjectId
            
            # Check if chat room already exists
            chat_room = self.db.chat_rooms.find_one({"project_id": ObjectId(project_id), "chat_type": "project"})
            
            if chat_room:
                chat_room["_id"] = str(chat_room["_id"])
                chat_room["project_id"] = str(chat_room["project_id"])
                if "shot_id" in chat_room:
                    chat_room["shot_id"] = str(chat_room["shot_id"])
                if "created_at" in chat_room:
                    chat_room["created_at"] = chat_room["created_at"].isoformat()
                if "updated_at" in chat_room:
                    chat_room["updated_at"] = chat_room["updated_at"].isoformat()
                
                # Get last message time and content for this chat room
                last_message = self.db.messages.find_one(
                    {"chat_room_id": ObjectId(chat_room["_id"])},
                    sort=[("created_at", -1)]
                )
                if last_message:
                    if "created_at" in last_message:
                        chat_room["lastMessageTime"] = last_message["created_at"].isoformat()
                    if "content" in last_message:
                        chat_room["lastMessage"] = last_message.get("content", "")[:100]  # First 100 chars
                    if "author_username" in last_message:
                        chat_room["lastMessageAuthor"] = last_message.get("author_username", "")
                
                return chat_room
            
            # Create new chat room
            project = self.get_project(project_id)
            if not project:
                return None
            
            chat_room_id = self.create_chat_room(
                chat_type="project",
                name=project.get("name", f"Project {project_id}"),
                project_id=project_id,
                created_by=project.get("owner")
            )
            
            if chat_room_id:
                # Add all workers to the chat room
                workers = project.get("workers", [])
                if workers:
                    self.add_participants_to_chat_room(chat_room_id, workers)
                
                return self.get_chat_room(chat_room_id)
            
            return None
            
        except Exception as e:
            print(f"Error getting project chat room: {e}")
            return None
    
    def get_shot_chat_room(self, shot_id: str) -> Optional[Dict]:
        """Get or create chat room for a shot"""
        try:
            from bson import ObjectId
            
            # Check if chat room already exists
            chat_room = self.db.chat_rooms.find_one({"shot_id": ObjectId(shot_id), "chat_type": "shot"})
            
            if chat_room:
                chat_room["_id"] = str(chat_room["_id"])
                if "project_id" in chat_room:
                    chat_room["project_id"] = str(chat_room["project_id"])
                chat_room["shot_id"] = str(chat_room["shot_id"])
                if "created_at" in chat_room:
                    chat_room["created_at"] = chat_room["created_at"].isoformat()
                if "updated_at" in chat_room:
                    chat_room["updated_at"] = chat_room["updated_at"].isoformat()
                
                # Get last message time and content for this chat room
                last_message = self.db.messages.find_one(
                    {"chat_room_id": ObjectId(chat_room["_id"])},
                    sort=[("created_at", -1)]
                )
                if last_message:
                    if "created_at" in last_message:
                        chat_room["lastMessageTime"] = last_message["created_at"].isoformat()
                    if "content" in last_message:
                        chat_room["lastMessage"] = last_message.get("content", "")[:100]  # First 100 chars
                    if "author_username" in last_message:
                        chat_room["lastMessageAuthor"] = last_message.get("author_username", "")
                
                return chat_room
            
            # Create new chat room
            shot = self.get_shot(shot_id)
            if not shot:
                return None
            
            shot_name = shot.get("shot_name") or shot.get("name") or f"Shot {shot_id}"
            project_id = shot.get("project_id")
            
            chat_room_id = self.create_chat_room(
                chat_type="shot",
                name=shot_name,
                project_id=str(project_id) if project_id else None,
                shot_id=shot_id,
                created_by=shot.get("created_by")
            )
            
            if chat_room_id:
                # Get shot workers (if exists), otherwise use project workers
                shot_workers = shot.get("shot_workers", [])
                
                if shot_workers:
                    # Use shot_workers if specified
                    self.set_chat_room_participants(chat_room_id, shot_workers)
                else:
                    # Otherwise, get project to add workers
                    if project_id:
                        project = self.get_project(str(project_id))
                        if project:
                            workers = project.get("workers", [])
                            if workers:
                                self.add_participants_to_chat_room(chat_room_id, workers)
                
                return self.get_chat_room(chat_room_id)
            
            return None
            
        except Exception as e:
            print(f"Error getting shot chat room: {e}")
            return None
    
    def add_participants_to_chat_room(self, chat_room_id: str, participants: List[str]) -> bool:
        """Add participants to a chat room"""
        try:
            from bson import ObjectId
            
            chat_room = self.db.chat_rooms.find_one({"_id": ObjectId(chat_room_id)})
            if not chat_room:
                return False
            
            current_participants = set(chat_room.get("participants", []))
            new_participants = set(participants)
            all_participants = list(current_participants | new_participants)
            
            self.db.chat_rooms.update_one(
                {"_id": ObjectId(chat_room_id)},
                {
                    "$set": {
                        "participants": all_participants,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return True
            
        except Exception as e:
            print(f"Error adding participants to chat room: {e}")
            return False
    
    def set_chat_room_participants(self, chat_room_id: str, participants: List[str]) -> bool:
        """Set chat room participants (replace existing participants)"""
        try:
            from bson import ObjectId
            
            chat_room = self.db.chat_rooms.find_one({"_id": ObjectId(chat_room_id)})
            if not chat_room:
                return False
            
            # Set participants to the exact list provided
            self.db.chat_rooms.update_one(
                {"_id": ObjectId(chat_room_id)},
                {
                    "$set": {
                        "participants": participants,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return True
            
        except Exception as e:
            print(f"Error setting chat room participants: {e}")
            return False
    
    def get_chat_room_messages(self, chat_room_id: str, limit: int = 100) -> List[Dict]:
        """Get messages for a chat room"""
        try:
            from bson import ObjectId
            
            messages = list(self.db.messages.find(
                {"chat_room_id": ObjectId(chat_room_id)}
            ).sort("created_at", -1).limit(limit))
            
            # Reverse to get chronological order
            messages.reverse()
            
            # Convert ObjectId to string
            for message in messages:
                message["_id"] = str(message["_id"])
                if "chat_room_id" in message:
                    message["chat_room_id"] = str(message["chat_room_id"])
                if "project_id" in message:
                    message["project_id"] = str(message["project_id"])
                if "shot_id" in message:
                    message["shot_id"] = str(message["shot_id"])
                if "created_at" in message:
                    message["created_at"] = message["created_at"].isoformat()
                if "updated_at" in message:
                    message["updated_at"] = message["updated_at"].isoformat()
                # Ensure read_by field exists (for old messages)
                if "read_by" not in message:
                    message["read_by"] = []
                # Ensure read_by is a list of strings
                if isinstance(message.get("read_by"), list):
                    message["read_by"] = [str(r) for r in message["read_by"]]
                else:
                    message["read_by"] = []
            
            return messages
            
        except Exception as e:
            print(f"Error getting chat room messages: {e}")
            return []
    
    def create_chat_message(self, chat_room_id: str, username: str, content: str) -> Optional[str]:
        """Create a new message in a chat room"""
        try:
            from bson import ObjectId
            
            # Get user info
            user = self.db.users.find_one({"username": username})
            author_name = user.get("name") if user else None
            
            # Get chat room info
            chat_room = self.db.chat_rooms.find_one({"_id": ObjectId(chat_room_id)})
            if not chat_room:
                return None
            
            message = {
                "chat_room_id": ObjectId(chat_room_id),
                "author_username": username,
                "author_name": author_name,
                "content": content,
                "read_by": [],  # List of usernames who have read this message
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            # Add project_id or shot_id if available
            if "project_id" in chat_room:
                message["project_id"] = chat_room["project_id"]
            if "shot_id" in chat_room:
                message["shot_id"] = chat_room["shot_id"]
            
            result = self.db.messages.insert_one(message)
            
            # Update chat room's updated_at
            self.db.chat_rooms.update_one(
                {"_id": ObjectId(chat_room_id)},
                {"$set": {"updated_at": datetime.utcnow()}}
            )
            
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error creating chat message: {e}")
            return None
    
    def mark_chat_room_messages_as_read(self, chat_room_id: str, username: str) -> bool:
        """Mark all messages in a chat room as read by a user"""
        try:
            from bson import ObjectId
            
            # Update all messages in the chat room that are not authored by the reader
            # Add username to read_by array if not already present
            result = self.db.messages.update_many(
                {
                    "chat_room_id": ObjectId(chat_room_id),
                    "author_username": {"$ne": username},  # Don't mark own messages as read
                    "read_by": {"$ne": username}  # Only if not already read
                },
                {
                    "$addToSet": {"read_by": username},  # Add username to read_by array
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            return result.modified_count > 0 or result.matched_count > 0
            
        except Exception as e:
            print(f"Error marking messages as read: {e}")
            return False
    
    def get_or_create_personal_chat_room(self, username1: str, username2: str) -> Optional[Dict]:
        """Get or create a personal chat room between two users"""
        try:
            from bson import ObjectId
            
            # Sort usernames to ensure consistent room lookup
            sorted_usernames = sorted([username1, username2])
            
            # Check if personal chat room already exists
            # Find rooms with both users and exactly 2 participants
            all_rooms = list(self.db.chat_rooms.find({
                "chat_type": "personal",
                "participants": {"$all": sorted_usernames}
            }))
            
            # Filter to get only rooms with exactly 2 participants
            chat_room = None
            for room in all_rooms:
                if len(room.get("participants", [])) == 2:
                    chat_room = room
                    break
            
            if chat_room:
                chat_room["_id"] = str(chat_room["_id"])
                if "project_id" in chat_room:
                    chat_room["project_id"] = str(chat_room["project_id"])
                if "shot_id" in chat_room:
                    chat_room["shot_id"] = str(chat_room["shot_id"])
                if "created_at" in chat_room:
                    chat_room["created_at"] = chat_room["created_at"].isoformat()
                if "updated_at" in chat_room:
                    chat_room["updated_at"] = chat_room["updated_at"].isoformat()
                
                # For personal chat rooms, add display_name with partner's name only
                # (excluding current user's name)
                # username1 is the requesting user (current user), so show username2's name
                if chat_room.get("chat_type") == "personal":
                    participants = chat_room.get("participants", [])
                    if len(participants) == 2:
                        # username1 is the current user, so find username2 (the partner)
                        partner_username = username2
                        
                        # Verify that username2 is actually in participants
                        if username2 not in participants:
                            # Fallback: find the one that's not username1
                            partner_username = participants[0] if participants[0] != username1 else participants[1]
                        
                        # Get partner's info to get their display name - MUST use name, not username
                        partner_info = self.get_user(partner_username)
                        if partner_info:
                            # Force get name field from database
                            partner_name = partner_info.get("name")
                            # Check if name exists and is not empty
                            if partner_name and str(partner_name).strip():
                                chat_room["display_name"] = str(partner_name).strip()
                            else:
                                # If name is not set, STILL try to use name from database directly
                                # Fallback: check database directly one more time
                                db_user = self.db.users.find_one({"username": partner_username})
                                if db_user and db_user.get("name") and str(db_user.get("name")).strip():
                                    chat_room["display_name"] = str(db_user.get("name")).strip()
                                else:
                                    # Last resort: use username
                                    chat_room["display_name"] = partner_username
                        else:
                            # If user not found, use username
                            chat_room["display_name"] = partner_username
                
                return chat_room
            
            # Check if users exist
            user1 = self.get_user(username1)
            user2 = self.get_user(username2)
            
            if not user1 or not user2:
                return None
            
            # Verify they are partners
            partners1 = user1.get("partners", [])
            partners2 = user2.get("partners", [])
            
            if username2 not in partners1 or username1 not in partners2:
                return None
            
            # Get user names for chat room name
            # Use partner's name only (exclude current user's name)
            name1 = user1.get("name") or username1
            name2 = user2.get("name") or username2
            # For now, use both names. Frontend will filter out current user's name
            room_name = f"{name1} & {name2}"
            
            # Create personal chat room
            chat_room_id = self.create_chat_room(
                chat_type="personal",
                name=room_name,
                created_by=username1
            )
            
            if chat_room_id:
                # Add both users as participants
                self.add_participants_to_chat_room(chat_room_id, [username1, username2])
                chat_room = self.get_chat_room(chat_room_id)
                
                # Set display_name with partner's name only (for the requesting user - username1)
                if chat_room:
                    # username1 is the requesting user, so show username2's name
                    # Force get name field from user2 object
                    partner_name = user2.get("name")
                    # Check if name exists and is not empty
                    if partner_name and str(partner_name).strip():
                        chat_room["display_name"] = str(partner_name).strip()
                    else:
                        # If name is not set, check database directly
                        db_user = self.db.users.find_one({"username": username2})
                        if db_user and db_user.get("name") and str(db_user.get("name")).strip():
                            chat_room["display_name"] = str(db_user.get("name")).strip()
                        else:
                            # Last resort: use username
                            chat_room["display_name"] = username2
                
                return chat_room
            
            return None
            
        except Exception as e:
            print(f"Error getting or creating personal chat room: {e}")
            return None
    
    def get_user_personal_chat_rooms(self, username: str) -> List[Dict]:
        """Get all personal chat rooms for a user"""
        try:
            from bson import ObjectId
            
            chat_rooms = list(self.db.chat_rooms.find({
                "chat_type": "personal",
                "participants": username
            }).sort("updated_at", -1))
            
            for chat_room in chat_rooms:
                chat_room["_id"] = str(chat_room["_id"])
                if "project_id" in chat_room:
                    chat_room["project_id"] = str(chat_room["project_id"])
                if "shot_id" in chat_room:
                    chat_room["shot_id"] = str(chat_room["shot_id"])
                if "created_at" in chat_room:
                    chat_room["created_at"] = chat_room["created_at"].isoformat()
                if "updated_at" in chat_room:
                    chat_room["updated_at"] = chat_room["updated_at"].isoformat()
                
                # For personal chat rooms, add display_name with partner's name only
                # (excluding current user's name)
                participants = chat_room.get("participants", [])
                if len(participants) == 2:
                    # Find the partner (not the current user - username parameter)
                    partner_username = None
                    if participants[0] == username:
                        partner_username = participants[1]
                    else:
                        partner_username = participants[0]
                    
                    # Get partner's info to get their display name - MUST use name, not username
                    partner_info = self.get_user(partner_username)
                    if partner_info:
                        # Force get name field from database
                        partner_name = partner_info.get("name")
                        # Check if name exists and is not empty
                        if partner_name and str(partner_name).strip():
                            chat_room["display_name"] = str(partner_name).strip()
                        else:
                            # If name is not set, STILL try to use name from database directly
                            # Fallback: check database directly one more time
                            db_user = self.db.users.find_one({"username": partner_username})
                            if db_user and db_user.get("name") and str(db_user.get("name")).strip():
                                chat_room["display_name"] = str(db_user.get("name")).strip()
                            else:
                                # Last resort: use username
                                chat_room["display_name"] = partner_username
                    else:
                        # If user not found, use username
                        chat_room["display_name"] = partner_username
            
            return chat_rooms
            
        except Exception as e:
            print(f"Error getting user personal chat rooms: {e}")
            return []
    
    def get_user_all_chat_rooms(self, username: str) -> List[Dict]:
        """Get all chat rooms for a user (project, shot, and personal)"""
        try:
            from bson import ObjectId
            
            all_chat_rooms = []
            
            # Get project chat rooms where user is a worker
            # Create chat rooms if they don't exist
            projects = self.db.projects.find({"workers": username})
            for project in projects:
                project_id = str(project["_id"])
                project_chat_room = self.db.chat_rooms.find_one({
                    "chat_type": "project",
                    "project_id": ObjectId(project_id)
                })
                
                # If chat room doesn't exist, create it
                if not project_chat_room:
                    chat_room_id = self.create_chat_room(
                        chat_type="project",
                        name=project.get("name", f"Project {project_id}"),
                        project_id=project_id,
                        created_by=project.get("owner")
                    )
                    if chat_room_id:
                        # Add all workers to the chat room
                        workers = project.get("workers", [])
                        if workers:
                            self.add_participants_to_chat_room(chat_room_id, workers)
                        # Get the created chat room
                        project_chat_room = self.get_chat_room(chat_room_id)
                
                if project_chat_room:
                    project_chat_room["_id"] = str(project_chat_room["_id"])
                    project_chat_room["project_id"] = str(project_chat_room["project_id"])
                    if "shot_id" in project_chat_room:
                        project_chat_room["shot_id"] = str(project_chat_room["shot_id"])
                    if "created_at" in project_chat_room:
                        project_chat_room["created_at"] = project_chat_room["created_at"].isoformat()
                    if "updated_at" in project_chat_room:
                        project_chat_room["updated_at"] = project_chat_room["updated_at"].isoformat()
                    # Add project name for display
                    project_chat_room["display_name"] = f"{project.get('name', 'Project')} Chat"
                    
                    # Get last message time and content for this chat room
                    last_message = self.db.messages.find_one(
                        {"chat_room_id": ObjectId(project_chat_room["_id"])},
                        sort=[("created_at", -1)]
                    )
                    if last_message:
                        if "created_at" in last_message:
                            project_chat_room["lastMessageTime"] = last_message["created_at"].isoformat()
                        if "content" in last_message:
                            project_chat_room["lastMessage"] = last_message.get("content", "")[:100]  # First 100 chars
                        if "author_username" in last_message:
                            project_chat_room["lastMessageAuthor"] = last_message.get("author_username", "")
                    
                    # Get unread message count for this user
                    unread_count = self.db.messages.count_documents({
                        "chat_room_id": ObjectId(project_chat_room["_id"]),
                        "author_username": {"$ne": username},  # Not messages sent by the user
                        "read_by": {"$ne": username}  # Not read by the user
                    })
                    project_chat_room["unreadCount"] = unread_count
                    
                    all_chat_rooms.append(project_chat_room)
            
            # Get shot chat rooms for projects where user is a worker
            # Create chat rooms if they don't exist
            for project in projects:
                project_id = str(project["_id"])
                # Try both string and ObjectId format for project_id in shots
                shots = list(self.db.shots.find({"project_id": project_id}))
                shots.extend(list(self.db.shots.find({"project_id": ObjectId(project_id)})))
                # Remove duplicates
                seen_shot_ids = set()
                unique_shots = []
                for shot in shots:
                    shot_id_str = str(shot["_id"])
                    if shot_id_str not in seen_shot_ids:
                        seen_shot_ids.add(shot_id_str)
                        unique_shots.append(shot)
                
                for shot in unique_shots:
                    shot_id = str(shot["_id"])
                    
                    # Try to find existing chat room
                    # Try both ObjectId and string formats
                    shot_chat_room = None
                    try:
                        # First try with ObjectId
                        shot_chat_room = self.db.chat_rooms.find_one({
                            "chat_type": "shot",
                            "shot_id": ObjectId(shot_id)
                        })
                        # If not found, try with string
                        if not shot_chat_room:
                            shot_chat_room = self.db.chat_rooms.find_one({
                                "chat_type": "shot",
                                "shot_id": shot_id
                            })
                    except Exception as e:
                        print(f"Error finding shot chat room for shot {shot_id}: {e}")
                        try:
                            # Fallback to string format
                            shot_chat_room = self.db.chat_rooms.find_one({
                                "chat_type": "shot",
                                "shot_id": shot_id
                            })
                        except Exception as e2:
                            print(f"Error finding shot chat room with string format for shot {shot_id}: {e2}")
                            shot_chat_room = None
                    
                    # If chat room doesn't exist, create it
                    if not shot_chat_room:
                        shot_name = shot.get("shot_name") or shot.get("name") or f"Shot {shot_id}"
                        chat_room_id = self.create_chat_room(
                            chat_type="shot",
                            name=shot_name,
                            project_id=project_id,
                            shot_id=shot_id,
                            created_by=None
                        )
                        if chat_room_id:
                            # Get shot workers (if exists), otherwise use project workers
                            shot_workers = shot.get("shot_workers", [])
                            if shot_workers:
                                # Use shot_workers if specified
                                self.set_chat_room_participants(chat_room_id, shot_workers)
                            else:
                                # Otherwise, get project workers to add to shot chat room
                                workers = project.get("workers", [])
                                if workers:
                                    self.add_participants_to_chat_room(chat_room_id, workers)
                            # Get the created chat room (already formatted)
                            shot_chat_room = self.get_chat_room(chat_room_id)
                    
                    # Only add shot chat room if user is in participants (shot_workers)
                    if shot_chat_room:
                        # Check if user is in participants
                        participants = shot_chat_room.get("participants", [])
                        if username not in participants:
                            # User is not a participant, skip this chat room
                            continue
                        # Format chat room data (if not already formatted by get_chat_room)
                        if isinstance(shot_chat_room.get("_id"), ObjectId):
                            shot_chat_room["_id"] = str(shot_chat_room["_id"])
                        if "project_id" in shot_chat_room and isinstance(shot_chat_room["project_id"], ObjectId):
                            shot_chat_room["project_id"] = str(shot_chat_room["project_id"])
                        if "shot_id" in shot_chat_room and isinstance(shot_chat_room["shot_id"], ObjectId):
                            shot_chat_room["shot_id"] = str(shot_chat_room["shot_id"])
                        if "created_at" in shot_chat_room and not isinstance(shot_chat_room["created_at"], str):
                            shot_chat_room["created_at"] = shot_chat_room["created_at"].isoformat()
                        if "updated_at" in shot_chat_room and not isinstance(shot_chat_room["updated_at"], str):
                            shot_chat_room["updated_at"] = shot_chat_room["updated_at"].isoformat()
                        
                        # Add shot name for display
                        shot_name = shot.get("shot_name") or shot.get("name") or f"Shot {shot_id}"
                        shot_chat_room["display_name"] = f"{shot_name} Chat"
                        
                        # Get last message time and content for this chat room
                        last_message = self.db.messages.find_one(
                            {"chat_room_id": ObjectId(shot_chat_room["_id"])},
                            sort=[("created_at", -1)]
                        )
                        if last_message:
                            if "created_at" in last_message:
                                shot_chat_room["lastMessageTime"] = last_message["created_at"].isoformat()
                            if "content" in last_message:
                                shot_chat_room["lastMessage"] = last_message.get("content", "")[:100]  # First 100 chars
                            if "author_username" in last_message:
                                shot_chat_room["lastMessageAuthor"] = last_message.get("author_username", "")
                        
                        # Get unread message count for this user
                        unread_count = self.db.messages.count_documents({
                            "chat_room_id": ObjectId(shot_chat_room["_id"]),
                            "author_username": {"$ne": username},  # Not messages sent by the user
                            "read_by": {"$ne": username}  # Not read by the user
                        })
                        shot_chat_room["unreadCount"] = unread_count
                        
                        # Only add if not already in list (avoid duplicates)
                        if not any(room.get("_id") == shot_chat_room.get("_id") for room in all_chat_rooms):
                            all_chat_rooms.append(shot_chat_room)
            
            # Get personal chat rooms
            personal_chat_rooms = self.get_user_personal_chat_rooms(username)
            for chat_room in personal_chat_rooms:
                # Personal chat room name is already set, use it as display_name
                chat_room["display_name"] = chat_room.get("name", "Personal Chat")
                
                # Get last message time and content for this chat room
                if "_id" in chat_room:
                    last_message = self.db.messages.find_one(
                        {"chat_room_id": ObjectId(chat_room["_id"])},
                        sort=[("created_at", -1)]
                    )
                    if last_message:
                        if "created_at" in last_message:
                            chat_room["lastMessageTime"] = last_message["created_at"].isoformat()
                        if "content" in last_message:
                            chat_room["lastMessage"] = last_message.get("content", "")[:100]  # First 100 chars
                        if "author_username" in last_message:
                            chat_room["lastMessageAuthor"] = last_message.get("author_username", "")
                    
                    # Get unread message count for this user
                    unread_count = self.db.messages.count_documents({
                        "chat_room_id": ObjectId(chat_room["_id"]),
                        "author_username": {"$ne": username},  # Not messages sent by the user
                        "read_by": {"$ne": username}  # Not read by the user
                    })
                    chat_room["unreadCount"] = unread_count
                
                all_chat_rooms.append(chat_room)
            
            # Sort by updated_at (most recent first)
            all_chat_rooms.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            
            return all_chat_rooms
            
        except Exception as e:
            print(f"Error getting user all chat rooms: {e}")
            return []
    
    def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()


# Global database instance
db = Database()

