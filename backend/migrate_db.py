import sqlite3
import os

def migrate_db(db_path):
    print(f"Migrating database: {db_path}")
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist. Skipping.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns in exercises table
    cursor.execute("PRAGMA table_info(exercises)")
    columns = [col[1] for col in cursor.fetchall()]
    
    alterations = [
        ("camera_view", "VARCHAR(50) DEFAULT 'straight'"),
        ("primary_sensor", "VARCHAR(50)"),
        ("secondary_sensor", "VARCHAR(50)"),
        ("is_system", "INTEGER DEFAULT 1")
    ]
    
    changed = False
    for col_name, col_type in alterations:
        if col_name not in columns:
            print(f"Adding column {col_name} to exercises table...")
            cursor.execute(f"ALTER TABLE exercises ADD COLUMN {col_name} {col_type}")
            changed = True
            
    # Check existing columns in calibration_sessions table
    cursor.execute("PRAGMA table_info(calibration_sessions)")
    cal_columns = [col[1] for col in cursor.fetchall()]
    
    cal_alterations = [
        ("thumb_min", "INTEGER"),
        ("thumb_max", "INTEGER"),
        ("index_min", "INTEGER"),
        ("index_max", "INTEGER"),
        ("middle_min", "INTEGER"),
        ("middle_max", "INTEGER"),
        ("ring_min", "INTEGER"),
        ("ring_max", "INTEGER"),
        ("little_min", "INTEGER"),
        ("little_max", "INTEGER"),
        ("elbow_min", "INTEGER"),
        ("elbow_max", "INTEGER"),
        ("pressure_min", "INTEGER"),
        ("pressure_max", "INTEGER")
    ]
    
    for col_name, col_type in cal_alterations:
        if col_name not in cal_columns:
            print(f"Adding column {col_name} to calibration_sessions table...")
            cursor.execute(f"ALTER TABLE calibration_sessions ADD COLUMN {col_name} {col_type}")
            changed = True
            
    if changed:
        conn.commit()
        print("Database migrated successfully.")
    else:
        print("Database already has all columns. No changes needed.")
        
    conn.close()

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    migrate_db(os.path.join(base_dir, "smartphysio.db"))
    migrate_db(os.path.join(base_dir, "test_smartphysio.db"))
