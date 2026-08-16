import { describe, expect, it } from "vitest";
import { buildMissionContent } from "./mission-content.js";

const baseContext = {
  available: true,
  title: "Example",
  url: "https://example.com",
  selection: "",
  text: "hello",
};

describe("mission content", () => {
  it("uses text only when no visual frame exists", () => {
    expect(buildMissionContent("Explain", baseContext)).toEqual([
      { type: "input_text", text: "Explain" },
    ]);
  });

  it("adds a low-detail image when automatic vision is available", () => {
    const imageDataUrl = "data:image/jpeg;base64,QUJD";
    expect(buildMissionContent("Explain", {
      ...baseContext,
      visual: { available: true, imageDataUrl },
    })).toEqual([
      { type: "input_text", text: "Explain" },
      { type: "input_image", image_url: imageDataUrl, detail: "low" },
    ]);
  });

  it("ignores unavailable visual frames", () => {
    expect(buildMissionContent("Explain", {
      ...baseContext,
      visual: { available: false, imageDataUrl: "" },
    })).toHaveLength(1);
  });
});
