import { useState, useEffect } from "react";
import { API_PREFIX } from "@/constants/api";

function getShowBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_MODE === "mock") return "";
  return API_PREFIX.replace(/\/api$/, "");
}

export const useStageSvg = (blockMapUrl: string | null | undefined) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!blockMapUrl) return;

    const fetchSvg = async () => {
      try {
        const response = await fetch(getShowBaseUrl() + blockMapUrl);
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }
        const text = await response.text();
        setSvgContent(text);
      } catch (err) {
        console.error("SVG Loading Error:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    };

    fetchSvg();
  }, [blockMapUrl]);

  return { svgContent, error };
};
