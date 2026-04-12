import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

_DB_URL = os.environ["SUPA_BASE_DB_URL"]


def get_connection():
    """Return a psycopg2 connection to the Supabase PostgreSQL database."""
    conn = psycopg2.connect(_DB_URL)
    return conn
