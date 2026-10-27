# linhe.me

Lin He's personal site. Plain static files, served from a git checkout on the host: to deploy, push to `master` then run `git pull` in `~/public_html/website_eb66a13e` (linhe.me's document root). `.htaccess` hides `.git`, `README.md` and `*.py` from the web.

- `index.html`, `style.css`: home page
- `games/`: browser games, one folder each with its own `index.html`

## Turbo Tumble online mode

The game works as a static page (1 player, or 2 players split-screen). Online play (up to 4 devices) needs its relay server running:

```
python3 games/turbo-tumble/server.py
```

then open `http://<this computer's IP>:8765/` on each device on the same network. The server is for home networks only: it has no rooms, rate limits or HTTPS.
