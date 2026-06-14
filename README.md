# FluffyFlight ✈

A gamified study-timer web app themed around air travel. Pick a departure and
arrival airport on a world map, choose your seat, and "take off" — while your
flight is in the air, you study. FluffyFlight tracks your focus time and logs
each journey to your personal flight history.

## Features

- 🗺️ **Interactive world map** — browse continents and airports (powered by Leaflet)
- 🛫 **Plan a flight** — choose departure/arrival airports and a window or aisle seat
- ⏱️ **Study timer** — your study session runs while the flight is "in the air"
- 🪟 **In-flight views** — seat-back laptop screen and an optional window view
- 👤 **Accounts** — sign up / log in with secure, salted PBKDF2 password hashing
- 🎫 **My Page & history** — review past flights and accumulated study time
- 🛎️ **Reception** — in-app help / front-desk panel

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript, [Leaflet](https://leafletjs.com/) for maps
- **Backend:** Python 3 standard library (`http.server`) — no external frameworks
- **Database:** SQLite (via Python's built-in `sqlite3`), single-file storage
- **Auth:** salted PBKDF2-HMAC-SHA256 password hashing with token-based sessions

No third-party packages are required — the entire stack runs on the Python
standard library plus CDN-hosted Leaflet.

## Getting started

### Prerequisites

- Python 3.x (no `pip install` needed)

### Run

```bash
python3 server.py
```

Then open <http://localhost:5500> in your browser.

The SQLite database (`fluffyflight.db`) is created automatically on first run.

## Project structure

```
├── server.py        # Backend: static file server + JSON API, SQLite-backed
├── index.html       # App shell / markup
├── styles.css       # All styling
├── app.js           # Main app logic (map, flight planning, timer)
├── airports.js      # Airport / location data
├── account.js       # Sign up / log in / session handling (frontend)
├── laptop.js        # In-flight seat-back "laptop" study screen
└── reception.js     # Reception / help panel
```

## Notes

- The app serves on port **5500** by default (configurable at the top of `server.py`).
- `fluffyflight.db` is intentionally **not** committed — it holds user accounts,
  password hashes, and session tokens. It is generated locally on first run.
- This is a personal study project and a work in progress.
