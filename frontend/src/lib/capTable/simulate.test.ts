import { describe, expect, it } from "vitest";
import { simulateCapTable } from "@/lib/capTable/simulate";

const workbookLikeInput = {
  participants: [
    { id: "p1", name: "Socio 1", type: "founder" as const, className: "A", amount: 9900 },
    { id: "p2", name: "Socio 2", type: "founder" as const, className: "A", amount: 100 },
  ],
  convertibles: Array.from({ length: 30 }, (_, index) => ({
    id: `c${index + 1}`,
    name: `Investor ${String(index + 1).padStart(2, "0")}`,
    instrumentType: "sfp" as const,
    className: "B",
    amountEur: 5000,
    discount: 0.2,
  })),
  round: {
    preMoney: 2250000,
    conversionValuation: 2887500,
    raiseAmount: 15000,
    floor: 1500000,
    cap: 3000000,
    defaultDiscount: 0.2,
    optionPoolAmount: 0,
    optionPoolMode: "pre_money" as const,
  },
};

describe("simulateCapTable", () => {
  it("matches the workbook-style final conversion outputs", () => {
    const result = simulateCapTable(workbookLikeInput);

    expect(result.summary.preCapitalNominal).toBe(10000);
    expect(result.summary.roundCapitalNominal).toBeCloseTo(66.67, 2);
    expect(result.summary.postRoundPreConversionNominal).toBeCloseTo(10066.67, 2);
    expect(result.summary.conversionCapitalNominal).toBeCloseTo(653.68, 2);
    expect(result.summary.postCapitalNominal).toBeCloseTo(10720.35, 2);
    expect(result.summary.totalPremiumEur).toBeCloseTo(149346.32, 2);

    const sfpAggregate = result.participants.find((item) => item.id === "round-investors");
    expect(sfpAggregate?.roundNominalAmount).toBeCloseTo(66.67, 2);

    const firstConvertible = result.convertibleDetails[0];
    expect(firstConvertible.finalCase).toBe("C");
    expect(firstConvertible.finalConversionNominalAmount).toBeCloseTo(21.79, 2);
    expect(firstConvertible.finalPremiumAmountEur).toBeCloseTo(4978.21, 2);
  });

  it("matches the workbook scenario previews for A, B and C", () => {
    const result = simulateCapTable(workbookLikeInput);
    const scenarioA = result.scenarioPreviews.find((item) => item.caseId === "A");
    const scenarioB = result.scenarioPreviews.find((item) => item.caseId === "B");
    const scenarioC = result.scenarioPreviews.find((item) => item.caseId === "C");

    expect(scenarioA?.conversionNominalPerTicket).toBeCloseTo(33.56, 2);
    expect(scenarioA?.conversionNominalTotal).toBeCloseTo(1006.67, 2);
    expect(scenarioA?.postCapitalNominal).toBeCloseTo(11006.67, 2);

    expect(scenarioB?.conversionNominalPerTicket).toBeCloseTo(16.78, 2);
    expect(scenarioB?.conversionNominalTotal).toBeCloseTo(503.33, 2);
    expect(scenarioB?.postCapitalNominal).toBeCloseTo(10503.33, 2);

    expect(scenarioC?.valuation).toBeCloseTo(2250000, 2);
    expect(scenarioC?.discountedValuation).toBeCloseTo(1800000, 2);
    expect(scenarioC?.conversionNominalPerTicket).toBeCloseTo(27.96, 2);
    expect(scenarioC?.conversionNominalTotal).toBeCloseTo(838.89, 2);
    expect(scenarioC?.postCapitalNominal).toBeCloseTo(10838.89, 2);
  });

  it("keeps ownership balanced at 100% after conversion", () => {
    const result = simulateCapTable(workbookLikeInput);
    const totalOwnership = result.participants.reduce((sum, item) => sum + item.postOwnershipPct, 0);
    expect(totalOwnership).toBeCloseTo(1, 6);
  });
});
