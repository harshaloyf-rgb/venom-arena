#!/bin/bash
cd "$(dirname "$0")"
export NODE_OPTIONS='--max-old-space-size=768'
exec npx next dev -p 3000
