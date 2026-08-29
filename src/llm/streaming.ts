/** Parses an OpenAI-style `text/event-stream` body into decoded JSON chunks. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (!line.startsWith("data:")) continue

        const data = line.slice(5).trim()
        if (data === "[DONE]") return
        try {
          yield JSON.parse(data)
        } catch {
          // Skip malformed chunks rather than aborting the whole stream.
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
