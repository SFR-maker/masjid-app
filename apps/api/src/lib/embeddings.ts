const VOYAGE_API_KEY = process.env.VOYAGE_AI_API_KEY
export const SIMILARITY_THRESHOLD = 0.88

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!VOYAGE_API_KEY) return null

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: [text.slice(0, 2000)], model: 'voyage-3-lite' }),
    })

    if (!response.ok) return null

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch {
    return null
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
