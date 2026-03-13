import type {
  CapTableParticipantInput,
  CapTableScenarioInput,
  ConvertibleOutcomeDetail,
  ConvertibleHolderInput,
  ParticipantOutcome,
  ScenarioPreview,
  SimulationResult,
} from "@/types/capTable";

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeDiscount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function computeOwnership(amount: number, total: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(total) || total <= 0) return 0;
  return amount / total;
}

function computeRoundNominal(preCapital: number, preMoney: number, raiseAmount: number): number {
  if (raiseAmount <= 0 || preMoney <= 0 || preCapital <= 0) return 0;
  return (raiseAmount / preMoney) * preCapital;
}

function resolveScenarioCase(discountedValuation: number, floor: number, cap: number) {
  if (discountedValuation <= floor) {
    return { scenarioCase: "A" as const, conversionBase: floor };
  }
  if (discountedValuation >= cap) {
    return { scenarioCase: "B" as const, conversionBase: cap };
  }
  return { scenarioCase: "C" as const, conversionBase: discountedValuation };
}

function computeScenarioPreview(
  caseId: "A" | "B" | "C",
  valuation: number,
  effectiveDiscount: number,
  input: CapTableScenarioInput,
  ticketAmountEur: number,
  totalConvertibleEur: number,
  preCapital: number,
  preRoundPreConversionNominal: number,
  participants: CapTableParticipantInput[],
  conversionValuation: number
): ScenarioPreview {
  const discountedValuation =
    caseId === "C" ? valuation * (1 - normalizeDiscount(effectiveDiscount)) : valuation;
  const appliedConversionBase =
    caseId === "A" ? input.round.floor : caseId === "B" ? input.round.cap : discountedValuation;
  const fullyDilutedNominal = preRoundPreConversionNominal;
  const conversionNominalPerTicket =
    appliedConversionBase > 0 ? (ticketAmountEur * fullyDilutedNominal) / appliedConversionBase : 0;
  const conversionNominalTotal =
    appliedConversionBase > 0 ? (totalConvertibleEur * fullyDilutedNominal) / appliedConversionBase : 0;
  const premiumPerTicketEur = Math.max(0, ticketAmountEur - conversionNominalPerTicket);
  const premiumTotalEur = Math.max(0, totalConvertibleEur - conversionNominalTotal);
  const roundNominal =
    valuation > 0 ? (toNumber(input.round.raiseAmount) / valuation) * fullyDilutedNominal : 0;
  const postCapitalNominal = preCapital + conversionNominalTotal;
  const scenarioParticipants = [
    ...participants.map((participant) => {
      const preNominalAmount = toNumber(participant.amount);
      const postNominalAmount = preNominalAmount;
      return {
        id: participant.id,
        name: participant.name,
        preNominalAmount,
        postNominalAmount,
        postOwnershipPct: computeOwnership(postNominalAmount, postCapitalNominal),
      };
    }),
    ...(totalConvertibleEur > 0
      ? [
          {
            id: `scenario-${caseId}-convertibles`,
            name: "Safers",
            preNominalAmount: 0,
            postNominalAmount: conversionNominalTotal,
            postOwnershipPct: computeOwnership(conversionNominalTotal, postCapitalNominal),
          },
        ]
      : []),
  ];

  return {
    caseId,
    label:
      caseId === "A"
        ? "Valuation scontata <= floor"
        : caseId === "B"
          ? "Valuation scontata >= cap"
          : "Valuation scontata tra floor e cap",
    valuation,
    discountedValuation,
    appliedConversionBase,
    roundNominal,
    conversionNominalPerTicket,
    conversionNominalTotal,
    premiumPerTicketEur,
    premiumTotalEur,
    postCapitalNominal,
    participants: scenarioParticipants,
  };
}

function buildParticipantOutcome(
  participant: CapTableParticipantInput,
  preCapital: number,
  postCapital: number
): ParticipantOutcome {
  const preAmount = toNumber(participant.amount);
  const postAmount = preAmount;
  const preOwnershipPct = computeOwnership(preAmount, preCapital);
  const postOwnershipPct = computeOwnership(postAmount, postCapital);
  return {
    id: participant.id,
    name: participant.name,
    type: participant.type,
    className: participant.className,
    cashAmountEur: 0,
    preNominalAmount: preAmount,
    roundNominalAmount: 0,
    conversionNominalAmount: 0,
    postNominalAmount: postAmount,
    preOwnershipPct,
    postOwnershipPct,
    dilutionPct: Math.max(0, preOwnershipPct - postOwnershipPct),
    premiumAmountEur: 0,
    scenarioCase: null,
  };
}

