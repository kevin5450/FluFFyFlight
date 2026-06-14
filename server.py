#!/usr/bin/env python3
"""
FluffyFlight backend — static file server + small JSON API, backed by SQLite.

Why SQLite: it's a serverless, single-file database built into Python's
standard library, so there is nothing extra to install or run. Perfect for a
small study app: the entire stack is `python3 server.py`.

Run:  python3 server.py   (serves the app + API on http://localhost:5500)
"""
import json, os, sqlite3, hashlib, secrets, datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "fluffyflight.db")
PORT = 5500


def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT UNIQUE NOT NULL,
            name       TEXT NOT NULL,
            pass_hash  TEXT NOT NULL,
            salt       TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS history (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            dep_iata        TEXT, dep_city TEXT,
            arr_iata        TEXT, arr_city TEXT,
            real_start      TEXT, real_end TEXT, date TEXT,
            study_seconds   INTEGER, flight_seconds INTEGER, bathroom_seconds INTEGER,
            created_at      TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


def now_iso():
    return datetime.datetime.now().isoformat(timespec="seconds")


def hash_pw(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 100_000).hex()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, *a):
        pass  # quiet

    # Always serve fresh files during development.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode())
        except Exception:
            return {}

    def _user(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        token = auth[7:]
        conn = db()
        row = conn.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
            (token,),
        ).fetchone()
        conn.close()
        return row

    # ---- routing ----
    def do_POST(self):
        if self.path == "/api/signup":  return self.signup()
        if self.path == "/api/login":   return self.login()
        if self.path == "/api/logout":  return self.logout()
        if self.path == "/api/history": return self.add_history()
        self._json(404, {"error": "Not found"})

    def do_GET(self):
        if self.path == "/api/me":      return self.me()
        if self.path == "/api/history": return self.get_history()
        return super().do_GET()

    def do_DELETE(self):
        if self.path.startswith("/api/history/"):
            return self.delete_history(self.path.rsplit("/", 1)[-1])
        self._json(404, {"error": "Not found"})

    # ---- handlers ----
    def signup(self):
        b = self._body()
        name = (b.get("name") or "").strip()
        email = (b.get("email") or "").strip().lower()
        password = b.get("password") or ""
        if not name or not email or not password:
            return self._json(400, {"error": "Please fill in name, email and password."})
        conn = db()
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            conn.close()
            return self._json(409, {"error": "That email is already checked in. Try logging in."})
        salt = secrets.token_hex(16)
        cur = conn.execute(
            "INSERT INTO users(email, name, pass_hash, salt, created_at) VALUES(?,?,?,?,?)",
            (email, name, hash_pw(password, salt), salt, now_iso()),
        )
        uid = cur.lastrowid
        token = secrets.token_hex(24)
        conn.execute("INSERT INTO sessions(token, user_id, created_at) VALUES(?,?,?)",
                     (token, uid, now_iso()))
        conn.commit()
        conn.close()
        self._json(200, {"token": token, "user": {"name": name, "email": email, "created_at": now_iso()}})

    def login(self):
        b = self._body()
        email = (b.get("email") or "").strip().lower()
        password = b.get("password") or ""
        conn = db()
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row or hash_pw(password, row["salt"]) != row["pass_hash"]:
            conn.close()
            return self._json(401, {"error": "Wrong email or password."})
        token = secrets.token_hex(24)
        conn.execute("INSERT INTO sessions(token, user_id, created_at) VALUES(?,?,?)",
                     (token, row["id"], now_iso()))
        conn.commit()
        conn.close()
        self._json(200, {"token": token,
                         "user": {"name": row["name"], "email": row["email"], "created_at": row["created_at"]}})

    def logout(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            conn = db()
            conn.execute("DELETE FROM sessions WHERE token = ?", (auth[7:],))
            conn.commit()
            conn.close()
        self._json(200, {"ok": True})

    def me(self):
        u = self._user()
        if not u:
            return self._json(401, {"error": "Not logged in"})
        self._json(200, {"user": {"name": u["name"], "email": u["email"], "created_at": u["created_at"]}})

    def add_history(self):
        u = self._user()
        if not u:
            return self._json(401, {"error": "Not logged in"})
        b = self._body()
        conn = db()
        conn.execute(
            """INSERT INTO history(user_id, dep_iata, dep_city, arr_iata, arr_city,
                 real_start, real_end, date, study_seconds, flight_seconds, bathroom_seconds, created_at)
               VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
            (u["id"], b.get("dep_iata"), b.get("dep_city"), b.get("arr_iata"), b.get("arr_city"),
             b.get("real_start"), b.get("real_end"), b.get("date"),
             int(b.get("study_seconds", 0)), int(b.get("flight_seconds", 0)), int(b.get("bathroom_seconds", 0)),
             now_iso()),
        )
        conn.commit()
        conn.close()
        self._json(200, {"ok": True})

    def get_history(self):
        u = self._user()
        if not u:
            return self._json(401, {"error": "Not logged in"})
        conn = db()
        rows = conn.execute("SELECT * FROM history WHERE user_id = ? ORDER BY id DESC", (u["id"],)).fetchall()
        conn.close()
        self._json(200, {"history": [dict(r) for r in rows]})

    def delete_history(self, hid):
        u = self._user()
        if not u:
            return self._json(401, {"error": "Not logged in"})
        try:
            hid = int(hid)
        except (TypeError, ValueError):
            return self._json(400, {"error": "Bad ticket id"})
        conn = db()
        conn.execute("DELETE FROM history WHERE id = ? AND user_id = ?", (hid, u["id"]))
        conn.commit()
        conn.close()
        self._json(200, {"ok": True})


if __name__ == "__main__":
    init_db()
    print(f"FluffyFlight running at http://localhost:{PORT}  (Ctrl+C to stop)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
