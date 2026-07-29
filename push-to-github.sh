#!/bin/bash
cd /home/z/my-project
# Add any unstaged changes
git add -A
git diff --cached --quiet || git commit -m "auto-save: $(date '+%Y-%m-%d %H:%M')"
git push origin main 2>&1
