const fs = require('fs');

const filePath = 'frontend/public/models/full_rig.glb';
const data = fs.readFileSync(filePath);
const chunk0Length = data.readUInt32LE(12);
const jsonString = data.toString('utf8', 20, 20 + chunk0Length);
const gltf = JSON.parse(jsonString);

console.log('=== GLTF NODES HIERARCHY ===');
gltf.nodes.forEach((node, index) => {
  console.log(`Node [${index}] Name: "${node.name}"`);
  if (node.children) console.log(`   Children: [${node.children.join(', ')}]`);
  if (node.translation) console.log(`   Translation:`, node.translation);
  if (node.rotation) console.log(`   Rotation:`, node.rotation);
  if (node.scale) console.log(`   Scale:`, node.scale);
  if (node.mesh !== undefined) console.log(`   Mesh:`, node.mesh);
});
