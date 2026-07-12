import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

try:
    from google import genai
    client = genai.Client(api_key=api_key)
    print("Using google-genai SDK models that support generateContent:")
    models = list(client.models.list())
    for m in models:
        # Check supported actions in dict format or attribute
        actions = getattr(m, 'supported_actions', [])
        if 'generateContent' in actions:
            print(f" - {m.name} (Display: {getattr(m, 'display_name', '')})")
except Exception as e:
    print(f"google-genai error: {e}")
