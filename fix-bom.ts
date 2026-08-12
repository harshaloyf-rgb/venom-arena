const fs = require('fs'); const path = '/home/z/my-project/src/lib/snake/bot-ai.ts';
const buf = fs.readFileSync(path); const last5 = buf.slice(-5);
console.log('Last 5 hex:', last5.toString('hex'));
const badPos = buf.indexOf(Buffer.from([0x0a, 0x10, 0x06, 0xdf]));
if (badPos >= 0) {
  console.log('Found bad sequence at', badPos, '-');
  const newBuf = Buffer.concat([buf.slice(0, badPos), buf.slice(badPos + 3)]);
  fs.writeFileSync(path, newBuf);
  console.log('Fixed. File size:', buf.length, '->', newBuf.length);
} else {
  console.log('Bad sequence NOT found');
}
