from supabase_client import supabase


def upsert(table: str, data: dict):
    supabase.table(table).upsert(data).execute()


def insert(table: str, data: dict):
    supabase.table(table).insert(data).execute()


def delete_where(table: str, column: str, value):
    supabase.table(table).delete().eq(column, value).execute()


def fetch_all(table: str, filters: dict = None):
    query = supabase.table(table).select("*")
    if filters:
        for col, val in filters.items():
            query = query.eq(col, val)
    return query.execute().data


def fetch_one(table: str, filters: dict):
    query = supabase.table(table).select("*")
    for col, val in filters.items():
        query = query.eq(col, val)
    rows = query.limit(1).execute().data
    return rows[0] if rows else None
