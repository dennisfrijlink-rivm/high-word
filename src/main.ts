import { snapdom } from "@zumer/snapdom";
import { Chart, chart } from "highcharts";
import { Document, ImageRun, Packer, Paragraph } from "docx";

import "highcharts/modules/accessibility";
import "highcharts/modules/exporting";
import "highcharts/modules/offline-exporting";

// ⚙️ Globals
const chartTypes: ChartType[] = [
  "line",
  "spline",
  "column",
  "bar",
  "area",
  "areaspline",
  "scatter",
];
const maxAmount = 500;

let confirmButton: HTMLElement | null;
let exportButton: HTMLButtonElement | null;
let wrapper: HTMLElement | null;
let amountInput: HTMLInputElement | null;
let loadingLayer: HTMLElement | null;
let loadingIndicator: HTMLElement | null;
let charts: Chart[] = [];

// 🔢 Helpers
function getRandomInt(minimum: number, maximum?: number): number {
  if (maximum === undefined) {
    maximum = minimum;
    minimum = 0;
  }
  if (minimum >= maximum) {
    throw new Error("Invalid input: maximum must be greater than minimum.");
  }
  return Math.floor(Math.random() * (maximum - minimum) + minimum);
}

function getRandomData(length: number, max: number): number[] {
  return Array.from({ length }, () => getRandomInt(1, max));
}

function getChartType(arr: ChartType[]): ChartType {
  return arr[getRandomInt(0, arr.length)];
}

function getSeries(type: ChartType, amount: number, dataPoints = 20, maxY = 50): Serie[] {
  return Array.from({ length: amount }, (_, i) => ({
    type,
    name: `Series ${i + 1}`,
    data: getRandomData(dataPoints, maxY),
  }));
}

// 📊 Chart Generation
function initChart(no: number, types: ChartType[], wrapper: HTMLElement): Chart {
  const type = getChartType(types);
  const series = getSeries(type, getRandomInt(1, 5));

  const el = document.createElement("div");
  const renderTo = `chart-${no}`;
  el.id = renderTo;
  wrapper.appendChild(el);

  return chart({
    chart: { renderTo, type },
    title: {
      text: `No. ${no} - Random ${type.charAt(0).toUpperCase() + type.slice(1)} Chart`,
    },
    series,
    exporting: { enabled: false },
  });
}

async function renderCharts(to: HTMLElement, chartCount: number, delay = 0): Promise<Chart[]> {
  const renderedCharts: Chart[] = [];

  for (let index = 1; index <= chartCount; index++) {
    try {
      const newChart = initChart(index, chartTypes, to);
      renderedCharts.push(newChart);

      if (loadingIndicator) {
        loadingIndicator.innerHTML = `<span>Laden van grafiek nr. <mark>${index}</mark> van de ${chartCount}</span>`;
      }
    } catch (err) {
      console.error(`Chart ${index} failed to render`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  return renderedCharts;
}

function remToPx(value: string, basePx: number): string {
  const regex = /^([\d.]+)(em|rem)$/;
  const match = value.match(regex);
  if (!match) return value;
  const number = parseFloat(match[1]);
  return `${number * basePx}px`;
}

function processFontSize(value: string | null, basePx: number): string | null {
  if (!value) return value;
  if (value.endsWith("em") || value.endsWith("rem")) {
    return remToPx(value, basePx);
  }
  return value;
}

function convertSvgFontSizes(svg: string, basePx: number = 16): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");

  // font-size attribuut verwerken
  const allElements = doc.querySelectorAll<SVGElement>("[font-size]");
  allElements.forEach((el) => {
    const size = el.getAttribute("font-size");
    const newSize = processFontSize(size, basePx);
    if (newSize && newSize !== size) {
      el.setAttribute("font-size", newSize);
    }
  });

  // inline styles met font-size verwerken
  const styledElements = doc.querySelectorAll<SVGElement>("[style]");
  styledElements.forEach((el) => {
    const style = el.getAttribute("style");
    if (!style) return;
    const fontSizeRegex = /font-size\s*:\s*([^;]+);?/g;

    const newStyle = style.replace(fontSizeRegex, (match, p1) => {
      const newSize = processFontSize(p1.trim(), basePx);
      return newSize ? `font-size: ${newSize};` : match;
    });

    if (newStyle !== style) {
      el.setAttribute("style", newStyle);
    }
  });

  // DOM weer terug naar string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

// ⭐ SVG export
function generateSvg(chart: Chart, basePx: number = 16): Uint8Array<ArrayBuffer> {
  // @ts-ignore
  const svg = chart.getSVG();
  const formatted = convertSvgFontSizes(svg, basePx);
  const encoder = new TextEncoder();
  return encoder.encode(formatted);
}

// 📸 PNG export
async function generatePng(el: HTMLElement): Promise<string> {
  const dom = await snapdom(el, { scale: 2 });
  const { src } = await dom.toPng();
  return src;
}

// 📄 Word export
async function exportWord(images: ImageAndVector[], filename: string): Promise<void> {
  const sections = images.map((image) => ({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: "svg",
            data: image.svg,
            transformation: { width: 504, height: 400 },
            fallback: {
              type: "png",
              data: image.png,
            },
          }),
        ],
      }),
    ],
  }));

  const doc = new Document({ sections });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 🧠 Validatie
