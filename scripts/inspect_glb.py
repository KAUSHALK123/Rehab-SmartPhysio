import struct
import json
import sys

def main():
    glb_path = "muscle_ARM1.glb"
    try:
        with open(glb_path, 'rb') as f:
            header = f.read(12)
            if len(header) < 12:
                print("Error: Invalid GLB file (too short)")
                return
            
            magic, version, length = struct.unpack('<4sII', header)
            if magic != b'glTF':
                print(f"Error: Invalid magic header: {magic}")
                return
                
            # Read first chunk (JSON)
            chunk_header = f.read(8)
            if len(chunk_header) < 8:
                print("Error: Cannot read chunk header")
                return
                
            chunk_length, chunk_type = struct.unpack('<II', chunk_header)
            if chunk_type != 0x4E4F534A: # 'JSON'
                print("Error: First chunk is not JSON")
                return
                
            json_data = f.read(chunk_length)
            gltf = json.loads(json_data.decode('utf-8'))
            
            # Print nodes
            nodes = gltf.get('nodes', [])
            print(f"GLB contains {len(nodes)} nodes:")
            for idx, node in enumerate(nodes):
                name = node.get('name', 'unnamed')
                children = node.get('children', [])
                rotation = node.get('rotation', None)
                scale = node.get('scale', None)
                translation = node.get('translation', None)
                print(f"Node [{idx}]: name='{name}', children={children}, translation={translation}, rotation={rotation}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
