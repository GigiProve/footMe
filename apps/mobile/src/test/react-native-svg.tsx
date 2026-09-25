/**
 * `react-native-svg` è una libreria nativa: sotto Vitest non esiste. I test
 * hanno bisogno solo di sapere che i nodi vengono emessi, non di disegnarli.
 */
import { createElement, type ReactNode } from "react";

function makeSvgElement(name: string) {
  return function SvgElement(props: Record<string, unknown> & { children?: ReactNode }) {
    return createElement(name, props);
  };
}

const Svg = makeSvgElement("Svg");

export const Circle = makeSvgElement("Circle");
export const ClipPath = makeSvgElement("ClipPath");
export const Defs = makeSvgElement("Defs");
export const Ellipse = makeSvgElement("Ellipse");
export const G = makeSvgElement("G");
export const Line = makeSvgElement("Line");
export const LinearGradient = makeSvgElement("LinearGradient");
export const Path = makeSvgElement("Path");
export const Polygon = makeSvgElement("Polygon");
export const Polyline = makeSvgElement("Polyline");
export const RadialGradient = makeSvgElement("RadialGradient");
export const Rect = makeSvgElement("Rect");
export const Stop = makeSvgElement("Stop");
export const Text = makeSvgElement("SvgText");

export default Svg;
