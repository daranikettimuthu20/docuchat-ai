// Split the full PDF text into overlapping chunks
// Each chunk is ~500 words with 50 word overlap so context is not lost at boundaries
export function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 50) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

// Score each chunk against the user's question using TF-IDF
// TF = how often the word appears in this chunk
// IDF = how rare the word is across all chunks (rare = more meaningful)
function scoreTFIDF(chunks, query) {
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2); // skip short words like "is", "a", "the"

  return chunks.map((chunk) => {
    const chunkWords = chunk.toLowerCase().split(/\s+/);
    let score = 0;

    for (const word of queryWords) {
      // Term frequency — how often this word appears in this chunk
      const tf = chunkWords.filter(w => w.includes(word)).length / chunkWords.length;

      // Inverse document frequency — penalize words that appear in every chunk
      const docsWithWord = chunks.filter(c =>
        c.toLowerCase().includes(word)
      ).length;
      const idf = Math.log((chunks.length + 1) / (docsWithWord + 1));

      score += tf * idf;
    }

    return { chunk, score };
  });
}

// Return the top K most relevant chunks for the question
export function getRelevantChunks(chunks, query, topK = 4) {
  if (chunks.length === 0) return [];

  const scored = scoreTFIDF(chunks, query);
  scored.sort((a, b) => b.score - a.score);

  // Always include at least some context even if scores are low
  return scored
    .slice(0, topK)
    .map(s => s.chunk)
    .filter(c => c.length > 0);
}