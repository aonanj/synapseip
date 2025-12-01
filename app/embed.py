from __future__ import annotations

import os
from collections.abc import Sequence
from dotenv import load_dotenv

from openai import OpenAI
load_dotenv()

async def embed(text: str) -> Sequence[float]:
    model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    out = client.embeddings.create(model=model, input=text)
    return out.data[0].embedding
