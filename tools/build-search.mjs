import { readFile, writeFile } from "node:fs/promises";
import { pipeline, env } from "@huggingface/transformers";
import { modelName, modelOptions, embeddingOptions, embeddingText } from "../js/model.mjs";

const root = new URL("../", import.meta.url);
const { categories, icons } = JSON.parse(await readFile(new URL("catalog.json", root), "utf8"));
env.allowLocalModels = false;
const model = await pipeline("feature-extraction", modelName, { ...modelOptions, device: "cpu" });
const index = {};
for (const icon of icons) {
  const { data } = await model(embeddingText(icon, categories), embeddingOptions);
  const scale = Math.max(...data.map(Math.abs)) / 127;
  index[icon.id] = Array.from(data, value => Math.round(value / scale));
}
await writeFile(new URL("embeddings.json", root), JSON.stringify(index) + "\n");
console.log(`Indexed ${icons.length} icons.`);
