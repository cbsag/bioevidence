import fs from "node:fs";
import path from "node:path";

import type { BioEvidenceSample } from "@/lib/bioevidence-types";

let cachedSample: BioEvidenceSample | null = null;

export function loadBioEvidenceSample(): BioEvidenceSample {
  if (cachedSample) return cachedSample;

  const filePath = path.join(
    process.cwd(),
    "data",
    "bioevidence-sample.json",
  );
  cachedSample = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as BioEvidenceSample;
  return cachedSample;
}
