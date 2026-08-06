import json
import struct

def print_node(nodes, idx, indent=""):
    node = nodes[idx]
    name = node.get('name', 'unnamed')
    mesh = node.get('mesh', None)
    children = node.get('children', [])
    print(f"{indent}- [{idx}] Name: '{name}' (Mesh: {mesh})")
    for child in children:
        print_node(nodes, child, indent + "  ")

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
            
            nodes = gltf.get('nodes', [])
            
            # Find root nodes (nodes that are not children of any other node)
            all_children = set()
            for node in nodes:
                all_children.update(node.get('children', []))
                
            roots = [idx for idx in range(len(nodes)) if idx not in all_children]
            
            print("GLB Node Hierarchy Tree:")
            for root in roots:
                # Only print starting from root/Sketchfab/ArmRIG/Scene root to keep it clean
                name = nodes[root].get('name', '')
                if 'Sketchfab' in name or 'GLTF' in name or 'Scene' in name or 'ArmRIG' in name:
                    print_node(nodes, root)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
