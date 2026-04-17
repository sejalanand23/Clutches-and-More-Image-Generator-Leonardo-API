import requests, os, json
from dotenv import load_dotenv
load_dotenv(".env")
api_key = os.getenv("LEONARDO_API_KEY")

headers = {
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
    "Content-Type": "application/json"
}
image_url = "https://cdn.leonardo.ai/users/56e90e76-b3ed-4bf1-942c-5a064bfc4a22/initImages/d6e01676-a661-4875-9e27-585b14e86a4f.jpeg"
prompt = "commercial studio photography, beautifully lit environment, highly detailed, sharp focus, marble countertop"

# Omit creativeBrief
payload = {
    "blueprintVersionId": "ef51b59d-1734-4c92-abb0-6f66a4e33cb3",
    "input": {
        "public": False,
        "nodeInputs": [
            {
                "nodeId": "c5cef162-0d59-4a13-a8aa-1ae881e62f85",
                "settingName": "imageUrl",
                "value": image_url
            },
            {
                "nodeId": "238ea0da-49ef-45d7-bf67-7066eab6a547",
                "settingName": "textVariables",
                "value": [
                    {"name": "environment", "value": prompt[:200]}
                ]
            }
        ]
    }
}
resp = requests.post("https://cloud.leonardo.ai/api/rest/v1/blueprint-executions", headers=headers, json=payload)
print(resp.status_code, resp.text)
if resp.ok and not isinstance(resp.json(), list):
    print("SUCCESS")
