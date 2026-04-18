import requests, os, json
from dotenv import load_dotenv
load_dotenv(".env")
api_key = os.getenv("LEONARDO_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json"
}

# Get user id
me_resp = requests.get("https://cloud.leonardo.ai/api/rest/v1/me", headers=headers)
user_id = me_resp.json()["user_details"][0]["user"]["id"]

# Fetch last 15 generations
url = f"https://cloud.leonardo.ai/api/rest/v1/generations/user/{user_id}?limit=15"
resp = requests.get(url, headers=headers)
gens = resp.json().get("generations", [])

# Print details of the recent ones to compare UI vs API
for i, g in enumerate(gens):
    print(f"--- Generation {i} ---")
    print("Created At:", g.get("createdAt"))
    print("Model ID:", g.get("modelId"))
    print("Prompt:", g.get("prompt"))
    print("Status:", g.get("status"))
    print("Elements:", json.dumps(g.get("generation_elements", [])))
    print("---")
    
