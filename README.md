# linhe.me

Lin He's personal site. Plain static files: upload the repo contents (except `.git`, `README.md` and `*.py`) to `public_html` on the host.

- `index.html`, `style.css`: home page
- `games/`: browser games, one folder each with its own `index.html`

## Turbo Tumble online mode

The game works as a static page (1 player, or 2 players split-screen). Online play (up to 4 devices) needs its relay server running:

```
python3 games/turbo-tumble/server.py
```

then open `http://<this computer's IP>:8765/` on each device on the same network. The server is for home networks only: it has no rooms, rate limits or HTTPS.
