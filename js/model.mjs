export const modelName = "Xenova/all-MiniLM-L6-v2";
export const modelRevision = "751bff37182d3f1213fa05d7196b954e230abad9";
export const modelOptions = { revision: modelRevision, dtype: "q8", device: "wasm" };
export const embeddingOptions = { pooling: "mean", normalize: true };

export function embeddingText(icon, categories) {
  return [icon.label, icon.subject, icon.description, (icon.tags ?? []).join(", "), categories[icon.category]].filter(Boolean).join(". ");
}
