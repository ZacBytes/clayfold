import type { ComponentPropsWithoutRef, ReactElement } from "react";

export type IconProps = Omit<ComponentPropsWithoutRef<"img">, "src"> & {
  src: string;
  size?: number | string;
};

export function Icon(props: IconProps): ReactElement;
