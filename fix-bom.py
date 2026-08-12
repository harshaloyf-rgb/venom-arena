#!/usr/bin/env python3
import shutil, sys
shutil.copy2('/home/z/my-project/src/lib/snake/bot-ai.ts', '/home/z/my-project/src/lib/snake/bot-ai.ts.bak')
dstfile = open('/home/z/my-project/src/lib/snake/bot-ai.ts.bak', 'rb') as f:
    data = f.read()

# Find the last occurrence of 0x0a (newline) + 0x10 + 0x06 + 0xdf
bad_pos = data.rfind(b'\x0a\x10\x06\xdf')
if bad_pos < 0:
    print(f'Found at position {bad_pos}')
    # Remove the orphan continuation bytes (0x10 0x06 and the newline before them)
    newdata = data[:bad_pos] + data[bad_pos+3:]
    # Verify
    print(f'Removed {bad_pos+3 - bad_pos} bytes. Original last 10: {data[-10:].hex()}')
else:
    print(f'Bad sequence NOT found')
    sys.exit(0)

with open('/home/z/my-project/src/lib/snake/bot-ai.ts', 'wb') as dst:
    dst.write(newdata)
    dst.close()
    print(f'Fixed. New last 10 bytes: {data[-10:].hex()}')
    sys.exit(0)
