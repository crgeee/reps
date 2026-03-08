-- Seed pre-built exercises for Flask track modules
-- These exercises work without AI — users can practice immediately.

INSERT INTO exercises (id, module_id, type, prompt, starter_code, test_code, difficulty, generated_by) VALUES

-- Module: hello-flask (23917f1a-d096-4566-9ffa-c9a818b52e16)
('a482049a-1276-47f0-bc82-ce1e0337b317', '23917f1a-d096-4566-9ffa-c9a818b52e16', 'code',
 'Create a minimal Flask application with a single route at "/" that returns "Hello, Flask!" as plain text. The app object should be named `app`.',
 'from flask import Flask

# Create your Flask app here
',
 'import importlib, sys
mod = sys.modules[__name__]
assert hasattr(mod, "app"), "Expected an app variable"
client = mod.app.test_client()
resp = client.get("/")
assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
assert resp.data.decode() == "Hello, Flask!", f"Expected ''Hello, Flask!'', got ''{resp.data.decode()}''\"',
 1, 'manual'),

('c33b15fa-200b-437a-a39b-e7602aa993db', '23917f1a-d096-4566-9ffa-c9a818b52e16', 'code',
 'Create a Flask app with two routes: "/" returns "Home" and "/about" returns "About". Both should return plain text with status 200.',
 'from flask import Flask

app = Flask(__name__)

# Add your routes here
',
 'client = app.test_client()
r1 = client.get("/")
assert r1.status_code == 200 and r1.data.decode() == "Home", f"/ should return ''Home'', got ''{r1.data.decode()}''"
r2 = client.get("/about")
assert r2.status_code == 200 and r2.data.decode() == "About", f"/about should return ''About'', got ''{r2.data.decode()}''"
print("All tests passed!")',
 1, 'manual'),

-- Module: routing (f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd)
('7ffaf2c9-953f-4026-a78c-22662cb72055', 'f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd', 'code',
 'Create a Flask app with a dynamic route "/greet/<name>" that returns "Hello, <name>!" where <name> is the URL parameter. For example, "/greet/Alice" should return "Hello, Alice!".',
 'from flask import Flask

app = Flask(__name__)

# Add your dynamic route here
',
 'client = app.test_client()
r1 = client.get("/greet/Alice")
assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
assert r1.data.decode() == "Hello, Alice!", f"Expected ''Hello, Alice!'', got ''{r1.data.decode()}''"
r2 = client.get("/greet/Bob")
assert r2.data.decode() == "Hello, Bob!", f"Expected ''Hello, Bob!'', got ''{r2.data.decode()}''"
print("All tests passed!")',
 1, 'manual'),

('bb60a006-f84b-4f9d-823d-5bd0ae0e5b0c', 'f74854fc-88d2-42c2-b9fa-d7a8fe8b21dd', 'code',
 'Create a Flask app with a route "/add/<int:a>/<int:b>" that returns the sum of a and b as a string. Use Flask''s integer URL converter. For example, "/add/3/5" should return "8".',
 'from flask import Flask

app = Flask(__name__)

# Add your route with integer converters here
',
 'client = app.test_client()
r1 = client.get("/add/3/5")
assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
assert r1.data.decode() == "8", f"Expected ''8'', got ''{r1.data.decode()}''"
r2 = client.get("/add/10/20")
assert r2.data.decode() == "30", f"Expected ''30'', got ''{r2.data.decode()}''"
r3 = client.get("/add/hello/world")
assert r3.status_code == 404, "Non-integer params should 404"
print("All tests passed!")',
 2, 'manual'),

