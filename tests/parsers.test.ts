/**
 * Unit tests for the pure parsing / interpretation logic — the medical core
 * that turns raw lab text and genotypes into structured facts. These run with
 * no DB and no network.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBiomarkersFromText, lookupBiomarker } from "../lib/parsers/biomarkers.ts";
import { normalizeUnits } from "../lib/parsers/normalize-units.ts";
import { evaluate, apoeGenotype, type CatalogEntry } from "../lib/dna/catalog.ts";

test("parseBiomarkersFromText extracts labelled lab values with units + ranges", () => {
  const text = [
    "Cholesterol total: 2.15 g/L (1.50 - 2.00)",
    "HDL: 0.55 g/L",
    "LDL 1.40 g/L",
    "Glycemie : 0.98 g/L",
  ].join("\n");
  const bms = parseBiomarkersFromText(text);
  const bySlug = Object.fromEntries(bms.map((b) => [b.slug, b]));

  const ldl = bms.find((b) => b.name === "LDL");
  assert.ok(ldl, "LDL parsed");
  assert.equal(ldl!.value, 1.4);

  const chol = bms.find((b) => b.name === "Cholestérol total");
  assert.ok(chol, "Cholesterol parsed");
  assert.equal(chol!.value, 2.15);
  assert.equal(chol!.refLow, 1.5);
  assert.equal(chol!.refHigh, 2.0);

  assert.ok(bySlug["hdl"] || bms.some((b) => b.name === "HDL"), "HDL parsed");
});

test("parseBiomarkersFromText protects digit-bearing codes (B12, A1c)", () => {
  const bms = parseBiomarkersFromText("Vitamine B12 454 pmol/L\nHbA1c 5.4 %");
  // The classic bug: regex captured "Vitamine B" + value=12. The protected-code
  // pass must recover B12 as the name with its real value.
  const b12 = bms.find((b) => /b12/i.test(b.name) || /b12/i.test(b.slug));
  assert.ok(b12, "B12 recovered as a biomarker, not split into value 12");
  assert.notEqual(b12!.value, 12);
});

test("lookupBiomarker resolves aliases to canonical names", () => {
  assert.equal(lookupBiomarker("glucose")?.name, "Glycémie");
  assert.equal(lookupBiomarker("cholesterol total")?.name, "Cholestérol total");
  assert.equal(lookupBiomarker("ldl-c")?.name, "LDL");
  assert.equal(lookupBiomarker("zzz not a marker"), null);
});

test("normalizeUnits accepts a sane in-range value and rejects garbage", () => {
  const ok = normalizeUnits("ldl", 1.3, "g/L");
  assert.ok(ok, "a normal LDL passes the sanity check");
  assert.equal(typeof ok!.value, "number");

  // Parser garbage (an implausible magnitude) must be rejected, not stored.
  const garbage = normalizeUnits("ldl", 999999, "g/L");
  assert.equal(garbage, null, "absurd value rejected by sanity range");
});

test("evaluate() flags the risk genotype regardless of allele order", () => {
  const entry: CatalogEntry = {
    rsid: "rsTEST", category: "longevity", trait: "t",
    riskGenotypes: ["AC", "CC"], protectiveGenotypes: ["AA"],
    summary: "s", source: "x",
  };
  assert.equal(evaluate(entry, "CC").hasRisk, true);
  assert.equal(evaluate(entry, "CA").hasRisk, true, "CA sorts to AC → still risk");
  assert.equal(evaluate(entry, "AA").hasRisk, false);
  assert.equal(evaluate(entry, "AA").isProtective, true);
  assert.equal(evaluate(entry, "A").hasRisk, false, "single allele is never a match");
});

test("apoeGenotype derives ε haplotype from the two SNPs", () => {
  assert.equal(apoeGenotype("TT", "CC"), "ε3/ε3");
  assert.equal(apoeGenotype("CC", "CC"), "ε4/ε4");
  assert.equal(apoeGenotype(null, "CC"), "unknown");
});
