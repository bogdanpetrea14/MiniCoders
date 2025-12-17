#!/bin/bash
echo "Starting local server on http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Try Python 3 first
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
# Try Python 2
elif command -v python &> /dev/null; then
    python -m http.server 8000
# Try PHP
elif command -v php &> /dev/null; then
    php -S localhost:8000
# Try Node.js http-server
elif command -v http-server &> /dev/null; then
    http-server -p 8000
else
    echo "No server found. Please install Python, PHP, or Node.js http-server"
    exit 1
fi

