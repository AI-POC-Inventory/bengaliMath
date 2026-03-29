import sqlite3

DB_PATH = "D:\\Sujit\\AiML\\AITech\\academy\\beangali-board\\bengaliMath\\database\\bengali_curriculam.db"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn