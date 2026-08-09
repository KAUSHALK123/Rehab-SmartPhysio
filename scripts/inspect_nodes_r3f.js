const fs = require('fs');

const filePath = process.argv[2] || 'frontend/public/trial.glb';
const data = fs.readFileSync(filePath);
// glb has a 12 byte header and an 8 byte chunk 0 header
const chunk0Length = data.readUInt32LE(12);
const jsonString = data.toString('utf8', 20, 20 + chunk0Length);
const gltf = JSON.parse(jsonString);

console.log(JSON.stringify(gltf.nodes, null, 2));
