from backend.supabase_client import supabase
result = supabase.table("jobs").select("*, images(type, url)").order("created_at", desc=True).limit(2).execute()
print(result.data)
