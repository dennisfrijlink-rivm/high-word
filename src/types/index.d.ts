type ChartType = "line" | "spline" | "column" | "bar" | "area" | "areaspline" | "scatter";

interface Serie {
  type: ChartType;
  name: string;
  data: number[];
}

interface ImageAndVector {
  png: string;
  svg: Uint8Array<ArrayBufferLike>;
}
