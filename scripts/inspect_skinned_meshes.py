import json
import struct

def main():
    glb_path = "muscle_ARM1.glb"
    try:
        with open(glb_path, 'rb') as f:
            header = f.read(12)
            magic, version, length = struct.unpack('<4sII', header)
            chunk_header = f.read(8)
            chunk_length, chunk_type = struct.unpack('<II', chunk_header)
            json_data = f.read(chunk_length)
            gltf = json.loads(json_data.decode('utf-8'))
            
            # Print meshes
            meshes = gltf.get('meshes', [])
            print(f"File contains {len(meshes)} meshes:")
            for m_idx, mesh in enumerate(meshes):
                name = mesh.get('name', 'unnamed')
                primitives = mesh.get('primitives', [])
                print(f"Mesh [{m_idx}]: name='{name}', primitives_count={len(primitives)}")
                
            # Print skins
            skins = gltf.get('skins', [])
            print(f"\nFile contains {len(skins)} skins:")
            for s_idx, skin in enumerate(skins):
                name = skin.get('name', 'unnamed')
                joints = skin.get('joints', [])
                skeleton = skin.get('skeleton', None)
                print(f"Skin [{s_idx}]: name='{name}', joints_count={len(joints)}, skeleton_root_node={skeleton}")
                # Print first few joints
                joint_names = []
                for j_node_idx in joints[:10]:
                    node = gltf.get('nodes', [])[j_node_idx]
                    joint_names.append(node.get('name', 'unnamed'))
                print(f"  First 10 joints: {joint_names}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
