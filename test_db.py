from backend.supabase_client import supabase
try:
    res = supabase.table("jobs").select("*").limit(1).execute()
    print("Columns:", res.data[0].keys() if res.data else "No data")
except Exception as e:
    print("Error:", e)
