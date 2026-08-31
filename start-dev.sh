#!/bin/bash
cd /home/z/my-project
rm -rf .next
nohup node node_modules/.bin/next dev -p 3000 > /tmp/next-server.log 2>&1 &
echo $! > /tmp/next-server.pid
echo "Started PID: $(cat /tmp/next-server.pid)"
# Wait for ready
for i in $(seq 1 30); do
  sleep 2
  if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null | grep -q 200; then
    echo "Server ready after ${i}x2s"
    exit 0
  fi
done
echo "Server failed to start"
tail -20 /tmp/next-server.log
exit 1
