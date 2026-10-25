"""
MedDRAG User Inspector
Quick utility to inspect registered users and roles in the local database.
Usage:
    backend\\venv\\Scripts\\python backend/check_users.py
"""

import os
import sqlite3


def main():
    db_path = os.path.join(os.path.dirname(__file__), "data", "meddrag.db")
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT u.id, u.name, u.email, u.role, u.created_at
        FROM users u
        ORDER BY u.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("\nNo users currently registered in the database.")
        return

    print("\n" + "=" * 78)
    print(f"{'NAME':<20} | {'ROLE':<8} | {'EMAIL':<30} | {'CREATED AT'}")
    print("=" * 78)
    for r in rows:
        uid, name, email, role, created = r
        created_str = str(created)[:19] if created else "N/A"
        print(f"{name:<20} | {role:<8} | {email:<30} | {created_str}")
    print("=" * 78)
    print(f"Total registered users: {len(rows)}\n")


if __name__ == "__main__":
    main()
