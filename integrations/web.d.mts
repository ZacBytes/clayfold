export type IconOptions = { format?: "webp" | "png" | "svg"; baseUrl?: string | URL };

export function iconUrl(name: string, options?: IconOptions): string;
export function renderIcons(root?: ParentNode, options?: IconOptions): void;
