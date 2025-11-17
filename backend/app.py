"""
QEPipeline Backend - Flask API with MongoDB
"""
from flask import Flask, jsonify, request, send_file, session
from flask_cors import CORS
from database import db
from config import ADMIN_USERNAME
import os
from werkzeug.utils import secure_filename
from bson import ObjectId
from datetime import datetime, timezone



def create_app():
    """Create and configure Flask app"""
    app = Flask(__name__)
    app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # CORS configuration - allow all origins including Amplify and ngrok
    # Note: flask-cors handles CORS headers automatically, so we don't need to add them manually
    CORS(app, 
         origins="*", 
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "ngrok-skip-browser-warning", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         max_age=3600)
    
    # Handle OPTIONS requests for CORS preflight (flask-cors handles this, but we ensure it works)
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            # flask-cors will handle this, but we can add custom logic here if needed
            pass
    
    # Configure upload folders
    SHOTS_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "shots")
    PROJECTS_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "projects")
    app.config['SHOTS_UPLOAD_FOLDER'] = SHOTS_UPLOAD_FOLDER
    app.config['PROJECTS_UPLOAD_FOLDER'] = PROJECTS_UPLOAD_FOLDER
    app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size
    
    # Create upload directories if they don't exist
    os.makedirs(SHOTS_UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(PROJECTS_UPLOAD_FOLDER, exist_ok=True)
    
    @app.route("/", methods=["GET"])
    def root():
        """Root endpoint - health check"""
        return jsonify({
            "status": "ok",
            "message": "QEPipeline API is running",
            "version": "1.0.0"
        }), 200
    
    @app.route("/api/time", methods=["GET"])
    def get_server_time():
        """Get server time for client synchronization"""
        server_time = datetime.now(timezone.utc)
        return jsonify({
            "server_time": server_time.isoformat(),
            "timestamp": server_time.timestamp(),
            "timezone": "UTC"
        }), 200
    
    @app.route("/api/register", methods=["POST"])
    def register():
        """Register a new user (pending approval)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            username = data.get("username", "").strip()
            password = data.get("password", "")
            name = data.get("name", "").strip()
            role = data.get("role", "").strip()
            birthdate = data.get("birthdate", "").strip()
            
            if not username or not password:
                return jsonify({"error": "Username and password are required"}), 400
            
            if username.lower() == ADMIN_USERNAME.lower():
                return jsonify({"error": "Cannot register admin user"}), 400
            
            # Validate role
            valid_roles = ["Director", "Assistant Director", "VFX Supervisor", "FX Artist", "TD", "3D Generalist", "Compositor"]
            if role and role not in valid_roles:
                return jsonify({"error": f"Invalid role. Must be one of: {', '.join(valid_roles)}"}), 400
            
            # Create pending registration
            success = db.create_user(username, password, name, role, birthdate, approved=False)
            
            if not success:
                return jsonify({"error": "Username already exists or pending registration"}), 400
            
            return jsonify({
                "message": "Registration submitted. Awaiting admin approval."
            }), 201
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/login", methods=["POST"])
    def login():
        """Login user"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            username = data.get("username", "").strip()
            password = data.get("password", "")
            
            if not username or not password:
                return jsonify({"error": "Username and password are required"}), 400
            
            # Check if user exists
            user = db.get_user(username)
            if not user:
                return jsonify({"error": "User not found"}), 404
            
            # Check if approved
            if not user.get("approved", False):
                return jsonify({"error": "Registration pending admin approval"}), 403
            
            # Authenticate
            if not db.authenticate_user(username, password):
                return jsonify({"error": "Invalid credentials"}), 401
            
            # Update activity on login
            db.update_user_activity(username)
            
            return jsonify({
                "message": "Login successful",
                "username": username
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/admin/pending", methods=["GET"])
    def get_pending():
        """Get pending registrations (admin only)"""
        try:
            username = request.args.get("username")
            password = request.args.get("password")
            
            if not db.is_admin(username, password):
                return jsonify({"error": "Unauthorized"}), 401
            
            pending = db.get_pending_registrations()
            return jsonify({"pending": pending}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/admin/approve", methods=["POST"])
    def approve_registration():
        """Approve or reject registration (admin only)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            admin_username = data.get("admin_username")
            admin_password = data.get("admin_password")
            username = data.get("username")
            approve = data.get("approve", True)
            
            if not db.is_admin(admin_username, admin_password):
                return jsonify({"error": "Unauthorized"}), 401
            
            if not username:
                return jsonify({"error": "Username is required"}), 400
            
            success = db.approve_registration(username, approve)
            
            if not success:
                return jsonify({"error": "Registration not found"}), 404
            
            status = "approved" if approve else "rejected"
            return jsonify({
                "message": f"User '{username}' {status}"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/projects", methods=["GET"])
    def get_projects():
        """Get projects that the user has access to (user must be in workers list, or admin sees all)"""
        try:
            # Get username from query parameter
            username = request.args.get("username", "").strip()
            
            if not username:
                return jsonify({"error": "Username is required"}), 400
            
            # Admin can see all projects
            if username.lower() == ADMIN_USERNAME.lower():
                projects = db.get_projects(username=None)
            else:
                # Regular users only see projects where they are in workers list
                projects = db.get_projects(username=username)
            
            return jsonify({"projects": projects}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/projects", methods=["POST"])
    def create_project():
        """Create a new project"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            name = data.get("name", "").strip()
            owner = data.get("owner", "").strip()
            director = data.get("director", "").strip()
            deadline = data.get("deadline", "").strip()
            production_status = data.get("production_status", "Pre-Production").strip()
            vfx_supervisors = data.get("vfx_supervisors", [])
            members = data.get("members", [])
            description = data.get("description", "").strip()
            
            if not name or not owner:
                return jsonify({"error": "Project name and owner are required"}), 400
            
            # Validate production status
            valid_statuses = ["Pre-Production", "Production", "Post-Production", "Finish"]
            if production_status not in valid_statuses:
                return jsonify({"error": f"Invalid production status. Must be one of: {', '.join(valid_statuses)}"}), 400
            
            # Ensure lists are lists
            if not isinstance(vfx_supervisors, list):
                vfx_supervisors = []
            if not isinstance(members, list):
                members = []
            
            # Add owner to workers if not already included
            workers = [owner] if owner else []
            
            project_id = db.create_project(
                name=name,
                owner=owner,
                director=director,
                deadline=deadline,
                production_status=production_status,
                vfx_supervisors=vfx_supervisors,
                members=members,
                workers=workers,
                description=description
            )
            
            if not project_id:
                return jsonify({"error": "Failed to create project"}), 500
            
            return jsonify({
                "message": "Project created successfully",
                "project_id": project_id
            }), 201
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users", methods=["GET"])
    def get_users():
        """Get all approved users (for project member selection)"""
        try:
            users = db.get_all_users()
            return jsonify({"users": users}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>", methods=["GET"])
    def get_user(username):
        """Get a single user by username"""
        try:
            user = db.get_user(username)
            if not user:
                return jsonify({"error": "User not found"}), 404
            return jsonify({"user": user}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>/partners", methods=["GET"])
    def get_partners(username):
        """Get all partners (friends) of a user"""
        try:
            partners = db.get_partners(username)
            return jsonify({"partners": partners}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>/partners/requests", methods=["GET"])
    def get_partner_requests(username):
        """Get all pending partner requests for a user"""
        try:
            requests = db.get_partner_requests(username)
            return jsonify({"requests": requests}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>/partners/requests", methods=["POST"])
    def send_partner_request(username):
        """Send a partner request to another user"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            partner_username = data.get("partner_username", "").strip()
            if not partner_username:
                return jsonify({"error": "Partner username is required"}), 400
            
            if username == partner_username:
                return jsonify({"error": "Cannot send request to yourself"}), 400
            
            success = db.send_partner_request(username, partner_username)
            if not success:
                return jsonify({"error": "Failed to send request. User may not exist, already a partner, or request already sent."}), 400
            
            return jsonify({"message": "Partner request sent successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>/partners/requests/<from_username>/accept", methods=["POST"])
    def accept_partner_request(username, from_username):
        """Accept a partner request"""
        try:
            success = db.accept_partner_request(username, from_username)
            if not success:
                return jsonify({"error": "Failed to accept request. Request may not exist."}), 400
            
            return jsonify({"message": "Partner request accepted successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>/partners/requests/<from_username>/reject", methods=["POST"])
    def reject_partner_request(username, from_username):
        """Reject a partner request"""
        try:
            success = db.reject_partner_request(username, from_username)
            if not success:
                return jsonify({"error": "Failed to reject request"}), 400
            
            return jsonify({"message": "Partner request rejected successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/<username>/partners/<partner_username>", methods=["DELETE"])
    def remove_partner(username, partner_username):
        """Remove a partner (friend) from a user"""
        try:
            success = db.remove_partner(username, partner_username)
            if not success:
                return jsonify({"error": "Failed to remove partner"}), 400
            
            return jsonify({"message": "Partner removed successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/active", methods=["GET"])
    def get_active_users():
        """Get currently active users"""
        try:
            minutes = request.args.get("minutes", 5, type=int)
            active_users = db.get_active_users(minutes=minutes)
            return jsonify({"users": active_users}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/users/activity", methods=["POST"])
    def update_activity():
        """Update user activity (heartbeat)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            username = data.get("username", "").strip()
            if not username:
                return jsonify({"error": "Username is required"}), 400
            
            # Update activity
            success = db.update_user_activity(username)
            if success:
                return jsonify({"message": "Activity updated"}), 200
            else:
                return jsonify({"error": "Failed to update activity"}), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/profile", methods=["GET"])
    def get_profile():
        """Get user profile"""
        try:
            username = request.args.get("username")
            if not username:
                return jsonify({"error": "Username is required"}), 400
            
            profile = db.get_user_profile(username)
            if not profile:
                return jsonify({"error": "User not found"}), 404
            
            return jsonify({"profile": profile}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>", methods=["GET"])
    def get_project(project_id):
        """Get a single project by ID"""
        try:
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            return jsonify({"project": project}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>", methods=["PUT"])
    def update_project(project_id):
        """Update a project"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Get update data (only include fields that are provided)
            name = data.get("name")
            director = data.get("director")
            deadline = data.get("deadline")
            production_status = data.get("production_status")
            vfx_supervisors = data.get("vfx_supervisors")
            members = data.get("members")
            description = data.get("description")
            
            # Validate production status if provided
            if production_status is not None:
                valid_statuses = ["Pre-Production", "Production", "Post-Production", "Finish"]
                if production_status not in valid_statuses:
                    return jsonify({"error": f"Invalid production status. Must be one of: {', '.join(valid_statuses)}"}), 400
            
            # Ensure lists are lists if provided
            if vfx_supervisors is not None and not isinstance(vfx_supervisors, list):
                vfx_supervisors = []
            if members is not None and not isinstance(members, list):
                members = []
            workers = data.get("workers")
            if workers is not None:
                # Only owner can update workers
                requesting_username = data.get("username") or request.headers.get("X-Username")
                if not requesting_username:
                    return jsonify({"error": "Username is required to update workers"}), 400
                
                # Check if user is the owner (or admin)
                if requesting_username.lower() != ADMIN_USERNAME.lower() and requesting_username != project.get("owner"):
                    return jsonify({"error": "Only project owner can update workers"}), 403
                
                if not isinstance(workers, list):
                    workers = []
            
            # Update project
            success = db.update_project(
                project_id=project_id,
                name=name,
                director=director,
                deadline=deadline,
                production_status=production_status,
                vfx_supervisors=vfx_supervisors,
                members=members,
                workers=workers,
                description=description
            )
            
            if success:
                # Return updated project
                updated_project = db.get_project(project_id)
                return jsonify({"project": updated_project, "message": "Project updated successfully"}), 200
            else:
                return jsonify({"error": "Failed to update project"}), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/shots", methods=["GET"])
    def get_shots(project_id):
        """Get all shots for a project"""
        try:
            print(f"API: Getting shots for project_id: {project_id}")
            shots = db.get_shots(project_id)
            print(f"API: Returning {len(shots)} shots")
            return jsonify({"shots": shots}), 200
        except Exception as e:
            print(f"API Error getting shots: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/shots", methods=["POST"])
    def create_shot(project_id):
        """Create a new shot"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            shot_name = data.get("shot_name", "").strip()
            description = data.get("description", "").strip()
            
            if not shot_name:
                return jsonify({"error": "Shot name is required"}), 400
            
            shot_id = db.create_shot(project_id, shot_name, description)
            if not shot_id:
                return jsonify({"error": "Failed to create shot or project not found"}), 500
            
            return jsonify({
                "message": "Shot created successfully",
                "shot_id": shot_id
            }), 201
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>", methods=["GET"])
    def get_shot(shot_id):
        """Get a single shot by ID"""
        try:
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            return jsonify({"shot": shot}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/thumbnail", methods=["POST"])
    def upload_thumbnail(shot_id):
        """Upload thumbnail for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Check if file is present
            if 'thumbnail' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            
            file = request.files['thumbnail']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400
            
            # Validate file type
            allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
            filename = file.filename
            if '.' not in filename:
                return jsonify({"error": "Invalid file type"}), 400
            
            ext = filename.rsplit('.', 1)[1].lower()
            if ext not in allowed_extensions:
                return jsonify({"error": f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"}), 400
            
            # Create shot directory
            shot_dir = os.path.join(app.config['UPLOAD_FOLDER'], shot_id)
            os.makedirs(shot_dir, exist_ok=True)
            
            # Save file
            secure_name = secure_filename(f"thumbnail.{ext}")
            file_path = os.path.join(shot_dir, secure_name)
            file.save(file_path)
            
            # Update shot with thumbnail path
            db.update_shot_thumbnail(shot_id, file_path)
            
            return jsonify({"message": "Thumbnail uploaded successfully"}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/thumbnail", methods=["GET"])
    def get_thumbnail(shot_id):
        """Get thumbnail for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get thumbnail path from shot
            thumbnail_path = shot.get('thumbnail_path')
            if not thumbnail_path or not os.path.exists(thumbnail_path):
                return jsonify({"error": "Thumbnail not found"}), 404
            
            return send_file(thumbnail_path)
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/thumbnail", methods=["DELETE"])
    def delete_thumbnail(shot_id):
        """Delete thumbnail for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get thumbnail path from shot
            thumbnail_path = shot.get('thumbnail_path')
            if thumbnail_path and os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
            
            # Update shot to remove thumbnail path
            db.update_shot_thumbnail(shot_id, None)
            
            return jsonify({"message": "Thumbnail deleted successfully"}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/resolution", methods=["PUT"])
    def update_resolution(shot_id):
        """Update resolution for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Check if resolution is locked
            if shot.get("resolution_locked", False):
                return jsonify({"error": "Resolution is locked and cannot be modified"}), 403
            
            # Get resolution data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            width = data.get("width")
            height = data.get("height")
            
            # Validate inputs
            if width is None or height is None:
                return jsonify({"error": "Width and height are required"}), 400
            
            try:
                width = int(width)
                height = int(height)
            except (ValueError, TypeError):
                return jsonify({"error": "Width and height must be numbers"}), 400
            
            if width < 1 or height < 1:
                return jsonify({"error": "Width and height must be positive numbers"}), 400
            
            # Update resolution
            success = db.update_shot_resolution(shot_id, width, height)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Resolution updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update resolution"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/description", methods=["PUT"])
    def update_description(shot_id):
        """Update description for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Check if description is locked
            if shot.get("description_locked", False):
                return jsonify({"error": "Description is locked and cannot be modified"}), 403
            
            # Get description data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            description = data.get("description", "").strip()
            
            # Update description
            success = db.update_shot_description(shot_id, description)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Description updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update description"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/resolution/lock", methods=["PUT"])
    def update_resolution_lock(shot_id):
        """Update resolution lock status for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get lock data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            locked = data.get("locked", False)
            
            # Update lock status
            success = db.update_shot_resolution_lock(shot_id, locked)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Resolution lock status updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update resolution lock status"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/description/lock", methods=["PUT"])
    def update_description_lock(shot_id):
        """Update description lock status for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get lock data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            locked = data.get("locked", False)
            
            # Update lock status
            success = db.update_shot_description_lock(shot_id, locked)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Description lock status updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update description lock status"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/duration", methods=["PUT"])
    def update_duration(shot_id):
        """Update duration for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Check if duration is locked
            if shot.get("duration_locked", False):
                return jsonify({"error": "Duration is locked and cannot be modified"}), 403
            
            # Get duration data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            start_frame = data.get("start_frame")
            end_frame = data.get("end_frame")
            total_frames = data.get("total_frames")
            
            # Validate inputs
            if start_frame is not None:
                try:
                    start_frame = int(start_frame)
                    if start_frame < 0:
                        return jsonify({"error": "Start frame must be non-negative"}), 400
                except (ValueError, TypeError):
                    return jsonify({"error": "Start frame must be a number"}), 400
            
            if end_frame is not None:
                try:
                    end_frame = int(end_frame)
                    if end_frame < 0:
                        return jsonify({"error": "End frame must be non-negative"}), 400
                except (ValueError, TypeError):
                    return jsonify({"error": "End frame must be a number"}), 400
            
            if total_frames is not None:
                try:
                    total_frames = int(total_frames)
                    if total_frames < 0:
                        return jsonify({"error": "Total frames must be non-negative"}), 400
                except (ValueError, TypeError):
                    return jsonify({"error": "Total frames must be a number"}), 400
            
            # Update duration
            success = db.update_shot_duration(shot_id, start_frame, end_frame, total_frames)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Duration updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update duration"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/duration/lock", methods=["PUT"])
    def update_duration_lock(shot_id):
        """Update duration lock status for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get lock data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            locked = data.get("locked", False)
            
            # Update lock status
            success = db.update_shot_duration_lock(shot_id, locked)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Duration lock status updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update duration lock status"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/messages", methods=["GET"])
    def get_project_messages(project_id):
        """Get all messages for a project"""
        try:
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Get messages
            messages = db.get_project_messages(project_id)
            
            return jsonify({
                "messages": messages,
                "message": "Messages retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/messages", methods=["POST"])
    def create_project_message(project_id):
        """Create a new message for a project"""
        try:
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Get message data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            content = data.get("content", "").strip()
            if not content:
                return jsonify({"error": "Message content is required"}), 400
            
            # Get username from request data or session
            data_username = data.get("username")
            username = data_username or session.get("username")
            if not username:
                # Try to get from Authorization header or other sources
                auth_header = request.headers.get("Authorization")
                if auth_header:
                    # Basic auth or token-based auth could be implemented here
                    pass
                return jsonify({"error": "User not authenticated"}), 401
            
            # Create message
            message_id = db.create_project_message(project_id, username, content)
            
            if message_id:
                # Return created message
                message = db.get_project_message(message_id)
                return jsonify({
                    "message": message,
                    "message_text": "Message created successfully"
                }), 201
            else:
                return jsonify({"error": "Failed to create message"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/messages", methods=["GET"])
    def get_shot_messages(shot_id):
        """Get all messages for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get messages
            messages = db.get_shot_messages(shot_id)
            
            return jsonify({
                "messages": messages,
                "message": "Messages retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/messages", methods=["POST"])
    def create_shot_message(shot_id):
        """Create a new message for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get username from request data or session
            username = None
            content = ""
            file_id = None
            
            # Check if request has files (multipart/form-data)
            if 'file' in request.files:
                file = request.files['file']
                if file.filename:
                    # Get username from form data
                    username = request.form.get("username")
                    if not username:
                        username = session.get("username")
                    if not username:
                        return jsonify({"error": "User not authenticated"}), 401
                    
                    # Get content from form data
                    content = request.form.get("content", "").strip()
                    
                    # Upload file
                    from werkzeug.utils import secure_filename
                    import os
                    
                    filename = secure_filename(file.filename)
                    upload_folder = os.path.join(app.config.get('SHOTS_UPLOAD_FOLDER', 'uploads/shots'))
                    os.makedirs(upload_folder, exist_ok=True)
                    
                    file_path = os.path.join(upload_folder, filename)
                    file.save(file_path)
                    file_size = os.path.getsize(file_path)
                    file_type = file.content_type or "application/octet-stream"
                    
                    # Create file record
                    file_id = db.create_shot_file(shot_id, username, filename, file_path, file_size, file_type)
                    if not file_id:
                        return jsonify({"error": "Failed to create file record"}), 500
            else:
                # Get message data from JSON
                data = request.get_json()
                if not data:
                    return jsonify({"error": "No data provided"}), 400
                
                content = data.get("content", "").strip()
                username = data.get("username")
                if not username:
                    username = session.get("username")
                if not username:
                    return jsonify({"error": "User not authenticated"}), 401
                
                # Get file_id if provided (for linking existing file)
                file_id = data.get("file_id")
            
            # Content or file is required
            if not content and not file_id:
                return jsonify({"error": "Message content or file is required"}), 400
            
            # Create message
            message_id = db.create_shot_message(shot_id, username, content, file_id)
            
            if message_id:
                # Return created message
                message = db.get_shot_message(message_id)
                # Include file info if message has file_id
                if file_id and "file_id" in message:
                    from bson import ObjectId
                    file_record = db.db.files.find_one({"_id": ObjectId(file_id)})
                    if file_record:
                        message["file"] = {
                            "id": str(file_record["_id"]),
                            "filename": file_record.get("filename", ""),
                            "file_type": file_record.get("file_type", ""),
                            "file_size": file_record.get("file_size", 0),
                        }
                return jsonify({
                    "message": message,
                    "message_text": "Message created successfully"
                }), 201
            else:
                return jsonify({"error": "Failed to create message"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/files", methods=["GET"])
    def get_project_files(project_id):
        """Get all files for a project"""
        try:
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Get files
            files = db.get_project_files(project_id)
            
            return jsonify({
                "files": files,
                "message": "Files retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/files", methods=["POST"])
    def upload_project_file(project_id):
        """Upload a file for a project"""
        try:
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Check if file is present
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400
            
            # Get username from request
            username = request.form.get("username")
            if not username:
                username = session.get("username")
            if not username:
                return jsonify({"error": "User not authenticated"}), 401
            
            # Create project-specific upload directory
            project_upload_dir = os.path.join(app.config['PROJECTS_UPLOAD_FOLDER'], project_id)
            os.makedirs(project_upload_dir, exist_ok=True)
            
            # Save file
            filename = secure_filename(file.filename)
            file_path = os.path.join(project_upload_dir, filename)
            
            # Handle duplicate filenames
            counter = 1
            original_filename = filename
            while os.path.exists(file_path):
                name, ext = os.path.splitext(original_filename)
                filename = f"{name}_{counter}{ext}"
                file_path = os.path.join(project_upload_dir, filename)
                counter += 1
            
            file.save(file_path)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            file_type = file.content_type or "application/octet-stream"
            
            # Create file record
            file_id = db.create_project_file(project_id, username, filename, file_path, file_size, file_type)
            
            if file_id:
                return jsonify({
                    "file_id": file_id,
                    "filename": filename,
                    "file_size": file_size,
                    "file_type": file_type,
                    "message": "File uploaded successfully"
                }), 201
            else:
                return jsonify({"error": "Failed to create file record"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/files/<file_id>", methods=["GET"])
    def download_project_file(project_id, file_id):
        """Download a project file"""
        try:
            from bson import ObjectId
            
            # Get file record
            file_record = db.db.files.find_one({"_id": ObjectId(file_id), "project_id": ObjectId(project_id)})
            if not file_record:
                return jsonify({"error": "File not found"}), 404
            
            file_path = file_record.get("file_path")
            if not file_path or not os.path.exists(file_path):
                return jsonify({"error": "File not found on disk"}), 404
            
            return send_file(file_path, as_attachment=True, download_name=file_record.get("filename"))
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/files/<file_id>", methods=["DELETE"])
    def delete_project_file(project_id, file_id):
        """Delete a project file"""
        try:
            from bson import ObjectId
            
            # Get file record
            file_record = db.db.files.find_one({"_id": ObjectId(file_id), "project_id": ObjectId(project_id)})
            if not file_record:
                return jsonify({"error": "File not found"}), 404
            
            # Delete file from disk
            file_path = file_record.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Error deleting file from disk: {e}")
            
            # Delete file record
            success = db.delete_file(file_id)
            if success:
                return jsonify({"message": "File deleted successfully"}), 200
            else:
                return jsonify({"error": "Failed to delete file"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/files", methods=["GET"])
    def get_shot_files(shot_id):
        """Get all files for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get files
            files = db.get_shot_files(shot_id)
            
            return jsonify({
                "files": files,
                "message": "Files retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/files", methods=["POST"])
    def upload_shot_file(shot_id):
        """Upload a file for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Check if file is present
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({"error": "No file selected"}), 400
            
            # Get username from request
            username = request.form.get("username")
            if not username:
                username = session.get("username")
            if not username:
                return jsonify({"error": "User not authenticated"}), 401
            
            # Create shot-specific upload directory
            shot_upload_dir = os.path.join(app.config['SHOTS_UPLOAD_FOLDER'], shot_id)
            os.makedirs(shot_upload_dir, exist_ok=True)
            
            # Save file
            filename = secure_filename(file.filename)
            file_path = os.path.join(shot_upload_dir, filename)
            
            # Handle duplicate filenames
            counter = 1
            original_filename = filename
            while os.path.exists(file_path):
                name, ext = os.path.splitext(original_filename)
                filename = f"{name}_{counter}{ext}"
                file_path = os.path.join(shot_upload_dir, filename)
                counter += 1
            
            file.save(file_path)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            file_type = file.content_type or "application/octet-stream"
            
            # Create file record
            file_id = db.create_shot_file(shot_id, username, filename, file_path, file_size, file_type)
            
            if file_id:
                return jsonify({
                    "file_id": file_id,
                    "filename": filename,
                    "file_size": file_size,
                    "file_type": file_type,
                    "message": "File uploaded successfully"
                }), 201
            else:
                return jsonify({"error": "Failed to create file record"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/files/<file_id>", methods=["GET"])
    def download_shot_file(shot_id, file_id):
        """Download or view a shot file"""
        try:
            from bson import ObjectId
            
            # Get file record (check both shot_id match and general file lookup)
            file_record = db.db.files.find_one({"_id": ObjectId(file_id)})
            if not file_record:
                return jsonify({"error": "File not found"}), 404
            
            # Verify shot_id matches if file has shot_id
            if "shot_id" in file_record:
                if str(file_record["shot_id"]) != shot_id:
                    return jsonify({"error": "File not found for this shot"}), 404
            
            file_path = file_record.get("file_path")
            if not file_path or not os.path.exists(file_path):
                return jsonify({"error": "File not found on disk"}), 404
            
            # Check if inline viewing is requested (for images/videos)
            inline = request.args.get("inline", "false").lower() == "true"
            
            return send_file(file_path, as_attachment=not inline, download_name=file_record.get("filename") if not inline else None)
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/files/<file_id>", methods=["DELETE"])
    def delete_shot_file(shot_id, file_id):
        """Delete a shot file"""
        try:
            from bson import ObjectId
            
            # Get file record
            file_record = db.db.files.find_one({"_id": ObjectId(file_id), "shot_id": ObjectId(shot_id)})
            if not file_record:
                return jsonify({"error": "File not found"}), 404
            
            # Delete file from disk
            file_path = file_record.get("file_path")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Error deleting file from disk: {e}")
            
            # Delete file record
            success = db.delete_file(file_id)
            if success:
                return jsonify({"message": "File deleted successfully"}), 200
            else:
                return jsonify({"error": "Failed to delete file"}), 500
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/delete", methods=["POST"])
    def request_project_deletion(project_id):
        """Request project deletion (only owner can request, requires admin approval)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            username = data.get("username", "").strip()
            project_name = data.get("project_name", "").strip()
            
            if not username or not project_name:
                return jsonify({"error": "Username and project name are required"}), 400
            
            # Verify project exists and get its name
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Only owner (or admin) can request deletion
            if username.lower() != ADMIN_USERNAME.lower() and username != project.get("owner"):
                return jsonify({"error": "Only project owner can request deletion"}), 403
            
            # Verify project name matches
            if project.get("name") != project_name:
                return jsonify({"error": "Project name does not match"}), 400
            
            success = db.request_project_deletion(project_id, username, project_name)
            if not success:
                return jsonify({"error": "Failed to request deletion or request already exists"}), 400
            
            return jsonify({
                "message": "Deletion request submitted. Awaiting admin approval."
            }), 201
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/admin/pending-deletions", methods=["GET"])
    def get_pending_deletions():
        """Get pending project deletion requests (admin only)"""
        try:
            username = request.args.get("username")
            password = request.args.get("password")
            
            if not db.is_admin(username, password):
                return jsonify({"error": "Unauthorized"}), 401
            
            deletions = db.get_pending_deletions()
            return jsonify({"deletions": deletions}), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/admin/approve-deletion", methods=["POST"])
    def approve_deletion():
        """Approve or reject project deletion (admin only)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            admin_username = data.get("admin_username")
            admin_password = data.get("admin_password")
            project_id = data.get("project_id")
            approve = data.get("approve", True)
            
            if not db.is_admin(admin_username, admin_password):
                return jsonify({"error": "Unauthorized"}), 401
            
            if not project_id:
                return jsonify({"error": "Project ID is required"}), 400
            
            success = db.approve_project_deletion(project_id, approve)
            if not success:
                return jsonify({"error": "Deletion request not found"}), 404
            
            status = "approved and deleted" if approve else "rejected"
            return jsonify({
                "message": f"Project deletion {status}"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/project/<project_id>/workers", methods=["PUT"])
    def update_project_workers(project_id):
        """Add or remove workers from a project (only owner can do this)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Get requesting username
            requesting_username = data.get("username") or request.headers.get("X-Username")
            if not requesting_username:
                return jsonify({"error": "Username is required"}), 400
            
            # Only owner (or admin) can update workers
            if requesting_username.lower() != ADMIN_USERNAME.lower() and requesting_username != project.get("owner"):
                return jsonify({"error": "Only project owner can update workers"}), 403
            
            # Get workers list
            workers = data.get("workers", [])
            if not isinstance(workers, list):
                return jsonify({"error": "Workers must be a list"}), 400
            
            # Update project with new workers list
            success = db.update_project(
                project_id=project_id,
                workers=workers
            )
            
            if success:
                # Return updated project
                updated_project = db.get_project(project_id)
                return jsonify({
                    "project": updated_project,
                    "message": "Workers updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update workers"}), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/workers", methods=["PUT"])
    def update_shot_workers(shot_id):
        """Update shot workers (participants) for a shot"""
        try:
            data = request.json
            shot_workers = data.get("shot_workers", [])
            
            if not isinstance(shot_workers, list):
                return jsonify({"error": "shot_workers must be a list"}), 400
            
            success = db.update_shot_workers(shot_id, shot_workers)
            
            if success:
                return jsonify({
                    "message": "Shot workers updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update shot workers"}), 500
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/workers-assignment", methods=["PUT"])
    def update_shot_workers_assignment(shot_id):
        """Update workers assignment for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get workers assignment data
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            workers_assignment = data.get("workers_assignment", {})
            if not isinstance(workers_assignment, dict):
                return jsonify({"error": "Workers assignment must be a dictionary"}), 400
            
            # Update shot with workers assignment
            success = db.update_shot_workers_assignment(shot_id, workers_assignment)
            
            if success:
                # Return updated shot
                updated_shot = db.get_shot(shot_id)
                return jsonify({
                    "shot": updated_shot,
                    "message": "Workers assignment updated successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to update workers assignment"}), 500
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/health", methods=["GET"])
    def health():
        """Health check endpoint"""
        return jsonify({"status": "ok"}), 200
    
    # Chat Room endpoints
    @app.route("/api/project/<project_id>/chat/room", methods=["GET"])
    def get_project_chat_room(project_id):
        """Get or create chat room for a project"""
        try:
            # Check if project exists
            project = db.get_project(project_id)
            if not project:
                return jsonify({"error": "Project not found"}), 404
            
            # Get or create chat room
            chat_room = db.get_project_chat_room(project_id)
            
            if chat_room:
                return jsonify({
                    "chat_room": chat_room,
                    "message": "Chat room retrieved successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to get or create chat room"}), 500
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/shot/<shot_id>/chat/room", methods=["GET"])
    def get_shot_chat_room(shot_id):
        """Get or create chat room for a shot"""
        try:
            # Check if shot exists
            shot = db.get_shot(shot_id)
            if not shot:
                return jsonify({"error": "Shot not found"}), 404
            
            # Get or create chat room
            chat_room = db.get_shot_chat_room(shot_id)
            
            if chat_room:
                return jsonify({
                    "chat_room": chat_room,
                    "message": "Chat room retrieved successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to get or create chat room"}), 500
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/chat-room/<chat_room_id>", methods=["GET"])
    def get_chat_room(chat_room_id):
        """Get chat room information"""
        try:
            chat_room = db.get_chat_room(chat_room_id)
            
            if chat_room:
                return jsonify({
                    "chat_room": chat_room,
                    "message": "Chat room retrieved successfully"
                }), 200
            else:
                return jsonify({"error": "Chat room not found"}), 404
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/chat-room/<chat_room_id>/messages", methods=["GET"])
    def get_chat_room_messages(chat_room_id):
        """Get messages for a chat room"""
        try:
            # Get username from session or request
            username = session.get("username") or request.args.get("username")
            
            limit = request.args.get("limit", 100, type=int)
            messages = db.get_chat_room_messages(chat_room_id, limit)
            
            # Mark messages as read by current user (if logged in)
            if username:
                db.mark_chat_room_messages_as_read(chat_room_id, username)
            
            return jsonify({
                "messages": messages,
                "message": "Messages retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/chat-room/<chat_room_id>/messages/read", methods=["PUT"])
    def mark_messages_as_read(chat_room_id):
        """Mark all messages in a chat room as read by current user"""
        try:
            # Get username from session or request
            username = session.get("username") or request.json.get("username")
            if not username:
                return jsonify({"error": "Username required"}), 401
            
            success = db.mark_chat_room_messages_as_read(chat_room_id, username)
            
            if success:
                return jsonify({
                    "message": "Messages marked as read successfully"
                }), 200
            else:
                return jsonify({"error": "Failed to mark messages as read"}), 500
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/chat-room/<chat_room_id>/messages", methods=["POST"])
    def create_chat_message(chat_room_id):
        """Create a new message in a chat room"""
        try:
            # Get username from session or request
            username = session.get("username") or request.json.get("username")
            if not username:
                return jsonify({"error": "Username required"}), 401
            
            # Get message content
            content = request.json.get("content", "").strip()
            if not content:
                return jsonify({"error": "Message content is required"}), 400
            
            # Create message
            message_id = db.create_chat_message(chat_room_id, username, content)
            
            if message_id:
                # Get created message
                message = db.db.messages.find_one({"_id": ObjectId(message_id)})
                if message:
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
                    # Ensure read_by field exists and is properly formatted
                    if "read_by" not in message:
                        message["read_by"] = []
                    elif isinstance(message.get("read_by"), list):
                        message["read_by"] = [str(r) for r in message["read_by"]]
                    else:
                        message["read_by"] = []
                
                return jsonify({
                    "message": message,
                    "message_text": "Message created successfully"
                }), 201
            else:
                return jsonify({"error": "Failed to create message"}), 500
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    # Personal chat endpoints
    @app.route("/api/users/<username>/personal-chat-rooms", methods=["GET"])
    def get_user_personal_chat_rooms(username):
        """Get all personal chat rooms for a user"""
        try:
            chat_rooms = db.get_user_personal_chat_rooms(username)
            
            return jsonify({
                "chat_rooms": chat_rooms,
                "message": "Personal chat rooms retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    @app.route("/api/personal-chat/<username1>/<username2>", methods=["GET"])
    def get_personal_chat_room(username1, username2):
        """Get or create a personal chat room between two users"""
        try:
            chat_room = db.get_or_create_personal_chat_room(username1, username2)
            
            if chat_room:
                return jsonify({
                    "chat_room": chat_room,
                    "message": "Personal chat room retrieved successfully"
                }), 200
            else:
                return jsonify({"error": "Users are not partners. Please add this user as a partner first."}), 400
                
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    # Get all chat rooms for a user
    @app.route("/api/users/<username>/chat-rooms", methods=["GET"])
    def get_user_all_chat_rooms(username):
        """Get all chat rooms for a user (project, shot, and personal)"""
        try:
            chat_rooms = db.get_user_all_chat_rooms(username)
            
            return jsonify({
                "chat_rooms": chat_rooms,
                "message": "Chat rooms retrieved successfully"
            }), 200
            
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    return app


if __name__ == "__main__":
    app = create_app()
    try:
        app.run(host="0.0.0.0", port=5000, debug=True)
    finally:
        db.close()

