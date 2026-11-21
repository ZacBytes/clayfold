import { modelName, modelOptions, embeddingOptions } from "./model.mjs";

let engine;
let sequence = 0;
const dimensions = 384;

async function loadSearch() {
  const [runtime, indexResponse] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js"),
    fetch(new URL("../embeddings.json", import.meta.url)),
  ]);
  if (!indexResponse.ok) throw new Error("Search index unavailable");
  const index = await indexResponse.json();
  runtime.env.allowLocalModels = false;
  runtime.env.backends.onnx.wasm.numThreads = 1;
  const embed = await runtime.pipeline("feature-extraction", modelName, modelOptions);
  return { embed, index };
}

self.addEventListener("message", async ({ data: { id, query } }) => {
  const current = ++sequence;
  try {
    engine ??= loadSearch();
    const { embed, index } = await engine;
    if (current !== sequence) return;
    const { data } = await embed(query, embeddingOptions);
    if (current !== sequence) return;
    const scores = Object.entries(index).map(([icon, vector]) => {
      let dot = 0;
      let norm = 0;
      for (let i = 0; i < dimensions; i++) {
        dot += data[i] * vector[i];
        norm += vector[i] ** 2;
      }
      return [icon, dot / Math.sqrt(norm)];
    });
    self.postMessage({ id, scores: Object.fromEntries(scores) });
  } catch {
    if (current === sequence) self.postMessage({ id, unavailable: true });
  }
});