-- Module: templates (b50ab13a-a4a5-46ba-b530-889ee4c6888f)
('fa09cf45-678d-4747-ac9b-dedea74fe725', 'b50ab13a-a4a5-46ba-b530-889ee4c6888f', 'code',
 'Write a Jinja2 template string that generates an HTML unordered list from a list of items. Complete the `render_list` function that takes a list of strings and returns rendered HTML using `jinja2.Template`. Example: render_list(["a","b"]) should produce "<ul>\n<li>a</li>\n<li>b</li>\n</ul>".',
 'from jinja2 import Template

TEMPLATE = """<ul>
{# Write your Jinja2 loop here #}
</ul>"""

def render_list(items):
    t = Template(TEMPLATE)
    return t.render(items=items)
',
 'result = render_list(["apple", "banana", "cherry"])
assert "<li>apple</li>" in result, "Should contain <li>apple</li>"
assert "<li>banana</li>" in result, "Should contain <li>banana</li>"
assert "<li>cherry</li>" in result, "Should contain <li>cherry</li>"
assert result.startswith("<ul>"), "Should start with <ul>"
assert result.strip().endswith("</ul>"), "Should end with </ul>"
empty = render_list([])
assert "<li>" not in empty, "Empty list should have no <li> tags"
print("All tests passed!")',
 2, 'manual'),

('c4c80e8d-b7da-4f1e-8429-13c33a372b7f', 'b50ab13a-a4a5-46ba-b530-889ee4c6888f', 'code',
 'Write a function `render_greeting` that uses Jinja2 template rendering with conditional logic. If `name` is provided, return "Hello, <name>!". If not, return "Hello, stranger!". Use a Jinja2 Template with an if/else block.',
 'from jinja2 import Template

def render_greeting(name=None):
    t = Template("Hello, {{ name if name else ''stranger'' }}!")
    # Fix the template above to use proper Jinja2 if/else syntax
    return t.render(name=name)
',
 'assert render_greeting("Alice") == "Hello, Alice!", f"Got: {render_greeting(''Alice'')}"
assert render_greeting() == "Hello, stranger!", f"Got: {render_greeting()}"
assert render_greeting(None) == "Hello, stranger!", f"Got: {render_greeting(None)}"
assert render_greeting("") == "Hello, stranger!", f"Got: {render_greeting('''')}"
print("All tests passed!")',
 1, 'manual'),

-- Module: forms-input (6c193324-940f-4a41-be1a-8c9fbaeb1af9)
('6f14cd56-56ec-45bd-b1a7-1a542a271fed', '6c193324-940f-4a41-be1a-8c9fbaeb1af9', 'code',
 'Create a Flask app with a route "/search" that accepts a GET query parameter "q" and returns "Results for: <q>". If no "q" parameter is provided, return "No query provided" with status 400.',
 'from flask import Flask, request

app = Flask(__name__)

# Add your /search route here
',
 'client = app.test_client()
r1 = client.get("/search?q=flask")
assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
assert r1.data.decode() == "Results for: flask", f"Got: {r1.data.decode()}"
r2 = client.get("/search")
assert r2.status_code == 400, f"Expected 400 when no q param, got {r2.status_code}"
assert r2.data.decode() == "No query provided"
print("All tests passed!")',
 1, 'manual'),

('7f980e08-a32a-41bd-ab9f-273ca3bb14c4', '6c193324-940f-4a41-be1a-8c9fbaeb1af9', 'code',
 'Create a Flask app with a POST route "/login" that accepts JSON body with "username" and "password" fields. Return JSON {"status": "ok", "user": "<username>"} on success. If either field is missing, return {"error": "Missing fields"} with status 400.',
 'from flask import Flask, request, jsonify

app = Flask(__name__)

# Add your /login POST route here
',
 'import json
client = app.test_client()
r1 = client.post("/login", json={"username": "admin", "password": "secret"})
assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
data = r1.get_json()
assert data["status"] == "ok", f"Expected status ok, got {data}"
assert data["user"] == "admin", f"Expected user admin, got {data}"
r2 = client.post("/login", json={"username": "admin"})
assert r2.status_code == 400, f"Expected 400, got {r2.status_code}"
assert "error" in r2.get_json()
r3 = client.post("/login", json={})
assert r3.status_code == 400
print("All tests passed!")',
 2, 'manual'),

-- Module: database (16ae8c80-e713-45c5-a7eb-18557b3c5506)
('3c0408fd-7a5f-4f33-963e-23135decab8e', '16ae8c80-e713-45c5-a7eb-18557b3c5506', 'code',
 'Write a SQLAlchemy model class `Task` with the following columns: id (Integer, primary key, autoincrement), title (String(100), not nullable), done (Boolean, default False). The table name should be "tasks".',
 'from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Define your Task model here
',
 'assert hasattr(Task, "__tablename__"), "Task must have __tablename__"
assert Task.__tablename__ == "tasks", f"Table name should be ''tasks'', got ''{Task.__tablename__}''"
cols = {c.name: c for c in Task.__table__.columns}
assert "id" in cols, "Must have id column"
assert "title" in cols, "Must have title column"
assert "done" in cols, "Must have done column"
assert cols["id"].primary_key, "id must be primary key"
assert not cols["title"].nullable, "title must not be nullable"
t = Task(title="Test")
assert t.done == False, "done should default to False"
print("All tests passed!")',
 1, 'manual'),

