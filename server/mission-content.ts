import type { PageContext } from "./browser-context.js";

export type MissionContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "low" };

export function buildMissionContent(text: string, context?: PageContext): MissionContentPart[] {
  const content: MissionContentPart[] = [{ type: "input_text", text }];
  const imageDataUrl = context?.visual?.available ? context.visual.imageDataUrl : "";
  if (imageDataUrl) {
    content.push({ type: "input_image", image_url: imageDataUrl, detail: "low" });
  }
  return content;
}
