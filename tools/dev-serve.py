#!/usr/bin/env python3
# Development only. Serves the newest mtime under src/ and manifest.json at
# http://127.0.0.1:7331/stamp; src/dev-reload.js polls it and, when it moves,
# restarts the extension and reloads the Google Photos tab.
import os, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7331

def stamp():
    newest = os.path.getmtime(os.path.join(ROOT, 'manifest.json'))
    for d, _, files in os.walk(os.path.join(ROOT, 'src')):
        for f in files:
            newest = max(newest, os.path.getmtime(os.path.join(d, f)))
    return str(int(newest * 1000))

class H(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Cache-Control', 'no-store')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_GET(self):
        body = stamp().encode()
        self.send_response(200); self.cors()
        self.send_header('Content-Type', 'text/plain'); self.send_header('Content-Length', len(body))
        self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass

print(f'dev-serve: http://127.0.0.1:{PORT}/stamp  (root {ROOT})', flush=True)
ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
