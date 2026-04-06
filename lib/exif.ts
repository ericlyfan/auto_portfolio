import { execFileSync } from "child_process";

/** Get a flat map of metadata, preferring MakerNotes values */
function flattenMetadata(
  metadata: Record<string, unknown>
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const shortKey = key.includes(":") ? key.split(":").pop()! : key;
    if (key.startsWith("MakerNotes:") || !flat[shortKey]) {
      flat[shortKey] = String(value ?? "");
    }
  }
  return flat;
}

/** Strip parenthetical descriptions: "-2 (soft)" → "-2" */
function stripParens(value: string): string {
  return value.replace(/\s*\(.*?\)\s*$/, "").trim();
}

/**
 * Convert WB fine tune "Red +40, Blue -100" to "+2 Red & -5 Blue"
 * exiftool reports in units of 20 per step
 */
function formatWBFineTune(raw: string): string {
  const redMatch = raw.match(/Red\s*([+-]?\d+)/i);
  const blueMatch = raw.match(/Blue\s*([+-]?\d+)/i);
  if (!redMatch || !blueMatch) return raw;

  const redSteps = Math.round(parseInt(redMatch[1]) / 20);
  const blueSteps = Math.round(parseInt(blueMatch[1]) / 20);

  const redStr = redSteps >= 0 ? `+${redSteps}` : `${redSteps}`;
  const blueStr = blueSteps >= 0 ? `+${blueSteps}` : `${blueSteps}`;

  return `${redStr} Red & ${blueStr} Blue`;
}

function formatRecipe(flat: Record<string, string>): string {
  const lines: string[] = [];

  const filmMode = flat["FilmMode"];
  if (filmMode) lines.push(filmMode);

  const grainRoughness = flat["GrainEffectRoughness"];
  const grainSize = flat["GrainEffectSize"];
  if (grainRoughness && grainSize) {
    if (grainRoughness === "Off" && grainSize === "Off") {
      lines.push("Grain Effect: Off");
    } else {
      lines.push(`Grain Effect: ${grainRoughness}, ${grainSize}`);
    }
  }

  const colorChrome = flat["ColorChromeEffect"] || flat["ChromeEffect"];
  if (colorChrome) lines.push(`Color Chrome Effect: ${colorChrome}`);

  const colorChromeFXBlue = flat["ColorChromeFXBlue"];
  if (colorChromeFXBlue)
    lines.push(`Color Chrome Effect Blue: ${colorChromeFXBlue}`);

  const wb = flat["WhiteBalance"];
  const wbFineTune = flat["WhiteBalanceFineTune"];
  if (wb) {
    if (wbFineTune && wbFineTune !== "0" && wbFineTune !== "Red 0, Blue 0") {
      lines.push(`White Balance: ${wb}, ${formatWBFineTune(wbFineTune)}`);
    } else {
      lines.push(`White Balance: ${wb}`);
    }
  }

  const drSetting = flat["DynamicRangeSetting"];
  const drValue = flat["DevelopmentDynamicRange"];
  const dr = flat["DynamicRange"];
  if (drSetting === "Auto" || dr === "Auto") {
    lines.push("Dynamic Range: DR-Auto");
  } else if (drValue) {
    lines.push(`Dynamic Range: DR${drValue}`);
  } else if (dr) {
    lines.push(`Dynamic Range: ${dr}`);
  }

  const highlight = flat["HighlightTone"];
  if (highlight) lines.push(`Highlight: ${stripParens(highlight)}`);

  const shadow = flat["ShadowTone"];
  if (shadow) lines.push(`Shadow: ${stripParens(shadow)}`);

  const color = flat["Saturation"] || flat["Color"];
  if (color) lines.push(`Color: ${stripParens(color)}`);

  const nr = flat["NoiseReduction"];
  if (nr) lines.push(`Noise Reduction: ${stripParens(nr)}`);

  const sharpness = flat["Sharpness"];
  if (sharpness) lines.push(`Sharpening: ${stripParens(sharpness)}`);

  const clarity = flat["Clarity"];
  if (clarity !== undefined) lines.push(`Clarity: ${stripParens(clarity)}`);

  const ec = flat["ExposureCompensation"];
  if (ec !== undefined) lines.push(`Exposure Compensation: ${ec}`);

  return lines.join("\n");
}

/**
 * Extract Fujifilm recipe from an image file using exiftool.
 * Returns formatted recipe string, or null if no Fuji data found.
 */
export async function extractFujiRecipe(
  filePath: string
): Promise<string | null> {
  try {
    const raw = execFileSync(
      "exiftool",
      ["-json", "-G", "-a", filePath],
      { encoding: "utf-8" }
    );
    const metadata = JSON.parse(raw)[0] as Record<string, unknown>;
    const flat = flattenMetadata(metadata);

    if (!flat["FilmMode"]) return null;

    return formatRecipe(flat);
  } catch {
    return null;
  }
}
