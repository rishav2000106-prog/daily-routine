@echo off
echo Starting RoutineOS Background Notifier...
echo You can close this window now! The notifier will run quietly in the background.
start /B node notifier.js > NUL 2>&1
exit
