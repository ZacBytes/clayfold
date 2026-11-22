import { createElement } from "react";

export function Icon({ src, size = 24, alt = "", ...props }) {
  return createElement("img", { width: size, height: size, ...props, src, alt });
}
