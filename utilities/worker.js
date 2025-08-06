import { parentPort } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';

parentPort.on('message', (dirPath) => {
  try {
    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(dirPath, file));
    parentPort.postMessage({ success: true, data: files });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
});
