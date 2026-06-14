# FluffyFlight ✈

I have a hard time sitting still and studying, so I built a little website that
turns a study session into a flight.

The idea is simple: you open a world map, pick where you're flying from and where
you're going, choose a window or aisle seat, and take off. While the plane is in
the air, you study. When you land, the time you put in gets saved to your flight
history. Longer routes = longer study sessions. It's a dumb little trick, but
seeing the map and "boarding" actually makes me want to start.

## What you can do

- Browse a world map and pick a departure and arrival airport
- Pick your seat (window seats get an extra view to look out of)
- Study while the flight runs, then land and have the session logged
- Make an account so your flight history sticks around
- Check past flights and total study time on your page
- Poke around the reception desk for the in-app help stuff

## How it's built

It's intentionally low-tech. The front end is plain HTML, CSS and vanilla
JavaScript — no framework, no build step. The map is [Leaflet](https://leafletjs.com/),
loaded from a CDN.

The back end is a single Python file (`server.py`) using nothing but the standard
library's `http.server`. It serves the files and exposes a tiny JSON API for
accounts and history. Data lives in a SQLite file, which Python already ships
with, so there's genuinely nothing to install. Passwords are stored hashed
(PBKDF2 + a per-user salt), and logins use a session token — I didn't want to be
the guy who stores passwords in plain text, even on a toy project.

## Running it

You just need Python 3. No `pip install`, no `npm install`.

```bash
python3 server.py
```

Then open http://localhost:5500.

The database (`fluffyflight.db`) creates itself the first time you run it. If you
want a different port, it's a single number near the top of `server.py`.

## What's where

```
server.py      back end: serves the files + the accounts/history API (SQLite)
index.html     the page itself
styles.css     all the styling (there's a lot of it)
app.js         the main stuff — map, picking a flight, the timer
airports.js    the airport/location data
account.js     signup / login / sessions on the front end
laptop.js      the seat-back "laptop" screen you study on mid-flight
reception.js   the reception / help panel
```

## A couple of notes

The database isn't in this repo on purpose — it holds real accounts, password
hashes and session tokens, so it stays local and gets regenerated on first run.

This is a personal project and still very much a work in progress. Things will
change, break, and get rebuilt. If you're poking around, have fun with it.
