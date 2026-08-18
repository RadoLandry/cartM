CREATE INDEX IF NOT EXISTS "Product_embedding_ivfflat_cosine_idx"
ON "Product"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100)
WHERE embedding IS NOT NULL;

ANALYZE "Product";