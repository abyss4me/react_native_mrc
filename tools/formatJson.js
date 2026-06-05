const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../assets/layouts/config.json');
const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
let text = JSON.stringify(json, null, 2);

// Collapse 2-element numeric arrays onto one line (anchor, position, size, etc.)
text = text.replace(
  /\[\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+)\s*\n\s*\]/g,
  '[$1, $2]'
);

// Collapse 3-element numeric arrays onto one line
text = text.replace(
  /\[\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+),\s*\n\s*(-?[\d.]+)\s*\n\s*\]/g,
  '[$1, $2, $3]'
);

// Collapse single-letter/digit string arrays (keyboard rows of plain letters)
text = text.replace(
  /\[(\s*\n\s*"[A-Z0-9]",?)+\s*\n\s*\]/g,
  (m) => '[' + [...m.matchAll(/"([A-Z0-9])"/g)].map(x => `"${x[1]}"`).join(', ') + ']'
);

fs.writeFileSync(filePath, text, 'utf8');
console.log('Done. Lines:', text.split('\n').length);

