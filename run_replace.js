const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');
s = s.replace(/'nvidia\/nemotron-3-ultra-550b-a55b'/g, "'gemini-2.0-flash'");
fs.writeFileSync('src/App.tsx', s);
console.log('Done');
