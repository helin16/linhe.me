"""Turbo Tumble server: serves the game and relays online messages between up to 4 browsers.
Run: python3 server.py   then open http://<this computer's IP>:8765/
Serves only this folder, so the rest of the site and repo stay private.
"""
import functools, json, os, queue, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

clients = {}  # slot (0-3) -> queue of outgoing messages
lock = threading.Lock()


def broadcast(msg, skip=None):
    with lock:
        targets = [q for s, q in clients.items() if s != skip]
    for q in targets:
        q.put(msg)


class Handler(SimpleHTTPRequestHandler):
    disable_nagle_algorithm = True  # small frequent messages: don't batch them

    def do_GET(self):
        if not self.path.startswith('/events'):
            return super().do_GET()
        with lock:
            slot = next((s for s in range(4) if s not in clients), None)
            if slot is not None:
                q = clients[slot] = queue.Queue()
                peers = [s for s in clients if s != slot]
        if slot is None:
            return self.send_error(503, 'Room full')
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        q.put(json.dumps({'t': 'hello', 'slot': slot, 'peers': peers}))
        broadcast(json.dumps({'t': 'join', 'slot': slot}), slot)
        try:
            while True:
                try:
                    msg = q.get(timeout=2)
                    self.wfile.write(f'data: {msg}\n\n'.encode())
                except queue.Empty:
                    self.wfile.write(b': ping\n\n')  # also how we notice a closed tab
        except OSError:
            pass
        finally:
            with lock:
                del clients[slot]
            broadcast(json.dumps({'t': 'leave', 'slot': slot}))

    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0))
        if self.path != '/send' or n > 20000:
            return self.send_error(400)
        body = self.rfile.read(n).decode()
        try:
            sender = json.loads(body)['from']
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)
        broadcast(body.replace('\n', ' '), sender)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print('Turbo Tumble on http://0.0.0.0:8765/')
    here = os.path.dirname(os.path.abspath(__file__))
    ThreadingHTTPServer(('', 8765), functools.partial(Handler, directory=here)).serve_forever()