function computeConvertibleOutcome(
  holder: ConvertibleHolderInput,
  conversionValuation: number,
  floor: number,
  cap: number,
  fullyDilutedNominal: number,
  postCapital: number
): ParticipantOutcome {
  const amountEur = toNumber(holder.amountEur);
  const effectiveDiscount = normalizeDiscount(holder.discount);
  const discountedValuation = conversionValuation * (1 - effectiveDiscount);
  const { scenarioCase, conversionBase } = resolveScenarioCase(
    discountedValuation,
    floor,
    cap
  );

  const nominalConversion =
    conversionBase > 0 ? (amountEur * fullyDilutedNominal) / conversionBase : 0;
  const premiumAmount = Math.max(0, amountEur - nominalConversion);
  const postAmount = nominalConversion;
  const postOwnershipPct = computeOwnership(postAmount, postCapital);

  return {
    id: holder.id,
    name: holder.name,
    type: holder.instrumentType,
    className: holder.className,
    cashAmountEur: amountEur,
    preNominalAmount: 0,
    roundNominalAmount: 0,
    conversionNominalAmount: nominalConversion,
    postNominalAmount: postAmount,
    preOwnershipPct: 0,
    postOwnershipPct,
    dilutionPct: 0,
    premiumAmountEur: premiumAmount,
    scenarioCase,
  };
}

