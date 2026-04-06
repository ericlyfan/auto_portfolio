import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractFujiRecipe } from "@/lib/exif";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  mockExecFileSync.mockReset();
});

describe("extractFujiRecipe", () => {
  it("returns formatted recipe string for a Fujifilm image", async () => {
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([
        {
          "MakerNotes:FilmMode": "Classic Chrome",
          "MakerNotes:GrainEffectRoughness": "Weak",
          "MakerNotes:GrainEffectSize": "Small",
          "MakerNotes:ColorChromeEffect": "Strong",
          "MakerNotes:ColorChromeFXBlue": "Weak",
          "MakerNotes:WhiteBalance": "Auto",
          "MakerNotes:WhiteBalanceFineTune": "Red +40, Blue -80",
          "MakerNotes:DynamicRangeSetting": "Auto",
          "MakerNotes:HighlightTone": "-1 (medium soft)",
          "MakerNotes:ShadowTone": "-1 (medium soft)",
          "MakerNotes:Saturation": "+2 (high)",
          "MakerNotes:NoiseReduction": "-4 (weakest)",
          "MakerNotes:Sharpness": "-2 (soft)",
          "MakerNotes:Clarity": "0",
          "EXIF:ExposureCompensation": "0",
        },
      ])
    );

    const result = await extractFujiRecipe("/fake/path.jpg");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "exiftool",
      ["-json", "-G", "-a", "/fake/path.jpg"],
      { encoding: "utf-8" }
    );

    expect(result).toBe(
      [
        "Classic Chrome",
        "Grain Effect: Weak, Small",
        "Color Chrome Effect: Strong",
        "Color Chrome Effect Blue: Weak",
        "White Balance: Auto, +2 Red & -4 Blue",
        "Dynamic Range: DR-Auto",
        "Highlight: -1",
        "Shadow: -1",
        "Color: +2",
        "Noise Reduction: -4",
        "Sharpening: -2",
        "Clarity: 0",
        "Exposure Compensation: 0",
      ].join("\n")
    );
  });

  it("returns null for non-Fujifilm image (no FilmMode)", async () => {
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([
        {
          "EXIF:Make": "Canon",
          "EXIF:Model": "EOS R5",
          "EXIF:ISO": "400",
        },
      ])
    );

    const result = await extractFujiRecipe("/fake/canon.jpg");
    expect(result).toBeNull();
  });

  it("handles grain effect both off", async () => {
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([
        {
          "MakerNotes:FilmMode": "Provia",
          "MakerNotes:GrainEffectRoughness": "Off",
          "MakerNotes:GrainEffectSize": "Off",
          "MakerNotes:ColorChromeEffect": "Off",
          "MakerNotes:ColorChromeFXBlue": "Off",
          "MakerNotes:WhiteBalance": "Auto",
          "MakerNotes:WhiteBalanceFineTune": "Red 0, Blue 0",
          "MakerNotes:DynamicRange": "Standard",
          "MakerNotes:DevelopmentDynamicRange": "200",
          "MakerNotes:HighlightTone": "0 (normal)",
          "MakerNotes:ShadowTone": "0 (normal)",
          "MakerNotes:Saturation": "0 (normal)",
          "MakerNotes:NoiseReduction": "0 (normal)",
          "MakerNotes:Sharpness": "0 (normal)",
          "MakerNotes:Clarity": "0",
          "EXIF:ExposureCompensation": "0",
        },
      ])
    );

    const result = await extractFujiRecipe("/fake/provia.jpg");

    expect(result).toContain("Provia");
    expect(result).toContain("Grain Effect: Off");
    expect(result).toContain("White Balance: Auto");
    expect(result).not.toContain("Red &");
    expect(result).toContain("Dynamic Range: DR200");
  });

  it("returns null when exiftool fails", async () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("exiftool not found");
    });

    const result = await extractFujiRecipe("/fake/broken.jpg");
    expect(result).toBeNull();
  });
});
