import sys
from backend.supabase_client import supabase

res = supabase.table("jobs").select("*").order("created_at", desc=True).limit(5).execute()
for job in res.data:
    print(f"Job {job['id']}: status={job['status']}")
    imgs = supabase.table("images").select("*").eq("job_id", job['id']).execute()
    outputs = [img for img in imgs.data if img['type'] == 'output']
    print(f"  Outputs: {len(outputs)}")