('7571226e-774e-48e3-bda1-dd4df7a95ab4', '16ae8c80-e713-45c5-a7eb-18557b3c5506', 'code',
 'Using SQLAlchemy with an in-memory SQLite database, create a `User` model (id, name, email — email unique) and write functions: `create_user(session, name, email)` that adds and returns a User, and `get_user_by_email(session, email)` that finds a user by email or returns None.',
 'from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, Session

Base = declarative_base()

# Define User model and helper functions here
class User(Base):
    __tablename__ = "users"
    # Add columns

def create_user(session, name, email):
    pass

def get_user_by_email(session, email):
    pass
',
 'engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
with Session(engine) as s:
    u = create_user(s, "Alice", "alice@example.com")
    assert u.name == "Alice"
    assert u.email == "alice@example.com"
    assert u.id is not None, "User should have an id after creation"
    found = get_user_by_email(s, "alice@example.com")
    assert found is not None, "Should find user by email"
    assert found.name == "Alice"
    not_found = get_user_by_email(s, "nobody@example.com")
    assert not_found is None, "Should return None for unknown email"
    print("All tests passed!")',
 2, 'manual'),

-- Module: auth (d2db4b55-436a-49d0-af20-0761d1f48310)
('e5a26ac1-4def-4cf2-ae18-6648b471ada4', 'd2db4b55-436a-49d0-af20-0761d1f48310', 'code',
 'Using werkzeug.security, write two functions: `hash_password(password)` that returns a hashed password, and `check_password(hashed, password)` that returns True if the password matches. Do not use plain text comparison.',
 'from werkzeug.security import generate_password_hash, check_password_hash

def hash_password(password):
    pass

def check_password(hashed, password):
    pass
',
 'h = hash_password("secret123")
assert isinstance(h, str), "hash_password should return a string"
assert h != "secret123", "hash should not be plain text"
assert check_password(h, "secret123") == True, "Correct password should match"
assert check_password(h, "wrong") == False, "Wrong password should not match"
h2 = hash_password("secret123")
assert h != h2, "Same password should produce different hashes (salted)"
print("All tests passed!")',
 1, 'manual'),

('b68181d9-b27d-4db5-a916-d5cbd605dea1', 'd2db4b55-436a-49d0-af20-0761d1f48310', 'code',
 'Create a Flask app with session-based login. Add three routes: POST "/login" accepts JSON {"username": "admin", "password": "secret"} and sets session["user"], GET "/profile" returns {"user": "<username>"} if logged in or 401, POST "/logout" clears the session and returns {"status": "logged_out"}.',
 'from flask import Flask, request, session, jsonify

app = Flask(__name__)
app.secret_key = "test-secret-key"

# Add /login, /profile, /logout routes here
',
 'client = app.test_client()
r = client.get("/profile")
assert r.status_code == 401, f"Should be 401 when not logged in, got {r.status_code}"
r = client.post("/login", json={"username": "admin", "password": "secret"})
assert r.status_code == 200, f"Login should succeed, got {r.status_code}"
r = client.get("/profile")
assert r.status_code == 200, f"Should be 200 after login, got {r.status_code}"
assert r.get_json()["user"] == "admin"
r = client.post("/logout")
assert r.status_code == 200
r = client.get("/profile")
assert r.status_code == 401, "Should be 401 after logout"
print("All tests passed!")',
 2, 'manual'),

