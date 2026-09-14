from __future__ import annotations

import os
from collections.abc import Sequence

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
# Module-level client: constructing one per request added a connection-pool
# setup to every query for no benefit.
_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def embed(text: str) -> Sequence[float]:
    out = _client.embeddings.create(model=_MODEL, input=text)
    return out.data[0].embedding
