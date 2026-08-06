import struct
import json

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
            with open("glb_nodes.txt", "w") as out:
                for idx, node in enumerate(nodes):
                    name = node.get('name', 'unnamed')
                    children = node.get('children', [])
                    out.write(f"Index {idx}: '{name}' children={children}\n")
            print("Successfully wrote node names to glb_nodes.txt")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