-- Module: rest-apis (3f78c323-f967-4e58-9dbc-6148293a6810)
('b1257824-5e02-4362-a8ca-408e5e5c91b1', '3f78c323-f967-4e58-9dbc-6148293a6810', 'code',
 'Create a Flask app with an in-memory list of items (start with [{"id": 1, "name": "Item 1"}]). Add routes: GET "/api/items" returns the full list as JSON, GET "/api/items/<int:id>" returns one item or 404, POST "/api/items" adds a new item from JSON body {"name": "..."} and returns it with 201.',
 'from flask import Flask, request, jsonify

app = Flask(__name__)
items = [{"id": 1, "name": "Item 1"}]

# Add your REST API routes here
',
 'import json
client = app.test_client()
r = client.get("/api/items")
assert r.status_code == 200
data = r.get_json()
assert len(data) == 1, f"Expected 1 item, got {len(data)}"
r = client.get("/api/items/1")
assert r.status_code == 200
assert r.get_json()["name"] == "Item 1"
r = client.get("/api/items/999")
assert r.status_code == 404, f"Expected 404 for missing item, got {r.status_code}"
r = client.post("/api/items", json={"name": "Item 2"})
assert r.status_code == 201, f"Expected 201, got {r.status_code}"
assert r.get_json()["name"] == "Item 2"
r = client.get("/api/items")
assert len(r.get_json()) == 2, "Should now have 2 items"
print("All tests passed!")',
 2, 'manual'),

('e95191b2-95ab-40d3-adb9-c92856d39db9', '3f78c323-f967-4e58-9dbc-6148293a6810', 'code',
 'Create a Flask app with custom error handlers. Register error handlers for 404 and 500 that return JSON responses: {"error": "Not found", "status": 404} and {"error": "Internal server error", "status": 500}. Add a route "/crash" that raises an exception to test the 500 handler.',
 'from flask import Flask, jsonify

app = Flask(__name__)

# Register error handlers and add the /crash route
',
 'client = app.test_client()
r = client.get("/nonexistent")
assert r.status_code == 404
data = r.get_json()
assert data["error"] == "Not found", f"Expected ''Not found'', got {data}"
assert data["status"] == 404
r = client.get("/crash")
assert r.status_code == 500
data = r.get_json()
assert data["error"] == "Internal server error", f"Expected ''Internal server error'', got {data}"
assert data["status"] == 500
print("All tests passed!")',
 2, 'manual'),

-- Module: blueprints (fead7162-fdeb-49af-9b5c-87c233e00887)
('dc149651-4f4a-4eb7-9c40-42bdb7b523aa', 'fead7162-fdeb-49af-9b5c-87c233e00887', 'code',
 'Create a Flask Blueprint called "api" with url_prefix="/api". Add a route GET "/health" to the blueprint that returns {"status": "ok"}. Then create a Flask app and register the blueprint. The full URL should be "/api/health".',
 'from flask import Flask, Blueprint, jsonify

# Create blueprint and register it with an app

',
 'assert app is not None, "Must have an app variable"
client = app.test_client()
r = client.get("/api/health")
assert r.status_code == 200, f"Expected 200 at /api/health, got {r.status_code}"
data = r.get_json()
assert data["status"] == "ok", f"Expected status ok, got {data}"
r = client.get("/health")
assert r.status_code == 404, "/health without prefix should 404"
print("All tests passed!")',
 1, 'manual'),

('55c7aa6d-95b9-4f28-a156-07ac356df02c', 'fead7162-fdeb-49af-9b5c-87c233e00887', 'code',
 'Create a Flask app factory function `create_app()` that creates a Flask app and registers two blueprints: "auth" (prefix="/auth") with a GET "/status" route returning {"auth": true}, and "main" (prefix="/") with a GET "/" route returning {"page": "home"}.',
 'from flask import Flask, Blueprint, jsonify

# Create blueprints and the app factory

def create_app():
    pass
',
 'app = create_app()
assert app is not None, "create_app must return an app"
client = app.test_client()
r = client.get("/auth/status")
assert r.status_code == 200, f"Expected 200 at /auth/status, got {r.status_code}"
assert r.get_json()["auth"] == True
r = client.get("/")
assert r.status_code == 200, f"Expected 200 at /, got {r.status_code}"
assert r.get_json()["page"] == "home"
print("All tests passed!")',
 2, 'manual'),

