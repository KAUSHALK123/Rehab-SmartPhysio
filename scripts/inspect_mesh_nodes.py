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
            
            nodes = gltf.get('nodes', [])
            target_names = ['shoulder', 'bicep', 'tricep', 'forearm_full', 'forearm_back', 'palm', 'index1', 'index2', 'index3']
            
            print("Target Node Transformations:")
            for idx, node in enumerate(nodes):
                name = node.get('name', 'unnamed')
                if any(t in name for t in target_names):
                    translation = node.get('translation', None)
                    rotation = node.get('rotation', None)
                    scale = node.get('scale', None)
                    children = node.get('children', [])
                    print(f"Node [{idx}]: '{name}' children={children}, translation={translation}, rotation={rotation}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
