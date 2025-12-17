@echo off
echo Starting local server on http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000
if errorlevel 1 (
    echo Python not found. Trying PHP...
    php -S localhost:8000
    if errorlevel 1 (
        echo Neither Python nor PHP found.
        echo Please install Python or PHP, or use Node.js http-server.
        pause
    )
)

