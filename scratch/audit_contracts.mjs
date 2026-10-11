import fs from 'fs';
import path from 'path';

// Let's inspect docs/contracts/*.json
const contractsDir = path.resolve('docs/contracts');
const contractFiles = fs.readdirSync(contractsDir).filter(f => f.endsWith('.json') && !f.startsWith('ERROR_'));

console.log('Total non-error contract files:', contractFiles.length);
for (const file of contractFiles) {
  const content = JSON.parse(fs.readFileSync(path.join(contractsDir, file), 'utf-8'));
  console.log(file, 'keys in data:', content.data ? Object.keys(content.data) : 'NO DATA ENVELOPE', Array.isArray(content.data) ? `Array of ${content.data.length}` : typeof content.data);
}
