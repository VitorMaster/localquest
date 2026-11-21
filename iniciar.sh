#!/bin/sh
cd "$(dirname "$0")"
echo "Localquest em http://localhost:8000 (Ctrl+C para encerrar)"
(sleep 1; (open http://localhost:8000 || xdg-open http://localhost:8000) >/dev/null 2>&1) &
python3 -m http.server 8000
