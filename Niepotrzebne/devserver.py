# Dev server with no-store cache headers so ES modules always reload fresh.
import http.server, functools, sys, os

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8741
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
handler = functools.partial(NoCacheHandler, directory=root)
http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