export function simulateCapTable(input: CapTableScenarioInput): SimulationResult {
  const participants = Array.isArray(input.participants) ? input.participants : [];
  const convertibles = Array.isArray(input.convertibles) ? input.convertibles : [];
  const conversionValuation =
    toNumber(input.round.conversionValuation) > 0 ? toNumber(input.round.conversionValuation) : toNumber(input.round.preMoney);

  const preCapital = participants.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const optionPoolCapital = toNumber(input.round.optionPoolAmount);
  const roundCapitalBase =
    preCapital + (input.round.optionPoolMode === "pre_money" ? optionPoolCapital : 0);
  const roundCapital = computeRoundNominal(roundCapitalBase, input.round.preMoney, input.round.raiseAmount);

  const postRoundPreConversionNominal =
    preCapital +
    roundCapital +
    (input.round.optionPoolMode === "pre_money" ? optionPoolCapital : 0);

  const convertibleBases = convertibles.map((holder) => {
    const effectiveDiscount = Number.isFinite(holder.discount)
      ? holder.discount
      : input.round.defaultDiscount;
    const discountedValuation = conversionValuation * (1 - normalizeDiscount(effectiveDiscount));
    const { scenarioCase, conversionBase } = resolveScenarioCase(
      discountedValuation,
      input.round.floor,
      input.round.cap
    );
    return {
      holder,
      scenarioCase,
      conversionBase,
    };
  });

  const fullyDilutedNominal = postRoundPreConversionNominal;
  const postCapital =
    fullyDilutedNominal +
    convertibleBases.reduce(
      (sum, item) =>
        sum +
        (item.conversionBase > 0
          ? (toNumber(item.holder.amountEur) * fullyDilutedNominal) / item.conversionBase
          : 0),
      0
    ) +
    (input.round.optionPoolMode === "post_money" ? optionPoolCapital : 0);

  const convertibleOutcomes = convertibleBases.map(({ holder }) =>
    computeConvertibleOutcome(holder, conversionValuation, input.round.floor, input.round.cap, fullyDilutedNominal, postCapital)
  );

  const conversionCapital = convertibleOutcomes.reduce((sum, item) => sum + item.conversionNominalAmount, 0);
  const postMoney = input.round.preMoney + input.round.raiseAmount;
  const totalPremiumEur = convertibleOutcomes.reduce((sum, item) => sum + item.premiumAmountEur, 0);
  const firstTicketAmount = toNumber(convertibles[0]?.amountEur);
  const totalConvertibleEur = convertibles.reduce((sum, item) => sum + toNumber(item.amountEur), 0);
  const scenarioPreviews: ScenarioPreview[] = [
    computeScenarioPreview("A", input.round.floor, input.round.defaultDiscount, input, firstTicketAmount, totalConvertibleEur, preCapital, postRoundPreConversionNominal, participants, conversionValuation),
    computeScenarioPreview("B", input.round.cap, input.round.defaultDiscount, input, firstTicketAmount, totalConvertibleEur, preCapital, postRoundPreConversionNominal, participants, conversionValuation),
    computeScenarioPreview(
      "C",
      input.round.floor > 0 && input.round.cap > 0 ? (input.round.floor + input.round.cap) / 2 : input.round.preMoney,
      input.round.defaultDiscount,
      input,
      firstTicketAmount,
      totalConvertibleEur,
      preCapital,
      postRoundPreConversionNominal,
      participants,
      conversionValuation
    ),
  ];
  const scenarioPreviewMap = new Map(scenarioPreviews.map((preview) => [preview.caseId, preview]));
  const convertibleDetails: ConvertibleOutcomeDetail[] = convertibles.map((holder, index) => {
    const effectiveDiscount = Number.isFinite(holder.discount)
      ? holder.discount
      : input.round.defaultDiscount;
    const scenarioCases = (["A", "B", "C"] as const).map((caseId) => {
      const preview = scenarioPreviewMap.get(caseId);
      const conversionNominalAmount =
        preview && preview.conversionNominalPerTicket > 0
          ? (toNumber(holder.amountEur) / Math.max(firstTicketAmount, 1)) * preview.conversionNominalPerTicket
          : 0;
      const premiumAmountEur = Math.max(0, toNumber(holder.amountEur) - conversionNominalAmount);
      return {
        caseId,
        discountedValuation: preview?.discountedValuation ?? 0,
        appliedConversionBase: preview?.appliedConversionBase ?? 0,
        conversionNominalAmount,
        premiumAmountEur,
        postOwnershipPct: computeOwnership(conversionNominalAmount, preview?.postCapitalNominal ?? postCapital),
      };
    });
    const finalOutcome = convertibleOutcomes[index];
    return {
      id: holder.id,
      name: holder.name,
      className: holder.className,
      amountEur: toNumber(holder.amountEur),
      discount: normalizeDiscount(effectiveDiscount),
      finalCase: finalOutcome?.scenarioCase ?? "C",
      finalConversionNominalAmount: finalOutcome?.conversionNominalAmount ?? 0,
      finalPremiumAmountEur: finalOutcome?.premiumAmountEur ?? 0,
      finalPostOwnershipPct: finalOutcome?.postOwnershipPct ?? 0,
      scenarios: scenarioCases,
    };
  });

  const participantOutcomes = participants.map((participant) =>
    buildParticipantOutcome(participant, preCapital, postCapital)
  );

  const roundInvestorOutcome: ParticipantOutcome = {
    id: "round-investors",
    name: "New round investors",
    type: "investor",
    className: "B",
    cashAmountEur: input.round.raiseAmount,
    preNominalAmount: 0,
    roundNominalAmount: roundCapital,
    conversionNominalAmount: 0,
    postNominalAmount: roundCapital,
    preOwnershipPct: 0,
    postOwnershipPct: computeOwnership(roundCapital, postCapital),
    dilutionPct: 0,
    premiumAmountEur: Math.max(0, input.round.raiseAmount - roundCapital),
    scenarioCase: null,
  };

  const optionPoolOutcome: ParticipantOutcome | null =
    optionPoolCapital > 0
      ? {
          id: "option-pool",
          name: "Option pool top-up",
          type: "pool",
          className: "POOL",
          cashAmountEur: 0,
          preNominalAmount: 0,
          roundNominalAmount: 0,
          conversionNominalAmount: 0,
          postNominalAmount: optionPoolCapital,
          preOwnershipPct: 0,
          postOwnershipPct: computeOwnership(optionPoolCapital, postCapital),
          dilutionPct: 0,
          premiumAmountEur: 0,
          scenarioCase: null,
        }
      : null;

  const outcomes = [
    ...participantOutcomes,
    roundInvestorOutcome,
    ...(optionPoolOutcome ? [optionPoolOutcome] : []),
    ...convertibleOutcomes.map((item) => ({
      ...item,
      postOwnershipPct: computeOwnership(item.postNominalAmount, postCapital),
    })),
  ];

  const totalDilutionPct = participantOutcomes.reduce((sum, item) => sum + item.dilutionPct, 0);

  return {
    summary: {
      preMoney: toNumber(input.round.preMoney),
      raiseAmount: toNumber(input.round.raiseAmount),
      postMoney,
      preCapitalNominal: preCapital,
      roundCapitalNominal: roundCapital,
      optionPoolNominal: optionPoolCapital,
      conversionCapitalNominal: conversionCapital,
      postCapitalNominal: postCapital,
      postRoundPreConversionNominal,
      totalPremiumEur,
      totalDilutionPct,
    },
    caseSummary: {
      caseA: convertibleOutcomes.filter((item) => item.scenarioCase === "A").length,
      caseB: convertibleOutcomes.filter((item) => item.scenarioCase === "B").length,
      caseC: convertibleOutcomes.filter((item) => item.scenarioCase === "C").length,
    },
    steps: [
      {
        id: "initial",
        label: "Step 0 · Situazione iniziale",
        capitalNominal: preCapital,
        ownershipBaseNominal: preCapital,
        cashEur: 0,
        premiumEur: 0,
      },
      {
        id: "round_pre_conversion",
        label: "Step 3 · Evento round pre-conversione",
        capitalNominal: postRoundPreConversionNominal,
        ownershipBaseNominal: postRoundPreConversionNominal,
        cashEur: input.round.raiseAmount,
        premiumEur: Math.max(0, input.round.raiseAmount - roundCapital),
      },
      {
        id: "conversion",
        label: "Step 4 · Conversione SFP",
        capitalNominal: conversionCapital,
        ownershipBaseNominal: postRoundPreConversionNominal,
        cashEur: totalConvertibleEur,
        premiumEur: totalPremiumEur,
      },
      {
        id: "post_conversion",
        label: "Step 4 · Cap table post conversione",
        capitalNominal: postCapital,
        ownershipBaseNominal: postCapital,
        cashEur: input.round.raiseAmount + totalConvertibleEur,
        premiumEur: totalPremiumEur + Math.max(0, input.round.raiseAmount - roundCapital),
      },
    ],
    scenarioPreviews,
    participants: outcomes,
    convertibleDetails,
  };
}