-- Module: testing (a208b5cf-3a34-4a98-baf4-bc7c67ef6673)
('da0a761c-6da3-47dd-b344-50f21ec27bd0', 'a208b5cf-3a34-4a98-baf4-bc7c67ef6673', 'code',
 'Write a function `test_homepage` that uses Flask''s test client to verify: the homepage ("/") returns status 200, the response content type includes "text/html" or "application/json", and the response body is not empty. The app is provided for you.',
 'from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return "Welcome!"

# Write your test function below
def test_homepage():
    pass
',
 'test_homepage()
print("test_homepage passed!")
# Verify the function actually tests things (not just pass)
import inspect
src = inspect.getsource(test_homepage)
assert "assert" in src or "assertEqual" in src, "test_homepage must contain assertions"
assert "test_client" in src or "client" in src, "Must use Flask test client"
print("All tests passed!")',
 1, 'manual'),

('419f3c7c-e998-4489-bf7d-6c5dae962fee', 'a208b5cf-3a34-4a98-baf4-bc7c67ef6673', 'code',
 'Write a pytest-style test fixture function `client()` that creates a Flask test client from the provided app, and two test functions: `test_get_items` (GET /items returns 200 with a list) and `test_create_item` (POST /items with JSON returns 201). Run all tests at the end.',
 'from flask import Flask, jsonify, request

app = Flask(__name__)
_items = []

@app.route("/items", methods=["GET"])
def get_items():
    return jsonify(_items)

@app.route("/items", methods=["POST"])
def create_item():
    _items.append(request.get_json())
    return jsonify(_items[-1]), 201

# Write your test fixture and test functions
def client():
    pass

def test_get_items():
    pass

def test_create_item():
    pass
',
 '_items.clear()
c = client()
assert c is not None, "client() must return a test client"
test_get_items()
print("test_get_items passed!")
test_create_item()
print("test_create_item passed!")
import inspect
for fn in [test_get_items, test_create_item]:
    src = inspect.getsource(fn)
    assert "assert" in src, f"{fn.__name__} must contain assertions"
print("All tests passed!")',
 2, 'manual'),

-- Module: deployment (c93358b8-1ce6-4911-a1e5-e54bfc7a2600)
('164e8a0a-ff87-4d6f-a8d7-abd18e47c7f9', 'c93358b8-1ce6-4911-a1e5-e54bfc7a2600', 'code',
 'Create a Flask config system with three classes: `BaseConfig` (DEBUG=False, TESTING=False, SECRET_KEY="change-me"), `DevConfig(BaseConfig)` (DEBUG=True), and `ProdConfig(BaseConfig)` (SECRET_KEY read from environment variable "SECRET_KEY" with fallback "prod-secret"). Write a function `create_app(config_name)` that accepts "dev" or "prod" and applies the config.',
 'import os
from flask import Flask

# Define config classes and create_app function
',
 'app_dev = create_app("dev")
assert app_dev.config["DEBUG"] == True, "Dev should have DEBUG=True"
assert app_dev.config["TESTING"] == False, "Dev should have TESTING=False"
app_prod = create_app("prod")
assert app_prod.config["DEBUG"] == False, "Prod should have DEBUG=False"
assert app_prod.config["SECRET_KEY"] != "change-me", "Prod must override SECRET_KEY"
os.environ["SECRET_KEY"] = "env-secret"
app_env = create_app("prod")
assert app_env.config["SECRET_KEY"] == "env-secret", "Prod should read SECRET_KEY from env"
del os.environ["SECRET_KEY"]
print("All tests passed!")',
 2, 'manual'),

('0caa95f6-5a76-409f-985d-2fc63beaa877', 'c93358b8-1ce6-4911-a1e5-e54bfc7a2600', 'code',
 'Create a Flask app with a custom logging setup. Write a function `create_app()` that creates a Flask app with a StreamHandler logger at INFO level. Add a route GET "/health" that logs "Health check requested" at INFO level and returns {"status": "ok"}.',
 'import logging
from flask import Flask, jsonify

def create_app():
    pass
',
 'app = create_app()
assert app is not None, "create_app must return an app"
assert app.logger.level <= logging.INFO, "Logger should be at INFO level or lower"
client = app.test_client()
r = client.get("/health")
assert r.status_code == 200
assert r.get_json()["status"] == "ok"
print("All tests passed!")',
 1, 'manual')

ON CONFLICT (id) DO NOTHING;