function getValidatedAmount(): number | null {
  const value = Number(amountInput?.value);
  if (!Number.isInteger(value) || value < 1 || value > maxAmount) return null;
  return value;
}

// 🧩 Chart generatie handler
async function handleChartGeneration(): Promise<void> {
  if (!loadingLayer || !wrapper || !amountInput || !exportButton) return;

  const amount = getValidatedAmount();
  if (amount == null) {
    alert(`Voer een geldig aantal in tussen 1 en ${maxAmount}`);
    return;
  }

  loadingLayer.style.display = "grid";
  wrapper.innerHTML = "";
  exportButton.disabled = true;

  try {
    charts = await renderCharts(wrapper, amount, 10);
  } catch (error) {
    console.error("Fout bij het genereren van grafieken:", error);
  }

  loadingLayer.style.display = "none";
  exportButton.disabled = false;
}

// 🚀 Init
document.addEventListener("DOMContentLoaded", () => {
  confirmButton = document.getElementById("confirm");
  exportButton = document.getElementById("export") as HTMLButtonElement;
  wrapper = document.getElementById("charts");
  amountInput = document.getElementById("graph-count") as HTMLInputElement;
  loadingLayer = document.getElementById("loading");
  loadingIndicator = document.getElementById("indicator");

  if (!wrapper || !confirmButton || !exportButton || !amountInput) return;

  amountInput.placeholder = `Aantal grafieken (max. ${maxAmount})`;

  amountInput.addEventListener("change", () => {
    const value = Number(amountInput?.value);
    if (amountInput) {
      if (value > maxAmount) amountInput.value = `${maxAmount}`;
      if (value < 1) amountInput.value = `1`;
    }
  });

  amountInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") await handleChartGeneration();
  });

  confirmButton.addEventListener("click", async () => {
    await handleChartGeneration();
  });

  exportButton.addEventListener("click", async () => {
    if (!loadingLayer || !loadingIndicator) return;
    loadingLayer.style.display = "grid";
    loadingIndicator.innerHTML = "";

    const imagesAndVectors: ImageAndVector[] = [];

    for (const [index, chart] of charts.entries()) {
      try {
        const png = await generatePng(chart.container);
        const svg = generateSvg(chart);

        imagesAndVectors.push({ png, svg });
        loadingIndicator.innerHTML = `<span>Afbeelding generen van grafiek nr. <mark style="background: #1d5fbf; color: white;">${index}</mark> van de ${charts.length}</span>`;
      } catch (err) {
        console.warn("Kon PNG niet genereren voor grafiek:", err);
      }
    }

    loadingLayer.style.display = "none";

    if (imagesAndVectors.length === 0) {
      alert("Er zijn geen grafieken om te exporteren.");
      return;
    }

    await exportWord(imagesAndVectors, "alle-grafieken");
  });
});
