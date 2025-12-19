'use client';

import PageLayout from '../components/PageLayout';
import React, { useMemo, useState } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../firebaseConfig'; // 🔁 adjust path if needed

/* =========================
   Types & Constants
========================= */

type MetalType = 'GOLD_24' | 'GOLD_22' | 'GOLD_18' | 'GOLD_14' | 'SILVER';
type StoneUnit = 'gm' | 'ct' | 'rt';
type StoneRateType = 'per_gm' | 'per_ct' | 'per_rt' | 'per_piece';
type TouchedField = 'gross' | 'gold' | null;

type GoldGrossMode =
  | 'GROSS_EQUALS_GOLD'
  | 'GROSS_MINUS_STONE'
  | 'GROSS_MINUS_DIAM'
  | 'GROSS_MINUS_STONE_DIAM';

type PolishMode = 'gm' | 'pct';

type LabourMode =
  | 'per_gm_gold'
  | 'flat'
  | 'pct_gold'
  | 'pct_gold_plus_diam'
  | 'pct_gold_plus_stone'
  | 'pct_gold_plus_diam_stone';

type LineDiscountMode = 'none' | 'pct' | 'per_gm' | 'flat';

type MiscDiscountMode = 'none' | 'pct_total' | 'flat';

interface StoneLineInput {
  id: string;
  label: string;
  enabled: boolean;

  kind: 'diamond' | 'stone';

  // weight
  weightValue: number | null;
  weightDisplay: string;
  weightUnit: StoneUnit;

  // rate
  rateValue: number | null;
  rateDisplay: string;
  rateType: StoneRateType;

  // pieces
  pieces: number | null;
  piecesDisplay: string;

  // discount
  discountMode: LineDiscountMode;
  discountValue: number | null;
  discountDisplay: string;
}

interface StoneLineResult extends StoneLineInput {
  stoneWeightGm: number;
  stoneValue: number;
  discountAmount: number;
  netStoneValue: number;
}

interface EstimateInput {
  grossWeight: number | null;
  goldWeight: number | null;
  stones: StoneLineInput[];
  touchedField: TouchedField;

  ratePer10Gm: number;
  ctToGm: number;
  rtToGm: number;
  gstRate: number;

  goldGrossMode: GoldGrossMode;

  polishMode: PolishMode;
  polishValue: number | null;

  labourMode: LabourMode;
  labourParam: number | null;

  miscCharges: number | null;

  labourDiscountMode: LineDiscountMode;
  labourDiscountValue: number | null;

  miscDiscountMode: MiscDiscountMode;
  miscDiscountValue: number | null;
}

interface EstimateResult {
  effectiveGoldWeight: number;
  effectiveGrossWeight: number;

  ratePerGm: number;
  metalValue: number;

  polishWeightGm: number;
  polishValue: number;

  stoneLines: StoneLineResult[];
  stonesTotalValue: number;
  stonesDiscountTotal: number;

  goldValueOnly: number;
  diamondValueTotal: number;
  stoneNonDiamValueTotal: number;

  labourBase: number;
  labourDiscountAmount: number;
  labourNet: number;

  miscCharges: number;
  miscDiscountAmount: number;

  subTotalBeforeMiscDiscount: number;
  subTotalBeforeGst: number;

  gstAmount: number;
  grandTotal: number;
}

/* =========================
   Helpers
========================= */

const round = (val: number, decimals: number) => {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
};

const parseNumber = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const metalOptions: { value: MetalType; label: string }[] = [
  { value: 'GOLD_24', label: '24kt Gold' },
  { value: 'GOLD_22', label: '22kt Gold' },
  { value: 'GOLD_18', label: '18kt Gold' },
  { value: 'GOLD_14', label: '14kt Gold' },
  { value: 'SILVER', label: 'Silver' },
];

// 🔁 Diam1 / Stone1 disabled by default
const defaultStones: StoneLineInput[] = [
  {
    id: 'DIAM1',
    label: 'Diam1',
    enabled: false,
    kind: 'diamond',
    weightValue: null,
    weightDisplay: '',
    weightUnit: 'ct',
    rateValue: null,
    rateDisplay: '',
    rateType: 'per_ct',
    pieces: null,
    piecesDisplay: '',
    discountMode: 'none',
    discountValue: null,
    discountDisplay: '',
  },
  {
    id: 'STONE1',
    label: 'Stone1',
    enabled: false,
    kind: 'stone',
    weightValue: null,
    weightDisplay: '',
    weightUnit: 'rt',
    rateValue: null,
    rateDisplay: '',
    rateType: 'per_rt',
    pieces: null,
    piecesDisplay: '',
    discountMode: 'none',
    discountValue: null,
    discountDisplay: '',
  },
];

const DEFAULT_CT_TO_GM = 0.2;
const DEFAULT_RT_TO_GM = 0.12;
const DEFAULT_GST = 3;

/** 🔁 Map each metal type to its Firebase path for rate per 10 gm */
const METAL_RATE_PATHS: Record<MetalType, string> = {
  GOLD_24: '/Global SKU/Rates/Gold 24kt',
  GOLD_22: '/Global SKU/Rates/Gold 22kt',
  GOLD_18: '/Global SKU/Rates/Gold 18kt',
  GOLD_14: '/Global SKU/Rates/Gold 14kt',
  SILVER: '/Global SKU/Rates/Silver',
};

/* =========================
   Core Calculation
========================= */

function calculateEstimate(input: EstimateInput): EstimateResult {
  const {
    grossWeight,
    goldWeight,
    stones,
    touchedField,
    ratePer10Gm,
    ctToGm,
    rtToGm,
    gstRate,
    goldGrossMode,
    polishMode,
    polishValue: polishParam,
    labourMode,
    labourParam,
    miscCharges,
    labourDiscountMode,
    labourDiscountValue,
    miscDiscountMode,
    miscDiscountValue,
  } = input;

  const ratePerGm = ratePer10Gm > 0 ? ratePer10Gm / 10 : 0;

  // 1. Stones: weights, values, line discounts
  const stoneLines: StoneLineResult[] = [];
  let stonesTotalValue = 0;
  let stonesDiscountTotal = 0;

  let totalDiamondWeightGm = 0;
  let totalStoneNonDiamWeightGm = 0;

  let diamondValueTotal = 0;
  let stoneNonDiamValueTotal = 0;

  stones.forEach((s) => {
    if (!s.enabled) {
      stoneLines.push({
        ...s,
        stoneWeightGm: 0,
        stoneValue: 0,
        discountAmount: 0,
        netStoneValue: 0,
      });
      return;
    }

    const w = s.weightValue ?? 0;
    let stoneWeightGm = 0;
    if (s.weightUnit === 'gm') stoneWeightGm = w;
    if (s.weightUnit === 'ct') stoneWeightGm = w * ctToGm;
    if (s.weightUnit === 'rt') stoneWeightGm = w * rtToGm;
    stoneWeightGm = round(stoneWeightGm, 3);

    let stoneValue = 0;
    const rate = s.rateValue ?? 0;

    switch (s.rateType) {
      case 'per_gm':
        stoneValue = stoneWeightGm * rate;
        break;
      case 'per_ct': {
        const weightCt = ctToGm > 0 ? stoneWeightGm / ctToGm : 0;
        stoneValue = weightCt * rate;
        break;
      }
      case 'per_rt': {
        const weightRt = rtToGm > 0 ? stoneWeightGm / rtToGm : 0;
        stoneValue = weightRt * rate;
        break;
      }
      case 'per_piece':
        stoneValue = (s.pieces ?? 0) * rate;
        break;
    }

    stoneValue = round(stoneValue, 2);

    // Line discount
    const discVal = s.discountValue ?? 0;
    let discountAmount = 0;

    switch (s.discountMode) {
      case 'pct':
        discountAmount = (stoneValue * discVal) / 100;
        break;
      case 'per_gm':
        discountAmount = stoneWeightGm * discVal;
        break;
      case 'flat':
        discountAmount = discVal;
        break;
      case 'none':
      default:
        discountAmount = 0;
        break;
    }

    if (discountAmount > stoneValue) discountAmount = stoneValue;
    discountAmount = round(discountAmount, 2);

    const netStoneValue = round(stoneValue - discountAmount, 2);

    stonesTotalValue += netStoneValue;
    stonesDiscountTotal += discountAmount;

    if (s.kind === 'diamond') {
      totalDiamondWeightGm += stoneWeightGm;
      diamondValueTotal += netStoneValue;
    } else {
      totalStoneNonDiamWeightGm += stoneWeightGm;
      stoneNonDiamValueTotal += netStoneValue;
    }

    stoneLines.push({
      ...s,
      stoneWeightGm,
      stoneValue,
      discountAmount,
      netStoneValue,
    });
  });

  stonesTotalValue = round(stonesTotalValue, 2);
  stonesDiscountTotal = round(stonesDiscountTotal, 2);

  // 2. Gold/gross relation
  let effGross = grossWeight ?? 0;
  let effGold = goldWeight ?? 0;

  const stoneW = totalStoneNonDiamWeightGm;
  const diamW = totalDiamondWeightGm;

  const applyGrossToGold = (gross: number): number => {
    switch (goldGrossMode) {
      case 'GROSS_EQUALS_GOLD':
        return gross;
      case 'GROSS_MINUS_STONE':
        return Math.max(gross - stoneW, 0);
      case 'GROSS_MINUS_DIAM':
        return Math.max(gross - diamW, 0);
      case 'GROSS_MINUS_STONE_DIAM':
      default:
        return Math.max(gross - (stoneW + diamW), 0);
    }
  };

  const applyGoldToGross = (gold: number): number => {
    switch (goldGrossMode) {
      case 'GROSS_EQUALS_GOLD':
        return gold;
      case 'GROSS_MINUS_STONE':
        return gold + stoneW;
      case 'GROSS_MINUS_DIAM':
        return gold + diamW;
      case 'GROSS_MINUS_STONE_DIAM':
      default:
        return gold + stoneW + diamW;
    }
  };

  if (touchedField === 'gross') {
    effGold = round(applyGrossToGold(effGross), 3);
  } else if (touchedField === 'gold') {
    effGross = round(applyGoldToGross(effGold), 3);
  } else {
    // fallback
    if (grossWeight != null && goldWeight == null) {
      effGold = round(applyGrossToGold(effGross), 3);
    } else if (goldWeight != null && grossWeight == null) {
      effGross = round(applyGoldToGross(effGold), 3);
    }
  }

  effGold = round(effGold, 3);
  effGross = round(effGross, 3);

  // 3. Polish
  let polishWeightGm = 0;
  if (polishParam != null && polishParam > 0) {
    if (polishMode === 'gm') {
      polishWeightGm = polishParam;
    } else {
      // % of gold weight
      polishWeightGm = (effGold * polishParam) / 100;
    }
  }
  polishWeightGm = round(polishWeightGm, 3);

  const goldValueOnly = round(effGold * ratePerGm, 2);
  const polishValue = round(polishWeightGm * ratePerGm, 2);
  const metalValue = round((effGold + polishWeightGm) * ratePerGm, 2);

  // 4. Labour base
  const labourRate = labourParam ?? 0;

  const baseForPct_gold = goldValueOnly;
  const baseForPct_gold_plus_diam = goldValueOnly + diamondValueTotal;
  const baseForPct_gold_plus_stone = goldValueOnly + stoneNonDiamValueTotal;
  const baseForPct_gold_plus_all =
    goldValueOnly + diamondValueTotal + stoneNonDiamValueTotal;

  let labourBase = 0;

  switch (labourMode) {
    case 'per_gm_gold':
      labourBase = effGold * labourRate;
      break;
    case 'flat':
      labourBase = labourRate;
      break;
    case 'pct_gold':
      labourBase = (baseForPct_gold * labourRate) / 100;
      break;
    case 'pct_gold_plus_diam':
      labourBase = (baseForPct_gold_plus_diam * labourRate) / 100;
      break;
    case 'pct_gold_plus_stone':
      labourBase = (baseForPct_gold_plus_stone * labourRate) / 100;
      break;
    case 'pct_gold_plus_diam_stone':
      labourBase = (baseForPct_gold_plus_all * labourRate) / 100;
      break;
    default:
      labourBase = 0;
  }

  labourBase = round(labourBase, 2);

  // 5. Labour discount
  const labDiscVal = labourDiscountValue ?? 0;
  let labourDiscountAmount = 0;

  switch (labourDiscountMode) {
    case 'pct':
      labourDiscountAmount = (labourBase * labDiscVal) / 100;
      break;
    case 'per_gm':
      labourDiscountAmount = effGold * labDiscVal;
      break;
    case 'flat':
      labourDiscountAmount = labDiscVal;
      break;
    case 'none':
    default:
      labourDiscountAmount = 0;
      break;
  }

  if (labourDiscountAmount > labourBase) labourDiscountAmount = labourBase;
  labourDiscountAmount = round(labourDiscountAmount, 2);

  const labourNet = round(labourBase - labourDiscountAmount, 2);

  // 6. Misc charges & misc discount
  const misc = miscCharges ?? 0;
  const miscRounded = round(misc, 2);

  const subTotalBeforeMiscDiscount = round(
    metalValue + stonesTotalValue + labourNet + miscRounded,
    2,
  );

  const miscDiscVal = miscDiscountValue ?? 0;
  let miscDiscountAmount = 0;

  switch (miscDiscountMode) {
    case 'pct_total':
      miscDiscountAmount = (subTotalBeforeMiscDiscount * miscDiscVal) / 100;
      break;
    case 'flat':
      miscDiscountAmount = miscDiscVal;
      break;
    case 'none':
    default:
      miscDiscountAmount = 0;
  }

  if (miscDiscountAmount > subTotalBeforeMiscDiscount) {
    miscDiscountAmount = subTotalBeforeMiscDiscount;
  }
  miscDiscountAmount = round(miscDiscountAmount, 2);

  const subTotalBeforeGst = round(
    subTotalBeforeMiscDiscount - miscDiscountAmount,
    2,
  );

  const gstAmount = round((subTotalBeforeGst * gstRate) / 100, 2);
  const grandTotal = Math.round(subTotalBeforeGst + gstAmount);

  return {
    effectiveGoldWeight: effGold,
    effectiveGrossWeight: effGross,
    ratePerGm,
    metalValue,
    polishWeightGm,
    polishValue,
    stoneLines,
    stonesTotalValue,
    stonesDiscountTotal,
    goldValueOnly,
    diamondValueTotal,
    stoneNonDiamValueTotal,
    labourBase,
    labourDiscountAmount,
    labourNet,
    miscCharges: miscRounded,
    miscDiscountAmount,
    subTotalBeforeMiscDiscount,
    subTotalBeforeGst,
    gstAmount,
    grandTotal,
  };
}

/* =========================
   Comparison Item Type
========================= */

interface ComparisonItem {
  id: string;
  label: string;
  createdAt: string;
  metalType: MetalType;
  goldGrossMode: GoldGrossMode;
  polishMode: PolishMode;
  labourMode: LabourMode;
  miscDiscountMode: MiscDiscountMode;
  grossWeight: number;
  goldWeight: number;
  ratePer10Gm: number;
  gstRate: number;
  result: EstimateResult;
}

/* =========================
   React Page Component
========================= */

const EstimateComparisonPage: React.FC = () => {
  // 🔗 NEW: manual comparison request (compact UI)
  const [wantManualComparison, setWantManualComparison] = useState<boolean>(false);
  const [designWeblink, setDesignWeblink] = useState<string>('');

  const [metalType, setMetalType] = useState<MetalType>('GOLD_22');
  const [grossWeightStr, setGrossWeightStr] = useState('');
  const [goldWeightStr, setGoldWeightStr] = useState('');
  const [stones, setStones] = useState<StoneLineInput[]>(defaultStones);
  const [touchedField, setTouchedField] = useState<TouchedField>(null);

  // ✅ NEW: master toggles
  const [enableStonesSection, setEnableStonesSection] = useState(false);
  const [enableMiscSection, setEnableMiscSection] = useState(false);

  const [goldGrossMode, setGoldGrossMode] =
    useState<GoldGrossMode>('GROSS_MINUS_STONE_DIAM');

  const [ratePer10GmInput, setRatePer10GmInput] = useState<string>('');
  const ratePer10Gm = parseFloat(ratePer10GmInput) || 0;

  const [gstRate, setGstRate] = useState<number>(DEFAULT_GST);

  const [polishMode, setPolishMode] = useState<PolishMode>('gm');
  const [polishValueStr, setPolishValueStr] = useState<string>('');

  const [labourMode, setLabourMode] = useState<LabourMode>('pct_gold');
  const [labourParamStr, setLabourParamStr] = useState<string>('');

  const [miscChargesStr, setMiscChargesStr] = useState<string>('');

  const [labourDiscountMode, setLabourDiscountMode] =
    useState<LineDiscountMode>('none');
  const [labourDiscountStr, setLabourDiscountStr] = useState<string>('');

  const [miscDiscountMode, setMiscDiscountMode] =
    useState<MiscDiscountMode>('none');
  const [miscDiscountStr, setMiscDiscountStr] = useState<string>('');

  const [remarks, setRemarks] = useState<string>('');

  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Master Cityjeweller.in calculation mode
  const [isCityjCalc, setIsCityjCalc] = useState(false);

  // Add Polish checkbox
  const [enablePolish, setEnablePolish] = useState(false);

  /* -------- Auto-fetch metal rate from Firebase (user can overwrite) -------- */

/* -------- Auto-fetch metal rate from Firebase (user can overwrite) -------- */

React.useEffect(() => {
  // If user has typed something, don't override
  if (ratePer10GmInput && ratePer10GmInput.trim() !== '') return;

  const path = METAL_RATE_PATHS[metalType];
  if (!path) return;

  const fetchRate = async () => {
    try {
      const snap = await get(ref(db, path));
      const val = snap.val();
      if (val != null) {
        const raw = typeof val === 'number' ? val : parseFloat(String(val));
        if (!Number.isNaN(raw)) {
          // ✅ Silver is stored as Rate per 1000 gm in Firebase.
          // Convert to "per 10 gm" for UI + existing calculation logic.
          const normalized = metalType === 'SILVER' ? raw / 100 : raw;

          setRatePer10GmInput(normalized.toString());
        }
      }
    } catch (err) {
      console.error('Failed to fetch metal rate ', err);
    }
  };

  fetchRate();
}, [metalType, ratePer10GmInput]);


  /* -------- Cityjeweller.in Calculation Mode Behaviour -------- */

  React.useEffect(() => {
    if (!isCityjCalc) return;

    // Labour % depending on metal
    const pct = metalType === 'GOLD_24' || metalType === 'GOLD_22' ? 10 : 20;
    setLabourMode('pct_gold');
    setLabourParamStr(String(pct));

    // Disable & clear polish
    setEnablePolish(false);
    setPolishValueStr('');

    // Disable all discounts
    setLabourDiscountMode('none');
    setLabourDiscountStr('');
    setMiscDiscountMode('none');
    setMiscDiscountStr('');
    setStones((prev) =>
      prev.map((s) => ({
        ...s,
        discountMode: 'none',
        discountValue: null,
        discountDisplay: '',
      })),
    );

    // ✅ Misc section off (minimized) + reset
    setEnableMiscSection(false);
    setMiscChargesStr('');

    // Reset rate to Firebase (clear so auto-fetch runs)
    setRatePer10GmInput('');

    // Remarks autofill
    setRemarks('Cityjeweller.in calculation');
  }, [isCityjCalc, metalType]);

  /* -------- Stones section enable/disable behaviour -------- */

  React.useEffect(() => {
    if (!enableStonesSection) {
      // If user disables the section, force all lines off (no calculation)
      setStones((prev) => prev.map((s) => ({ ...s, enabled: false })));
      return;
    }

    // If user enables the section, default enable Diam1 + Stone1
    setStones((prev) =>
      prev.map((s) =>
        s.id === 'DIAM1' || s.id === 'STONE1' ? { ...s, enabled: true } : s,
      ),
    );
  }, [enableStonesSection]);

  /* -------- Misc section enable/disable behaviour -------- */

  React.useEffect(() => {
    if (!enableMiscSection) {
      setMiscChargesStr('');
      setMiscDiscountMode('none');
      setMiscDiscountStr('');
    }
  }, [enableMiscSection]);

  /* -------- Derived texts (dull formula hints) -------- */

  const goldGrossHint = useMemo(() => {
    switch (goldGrossMode) {
      case 'GROSS_EQUALS_GOLD':
        return 'Formula: Gold Wt = Gross Wt (no separate deduction of stones or diamonds).';
      case 'GROSS_MINUS_STONE':
        return 'Formula: Gold Wt = Gross Wt − Total Stone Wt (non-diamond stones).';
      case 'GROSS_MINUS_DIAM':
        return 'Formula: Gold Wt = Gross Wt − Total Diamond Wt.';
      case 'GROSS_MINUS_STONE_DIAM':
      default:
        return 'Formula: Gold Wt = Gross Wt − (Total Stone Wt + Total Diamond Wt).';
    }
  }, [goldGrossMode]);

  const labourFormulaHint = useMemo(() => {
    switch (labourMode) {
      case 'per_gm_gold':
        return 'Formula: Labour = (Gold Wt in gm) × (Rs per gm).';
      case 'flat':
        return 'Formula: Labour = Flat fixed amount.';
      case 'pct_gold':
        return 'Formula: Labour = % of Gold value.';
      case 'pct_gold_plus_diam':
        return 'Formula: Labour = % of (Gold value + Diamond value).';
      case 'pct_gold_plus_stone':
        return 'Formula: Labour = % of (Gold value + Stone value).';
      case 'pct_gold_plus_diam_stone':
        return 'Formula: Labour = % of (Gold + Diamond + Stone value).';
      default:
        return '';
    }
  }, [labourMode]);

  /* -------- Derived estimate -------- */

  const estimateResult: EstimateResult = useMemo(() => {
    const grossWeight = parseNumber(grossWeightStr);
    const goldWeight = parseNumber(goldWeightStr);

    // Cityj mode or Add Polish unchecked => ignore polish value
    const polishValue = isCityjCalc || !enablePolish ? null : parseNumber(polishValueStr);

    // ✅ Stones: ignore all stones unless section enabled
    // ✅ Cityj: force discounts none
    const stonesForCalc: StoneLineInput[] = !enableStonesSection
      ? stones.map((s) => ({ ...s, enabled: false }))
      : isCityjCalc
        ? stones.map((s) => ({
            ...s,
            discountMode: 'none' as LineDiscountMode,
            discountValue: null,
          }))
        : stones;

    const labourParam = parseNumber(labourParamStr);

    // ✅ Misc: ignore unless section enabled
    const miscCharges = enableMiscSection && !isCityjCalc ? parseNumber(miscChargesStr) : null;
    const labourDisc = parseNumber(labourDiscountStr);
    const miscDisc = enableMiscSection && !isCityjCalc ? parseNumber(miscDiscountStr) : null;

    return calculateEstimate({
      grossWeight,
      goldWeight,
      stones: stonesForCalc,
      touchedField,
      ratePer10Gm,
      ctToGm: DEFAULT_CT_TO_GM,
      rtToGm: DEFAULT_RT_TO_GM,
      gstRate,
      goldGrossMode,
      polishMode,
      polishValue,
      labourMode,
      labourParam,
      miscCharges,
      labourDiscountMode,
      labourDiscountValue: labourDisc,
      miscDiscountMode,
      miscDiscountValue: miscDisc,
    });
  }, [
    grossWeightStr,
    goldWeightStr,
    stones,
    touchedField,
    ratePer10Gm,
    gstRate,
    goldGrossMode,
    polishMode,
    polishValueStr,
    labourMode,
    labourParamStr,
    miscChargesStr,
    labourDiscountMode,
    labourDiscountStr,
    miscDiscountMode,
    miscDiscountStr,
    isCityjCalc,
    enablePolish,
    enableStonesSection,
    enableMiscSection,
  ]);

  /* -------- Labour description for Summary -------- */

  const labourDescription = useMemo(() => {
    const param = parseNumber(labourParamStr) ?? 0;
    if (!param || estimateResult.labourBase === 0) return '';

    const goldWt = estimateResult.effectiveGoldWeight.toFixed(3);
    const goldVal = estimateResult.goldValueOnly.toFixed(2);
    const diamVal = estimateResult.diamondValueTotal.toFixed(2);
    const stoneVal = estimateResult.stoneNonDiamValueTotal.toFixed(2);

    switch (labourMode) {
      case 'per_gm_gold':
        return `Rs.${param} × ${goldWt} gm (gold wt)`;
      case 'flat':
        return `Rs.${param} flat`;
      case 'pct_gold':
        return `${param}% of Gold value Rs.${goldVal}`;
      case 'pct_gold_plus_diam':
        return `${param}% of (Gold Rs.${goldVal} + Diamond Rs.${diamVal})`;
      case 'pct_gold_plus_stone':
        return `${param}% of (Gold Rs.${goldVal} + Stone Rs.${stoneVal})`;
      case 'pct_gold_plus_diam_stone':
        return `${param}% of (Gold Rs.${goldVal} + Diamond Rs.${diamVal} + Stone Rs.${stoneVal})`;
      default:
        return '';
    }
  }, [labourMode, labourParamStr, estimateResult]);

  /* -------- Keep Gross ↔ Gold boxes synced visibly -------- */

  React.useEffect(() => {
    if (touchedField === 'gross') {
      const currentGold = parseNumber(goldWeightStr);
      const computed = estimateResult.effectiveGoldWeight;
      if (currentGold == null || round(currentGold, 3) !== round(computed, 3)) {
        setGoldWeightStr(computed ? computed.toFixed(3) : '');
      }
    } else if (touchedField === 'gold') {
      const currentGross = parseNumber(grossWeightStr);
      const computedGross = estimateResult.effectiveGrossWeight;
      if (
        currentGross == null ||
        round(currentGross, 3) !== round(computedGross, 3)
      ) {
        setGrossWeightStr(computedGross ? computedGross.toFixed(3) : '');
      }
    }
  }, [
    estimateResult.effectiveGoldWeight,
    estimateResult.effectiveGrossWeight,
    touchedField,
    goldWeightStr,
    grossWeightStr,
  ]);

  /* -------- Handlers -------- */

const handleCompareForMe = () => {
    const link = designWeblink.trim();

    if (!link) {
      alert('Please paste the design weblink first.');
      return;
    }

    const msg =
      `Compare request (Cityjeweller.in)\n` +
      `Design link: ${link}\n`;

    const waUrl = `https://wa.me/919023130944?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleStoneChange = (
    id: string,
    field:
      | 'enabled'
      | 'weightValue'
      | 'weightUnit'
      | 'rateValue'
      | 'rateType'
      | 'pieces'
      | 'discountMode'
      | 'discountValue',
    value: string | boolean,
  ) => {
    setStones((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        if (field === 'enabled') {
          return { ...s, enabled: Boolean(value) };
        }

        if (field === 'weightValue') {
          const str = String(value);
          return {
            ...s,
            weightDisplay: str,
            weightValue: parseNumber(str),
          };
        }

        if (field === 'rateValue') {
          const str = String(value);
          return {
            ...s,
            rateDisplay: str,
            rateValue: parseNumber(str),
          };
        }

        if (field === 'pieces') {
          const str = String(value);
          return {
            ...s,
            piecesDisplay: str,
            pieces: parseNumber(str),
          };
        }

        if (field === 'discountValue') {
          const str = String(value);
          return {
            ...s,
            discountDisplay: str,
            discountValue: parseNumber(str),
          };
        }

        // enums
        return {
          ...s,
          [field]: value,
        } as StoneLineInput;
      }),
    );
  };

  const handleAddStoneLine = () => {
    setStones((prev) => {
      const diamCount = prev.filter((s) => s.label.startsWith('Diam')).length;
      const stoneCount = prev.filter((s) => s.label.startsWith('Stone')).length;

      const useDiam = diamCount <= stoneCount;
      const base = useDiam ? 'Diam' : 'Stone';
      const num = (useDiam ? diamCount : stoneCount) + 1;

      const id = `${base.toUpperCase()}${num}`;
      const kind: 'diamond' | 'stone' = useDiam ? 'diamond' : 'stone';

      const newLine: StoneLineInput = {
        id,
        label: `${base}${num}`,
        enabled: true,
        kind,
        weightValue: null,
        weightDisplay: '',
        weightUnit: useDiam ? 'ct' : 'rt',
        rateValue: null,
        rateDisplay: '',
        rateType: useDiam ? 'per_ct' : 'per_rt',
        pieces: null,
        piecesDisplay: '',
        discountMode: 'none',
        discountValue: null,
        discountDisplay: '',
      };

      return [...prev, newLine];
    });
  };

  const handleAddToComparison = () => {
    const gross = estimateResult.effectiveGrossWeight;
    const gold = estimateResult.effectiveGoldWeight;

    if (gross <= 0 && gold <= 0) {
      alert('Please enter at least Gross or Gold weight before comparing.');
      return;
    }
    if (ratePer10Gm <= 0) {
      alert('Please enter Gold/Silver rate per 10 gm before comparing.');
      return;
    }

    const label =
      remarks.trim() || `Option ${comparisonItems.length + 1} (${metalLabel(metalType)})`;

    const item: ComparisonItem = {
      id: Date.now().toString(),
      label,
      createdAt: new Date().toLocaleString(),
      metalType,
      goldGrossMode,
      polishMode,
      labourMode,
      miscDiscountMode,
      grossWeight: gross,
      goldWeight: gold,
      ratePer10Gm,
      gstRate,
      result: estimateResult,
    };

    setComparisonItems((prev) => {
      const next = [...prev, item];
      if (prev.length === 0) {
        alert('add another calculation to compare with');
      }
      return next;
    });
    setShowComparison(true);
  };

  /* =========================
     Render
  ========================= */

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Jewellery Estimate – Comparison Mode</h1>
          <p className="text-sm text-gray-600">
            Create multiple calculation patterns (gross to net weight logic, polish, labour, discounts) and compare them side by side.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column – inputs */}
          <section className="space-y-4">
            {/* Metal & weights */}
            <div className="border rounded-md p-4 space-y-3">
              <h2 className="font-semibold text-sm">Metal & Weights</h2>

              {/* Gross & Gold inputs */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Gross Wt (gm)</label>
                  <input
                    type="number"
                    value={grossWeightStr}
                    onChange={(e) => {
                      setGrossWeightStr(e.target.value);
                      setTouchedField('gross');
                    }}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    {metalType === 'SILVER' ? 'Silver Wt (gm)' : 'Gold Wt (gm)'}
                  </label>
                  <input
                    type="number"
                    value={goldWeightStr}
                    onChange={(e) => {
                      setGoldWeightStr(e.target.value);
                      setTouchedField('gold');
                    }}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>

              {/* Relation (after weights) */}
              <div className="mt-2">
                <label className="block text-[11px] text-gray-600 mb-1">
                  Relation between Gross & Gold Weight
                </label>
                <select
                  value={goldGrossMode}
                  onChange={(e) => setGoldGrossMode(e.target.value as GoldGrossMode)}
                  className="w-full border rounded px-2 py-1 text-[11px]"
                >
                  <option value="GROSS_EQUALS_GOLD">
                    Gold Wt = Gross Wt (includes stones & diamonds)
                  </option>
                  <option value="GROSS_MINUS_STONE">
                    Gold Wt = Gross − Stone Wt (includes diamonds)
                  </option>
                  <option value="GROSS_MINUS_DIAM">
                    Gold Wt = Gross − Diamond Wt (includes stones)
                  </option>
                  <option value="GROSS_MINUS_STONE_DIAM">
                    Gold Wt = Gross − (Stone + Diamond) Wt (default)
                  </option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1 italic">{goldGrossHint}</p>
              </div>

              <p className="text-[11px] text-gray-600 mt-1">
                Effective Net Wt (Gold) = {estimateResult.effectiveGoldWeight.toFixed(3)} gm
                &nbsp; | Effective Gross Wt = {estimateResult.effectiveGrossWeight.toFixed(3)} gm
              </p>
            </div>



{/* ✅ Compact: Want us to do the comparison? (placed immediately after Metal & Weights) */}
            <div className="border rounded-md p-4 space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={wantManualComparison}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setWantManualComparison(checked);
                    if (!checked) setDesignWeblink(''); // optional: clear when turned off
                  }}
                />
                Want us to do the comparison?
              </label>

              {wantManualComparison && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-gray-600">
                    Share the weblink of your chosen design. We’ll study it and prepare a comparison chart
                    against Cityjeweller.in rates.
                  </p>

                  <input
                    type="text"
                    value={designWeblink}
                    onChange={(e) => setDesignWeblink(e.target.value)}
                    placeholder="Paste design/product weblink here"
                    className="w-full border rounded px-2 py-1 text-sm"
                  />

                  <button
                    type="button"
                    onClick={handleCompareForMe}
                    className="w-full bg-green-600 text-white text-sm font-medium py-2 rounded"
                  >
                    Compare for me
                  </button>

                  <p className="text-[10px] text-gray-500">
                    Clicking “Compare for me” will open WhatsApp and send this link to: 919023130944
                  </p>
                </div>
              )}
            </div>


{/* Add Stone toggle (ALWAYS fixed position like Add Polish) */}
<div className="flex items-center gap-2">
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      checked={enableStonesSection}
      onChange={(e) => setEnableStonesSection(e.target.checked)}
    />
    Add Stone
  </label>
</div>

{/* Stones / Diamonds section (ONLY shows when enabled) */}
{enableStonesSection && (
  <div className="border rounded-md p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h2 className="font-semibold text-sm">Stones / Diamonds (with Discounts)</h2>
      {/* ❌ REMOVE checkbox from here */}
    </div>

    <div className="flex justify-end">
      <button
        type="button"
        onClick={handleAddStoneLine}
        className="text-xs text-amber-700 border border-amber-500 rounded px-2 py-1"
      >
        + Add Stone
      </button>
    </div>

    <div className="space-y-3">
      {stones.map((s) => (
        <div key={s.id} className="border rounded-md px-2 py-2 space-y-2 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {s.label}{' '}
              <span className="text-[10px] text-gray-500">
                ({s.kind === 'diamond' ? 'Diamond' : 'Stone'})
              </span>
            </span>

            <label className="flex items-center gap-1 text-[11px]">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => handleStoneChange(s.id, 'enabled', e.target.checked)}
              />
              Enabled
            </label>
          </div>

{s.enabled && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px]">Weight</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={s.weightDisplay ?? ''}
                      onChange={(e) => handleStoneChange(s.id, 'weightValue', e.target.value)}
                      className="w-2/3 border rounded px-2 py-1 text-xs"
                    />
                    <select
                      value={s.weightUnit}
                      onChange={(e) => handleStoneChange(s.id, 'weightUnit', e.target.value)}
                      className="w-1/3 border rounded px-1 py-1 text-xs"
                    >
                      <option value="gm">gm</option>
                      <option value="ct">ct</option>
                      <option value="rt">rt</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px]">Rate</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={s.rateDisplay ?? ''}
                      onChange={(e) => handleStoneChange(s.id, 'rateValue', e.target.value)}
                      className="w-2/3 border rounded px-2 py-1 text-xs"
                    />
                    <select
                      value={s.rateType}
                      onChange={(e) => handleStoneChange(s.id, 'rateType', e.target.value)}
                      className="w-1/3 border rounded px-1 py-1 text-xs"
                    >
                      <option value="per_gm">/gm</option>
                      <option value="per_ct">/ct</option>
                      <option value="per_rt">/rt</option>
                      <option value="per_piece">/pc</option>
                    </select>
                  </div>
                </div>

                {s.rateType === 'per_piece' && (
                  <div className="space-y-1">
                    <label className="block text-[11px]">Pieces</label>
                    <input
                      type="number"
                      value={s.piecesDisplay ?? ''}
                      onChange={(e) => handleStoneChange(s.id, 'pieces', e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* line discount */}
              <div className="mt-1">
                <label className="block text-[11px] mb-0.5">Discount on {s.label}</label>
                <div className="flex gap-1 items-center">
                  <select
                    value={s.discountMode}
                    onChange={(e) => handleStoneChange(s.id, 'discountMode', e.target.value)}
                    disabled={isCityjCalc}
                    className="border rounded px-2 py-1 text-[11px] disabled:bg-gray-100"
                  >
                    <option value="none">No discount</option>
                    <option value="pct">% of {s.label} value</option>
                    <option value="per_gm">Rs / gm of {s.label}</option>
                    <option value="flat">Rs flat</option>
                  </select>

                  {s.discountMode !== 'none' && !isCityjCalc && (
                    <input
                      type="number"
                      value={s.discountDisplay ?? ''}
                      onChange={(e) => handleStoneChange(s.id, 'discountValue', e.target.value)}
                      placeholder="Discount"
                      className="flex-1 border rounded px-2 py-1 text-xs"
                    />
                  )}

                  {isCityjCalc && (
                    <span className="text-[10px] text-gray-500">
                      Discounts disabled in Cityjeweller.in calculation
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  </div>
)}


            {/* Add Polish toggle + Polish section (AFTER stones) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={enablePolish}
                    onChange={(e) => setEnablePolish(e.target.checked)}
                    disabled={isCityjCalc}
                  />
                  <span className={isCityjCalc ? 'text-gray-400' : 'text-gray-700'}>
                    Add Polish
                  </span>
                </label>
              </div>
              {isCityjCalc && (
                <p className="text-[11px] text-gray-400 italic">
                  Polish is disabled in Cityjeweller.in calculation mode.
                </p>
              )}

              {enablePolish && !isCityjCalc && (
                <div className="border rounded-md p-4 space-y-3">
                  <h2 className="font-semibold text-sm">Polish (as Gold)</h2>
                  <div className="flex gap-2 items-center">
                    <select
                      value={polishMode}
                      onChange={(e) => setPolishMode(e.target.value as PolishMode)}
                      className="border rounded px-2 py-1 text-xs"
                    >
                      <option value="gm">Polish = __ gm of Gold</option>
                      <option value="pct">Polish = __ % of Gold Wt</option>
                    </select>
                    <input
                      type="number"
                      value={polishValueStr}
                      onChange={(e) => setPolishValueStr(e.target.value)}
                      placeholder={polishMode === 'gm' ? 'gm' : '% of gold wt'}
                      className="flex-1 border rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 italic">
                    {polishMode === 'gm'
                      ? 'Polish weight is added as extra gold in grams.'
                      : 'Polish weight is calculated as a % of effective gold weight and added as extra gold.'}
                  </p>
                  <p className="text-[11px] text-gray-600">
                    Calculated Polish Wt = {estimateResult.polishWeightGm.toFixed(3)} gm
                  </p>
                </div>
              )}
            </div>

            {/* Gold / Silver Rate – separate section (✅ Metal type moved here) */}
            <div className="border rounded-md p-4 space-y-3">
              <h2 className="font-semibold text-sm">Gold / Silver Rate</h2>

              <div className="space-y-2">
                <label className="block text-xs font-medium mb-1">Metal Type</label>
                <div className="flex flex-wrap gap-2">
                  {metalOptions.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => {
                        setMetalType(m.value);
                        // clear rate so that auto-fetch for new metal can run
                        setRatePer10GmInput('');
                      }}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        metalType === m.value ? 'bg-amber-100 border-amber-500' : 'bg-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  {metalType === 'SILVER' ? 'Silver Rate per 10 gm' : 'Gold Rate per 10 gm'}
                </label>
                <input
                  type="number"
                  value={ratePer10GmInput}
                  onChange={(e) => setRatePer10GmInput(e.target.value)}
                  disabled={isCityjCalc}
                  className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                />
                <p className="text-[11px] text-gray-600 mt-1">
                  Rate per gm: Rs.{estimateResult.ratePerGm.toFixed(2)}
                </p>
                {isCityjCalc && (
                  <p className="text-[11px] text-gray-400 italic">
                    Rate is locked in Cityjeweller.in calculation mode. Uncheck the checkbox below to edit.
                  </p>
                )}
              </div>
            </div>

            {/* ✅ Cityjeweller.in toggle moved just BEFORE Labour */}
            <div className="border rounded-md p-3 bg-blue-50 flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={isCityjCalc}
                onChange={(e) => setIsCityjCalc(e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium">Cityjeweller.in calculation</p>
                <p className="text-[11px] text-gray-600">
                  Uses fixed Cityjeweller.in rules: metal rate fixed, standard labour % on gold, no polish,
                  no discounts, and no misc charges. Uncheck this to customise the calculation.
                </p>
              </div>
            </div>

            {/* Labour – separate section */}
            <div className="border rounded-md p-4 space-y-3">
              <h2 className="font-semibold text-sm">Labour</h2>

              <div>
                <label className="block text-xs font-medium mb-1">Labour Calculation</label>
                <div className="space-y-1">
                  <select
                    value={labourMode}
                    onChange={(e) => setLabourMode(e.target.value as LabourMode)}
                    disabled={isCityjCalc}
                    className="w-full border rounded px-2 py-1 text-xs disabled:bg-gray-100"
                  >
                    <option value="per_gm_gold">Rs __ per gm Gold</option>
                    <option value="flat">Rs ___ flat</option>
                    <option value="pct_gold">___% of Gold value (default)</option>
                    <option value="pct_gold_plus_diam">___% of Gold + Diamond value</option>
                    <option value="pct_gold_plus_stone">___% of Gold + Stone value</option>
                    <option value="pct_gold_plus_diam_stone">
                      ___% of Gold + Diam + Stone value
                    </option>
                  </select>

                  <p className="text-[11px] text-gray-400 italic">{labourFormulaHint}</p>

                  <input
                    type="number"
                    value={labourParamStr}
                    onChange={(e) => setLabourParamStr(e.target.value)}
                    placeholder="Enter labour parameter"
                    disabled={isCityjCalc}
                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                  />
                  <p className="text-[11px] text-gray-600">
                    Labour (before discount): Rs.{estimateResult.labourBase.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Labour discount */}
              <div>
                <label className="block text-xs font-medium mb-1">Labour Discount</label>
                <div className="flex gap-1 items-center">
                  <select
                    value={labourDiscountMode}
                    onChange={(e) => setLabourDiscountMode(e.target.value as LineDiscountMode)}
                    disabled={isCityjCalc}
                    className="border rounded px-2 py-1 text-[11px] disabled:bg-gray-100"
                  >
                    <option value="none">No discount</option>
                    <option value="pct">% of Labour</option>
                    <option value="per_gm">Rs per gm of Gold</option>
                    <option value="flat">Rs flat</option>
                  </select>
                  {labourDiscountMode !== 'none' && !isCityjCalc && (
                    <input
                      type="number"
                      value={labourDiscountStr}
                      onChange={(e) => setLabourDiscountStr(e.target.value)}
                      className="flex-1 border rounded px-2 py-1 text-xs"
                    />
                  )}
                  {isCityjCalc && (
                    <span className="text-[10px] text-gray-500">
                      Discounts disabled in Cityjeweller.in calculation
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-600">
                  Labour Discount: Rs.{estimateResult.labourDiscountAmount.toFixed(2)} | Net Labour: Rs.
                  {estimateResult.labourNet.toFixed(2)}
                </p>
              </div>
            </div>

            {/* ✅ Misc – minimized until enabled */}
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Misc Charges & Discounts</h2>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={enableMiscSection}
                    onChange={(e) => setEnableMiscSection(e.target.checked)}
                    disabled={isCityjCalc}
                  />
                  Add Misc
                </label>
              </div>

              {!enableMiscSection ? (
                <p className="text-[11px] text-gray-500 italic">
                  Enable “Add Misc” to add extra charges/discounts.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Misc Charges (flat Rs.)
                      </label>
                      <input
                        type="number"
                        value={miscChargesStr}
                        onChange={(e) => setMiscChargesStr(e.target.value)}
                        disabled={isCityjCalc}
                        className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Misc Discount on Total</label>
                      <div className="flex gap-1 items-center">
                        <select
                          value={miscDiscountMode}
                          onChange={(e) => setMiscDiscountMode(e.target.value as MiscDiscountMode)}
                          disabled={isCityjCalc}
                          className="border rounded px-2 py-1 text-[11px] disabled:bg-gray-100"
                        >
                          <option value="none">No discount</option>
                          <option value="pct_total">% of Total (before GST)</option>
                          <option value="flat">Rs flat</option>
                        </select>
                        {miscDiscountMode !== 'none' && !isCityjCalc && (
                          <input
                            type="number"
                            value={miscDiscountStr}
                            onChange={(e) => setMiscDiscountStr(e.target.value)}
                            className="flex-1 border rounded px-2 py-1 text-xs"
                          />
                        )}
                        {isCityjCalc && (
                          <span className="text-[10px] text-gray-500">
                            Discounts disabled in Cityjeweller.in calculation
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* GST (always visible) */}
              <div className="mt-2">
                <label className="block text-xs font-medium mb-1">GST %</label>
                <input
                  type="number"
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value || 0))}
                  className="w-24 border rounded px-2 py-1 text-xs"
                />
              </div>
            </div>
          </section>

          {/* Right column – summary & compare */}
          <section className="space-y-4">
            {/* Summary card */}
            <div className="rounded-md border bg-yellow-50 overflow-hidden">
              <div className="bg-yellow-200 px-4 py-2 flex items-center justify-between">
                <h2 className="font-semibold text-sm">Summary</h2>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                <p className="text-[11px] text-gray-700">{new Date().toLocaleString()}</p>
                <p className="text-[11px] text-red-600">
                  {metalType === 'SILVER'
                    ? `Silver Rate per 10gm = Rs.${ratePer10Gm.toFixed(0)}`
                    : `Gold Rate per 10gm = Rs.${ratePer10Gm.toFixed(0)} (${metalLabel(metalType)})`}
                </p>

                {/* Gold & Polish */}
                <Row
                  label="Gold:"
                  desc={`${estimateResult.effectiveGoldWeight.toFixed(3)} gm × Rs.${estimateResult.ratePerGm.toFixed(2)}`}
                  amount={estimateResult.goldValueOnly}
                />
                {estimateResult.polishWeightGm > 0 && (
                  <Row
                    label="Polish (extra gold):"
                    desc={`${estimateResult.polishWeightGm.toFixed(3)} gm × Rs.${estimateResult.ratePerGm.toFixed(2)}`}
                    amount={estimateResult.polishValue}
                  />
                )}

                {/* Stones (net after discount) */}
                {estimateResult.stoneLines
                  .filter((s) => s.enabled && s.netStoneValue !== 0)
                  .map((s) => (
                    <Row
                      key={s.id}
                      label={`${s.label}:`}
                      desc={formatStoneDesc(s)}
                      amount={s.netStoneValue}
                    />
                  ))}
                {estimateResult.stonesDiscountTotal > 0 && (
                  <Row
                    label="Diamond & Stone Discounts:"
                    desc=""
                    amount={-estimateResult.stonesDiscountTotal}
                    color="text-emerald-700"
                  />
                )}

                {/* Labour */}
                <Row label="Labour:" desc={labourDescription} amount={estimateResult.labourNet} />
                {estimateResult.labourDiscountAmount > 0 && (
                  <Row
                    label="Labour Discount:"
                    desc=""
                    amount={-estimateResult.labourDiscountAmount}
                    color="text-emerald-700"
                  />
                )}

                {/* Misc */}
                {estimateResult.miscCharges !== 0 && (
                  <Row label="Misc Charges:" desc="" amount={estimateResult.miscCharges} />
                )}
                {estimateResult.miscDiscountAmount !== 0 && (
                  <Row
                    label="Misc Discount:"
                    desc=""
                    amount={-estimateResult.miscDiscountAmount}
                    color="text-emerald-700"
                  />
                )}

                {/* Total before GST */}
                <Row
                  label="Total (before GST):"
                  desc=""
                  amount={estimateResult.subTotalBeforeGst}
                  bold
                />

                {/* GST */}
                <Row
                  label={`GST (${gstRate}%)`}
                  desc=""
                  amount={estimateResult.gstAmount}
                  color="text-purple-700"
                />
              </div>
              <div className="bg-sky-500 text-white font-semibold text-lg px-4 py-2 flex justify-between">
                <span>Grand Total:</span>
                <span>Rs.{estimateResult.grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Compare panel */}
            <div className="border rounded-md p-4 space-y-3">
              <h2 className="font-semibold text-sm">Add to Comparison</h2>
              <div>
                <label className="block text-xs mb-1">Remarks / Reference (shop name, pattern etc.)</label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={isCityjCalc}
                />
              </div>
              <button
                type="button"
                onClick={handleAddToComparison}
                className="mt-2 w-full bg-emerald-600 text-white text-sm font-medium py-2 rounded"
              >
                Save Calculation for comparison
              </button>
              {comparisonItems.length > 0 && (
                <p className="text-[11px] text-gray-700 mt-1">
                  Saved options:{' '}
                  {comparisonItems.map((c, idx) => (
                    <span
                      key={c.id}
                      className="inline-block text-[11px] px-2 py-0.5 bg-gray-100 rounded-full mr-1"
                    >
                      {idx + 1}. {c.label}
                    </span>
                  ))}
                </p>
              )}
              {comparisonItems.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setShowComparison((prev) => !prev)}
                  className="mt-2 w-full bg-blue-600 text-white text-sm font-medium py-2 rounded"
                >
                  {showComparison ? 'Hide Comparison Table' : 'Show Comparison'}
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Comparison table */}
        {showComparison && comparisonItems.length >= 2 && <ComparisonTable items={comparisonItems} />}
      </div>
    </PageLayout>
  );
};

/* =========================
   Presentation bits
========================= */

const Row: React.FC<{
  label: string;
  desc: string;
  amount: number;
  bold?: boolean;
  color?: string;
}> = ({ label, desc, amount, bold, color }) => {
  return (
    <div className={`flex justify-between text-sm ${color ?? ''}`}>
      <div className="flex flex-col">
        <span className={bold ? 'font-semibold' : ''}>{label}</span>
        {desc && <span className="text-[11px] text-gray-600">{desc}</span>}
      </div>
      <div className={bold ? 'font-semibold' : ''}>Rs.{amount.toFixed(2)}</div>
    </div>
  );
};

const DiffCell: React.FC<{
  value: string | number;
  different: boolean;
}> = ({ value, different }) => (
  <td className={`border px-2 py-1 text-xs ${different ? 'font-semibold text-emerald-700' : ''}`}>
    {typeof value === 'number' ? value.toLocaleString() : value}
  </td>
);

const ComparisonTable: React.FC<{
  items: ComparisonItem[];
}> = ({ items }) => {
  const base = items[0];

  const isDiff = (field: keyof EstimateResult, item: ComparisonItem) => {
    const a = base.result[field];
    const b = item.result[field];
    if (typeof a === 'number' && typeof b === 'number') {
      return round(a, 2) !== round(b, 2);
    }
    return a !== b;
  };

  return (
    <div className="border rounded-md p-4 mt-4 overflow-x-auto bg-white">
      <h2 className="font-semibold text-sm mb-2">Comparison Summary (differences are in bold green)</h2>
      <table className="min-w-full border text-xs">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1">#</th>
            <th className="border px-2 py-1">Label</th>
            <th className="border px-2 py-1">Metal</th>
            <th className="border px-2 py-1">Gold Rate/10gm</th>
            <th className="border px-2 py-1">Gross Wt</th>
            <th className="border px-2 py-1">Gold Wt</th>
            <th className="border px-2 py-1">Polish (gm)</th>
            <th className="border px-2 py-1">Polish Amt</th>
            <th className="border px-2 py-1">Gold Value</th>
            <th className="border px-2 py-1">Stones (net)</th>
            <th className="border px-2 py-1">Diam+Stone Disc</th>
            <th className="border px-2 py-1">Labour (net)</th>
            <th className="border px-2 py-1">Labour Disc</th>
            <th className="border px-2 py-1">Misc</th>
            <th className="border px-2 py-1">Misc Disc</th>
            <th className="border px-2 py-1">Total Before GST</th>
            <th className="border px-2 py-1">GST</th>
            <th className="border px-2 py-1">Grand Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id}>
              <td className="border px-2 py-1">{idx + 1}</td>
              <td className="border px-2 py-1">{it.label}</td>
              <td className="border px-2 py-1">{metalLabel(it.metalType)}</td>
              <DiffCell
                value={it.ratePer10Gm.toFixed(0)}
                different={round(it.ratePer10Gm, 2) !== round(base.ratePer10Gm, 2)}
              />
              <DiffCell
                value={it.grossWeight.toFixed(3)}
                different={round(it.grossWeight, 3) !== round(base.grossWeight, 3)}
              />
              <DiffCell
                value={it.goldWeight.toFixed(3)}
                different={round(it.goldWeight, 3) !== round(base.goldWeight, 3)}
              />
              <DiffCell value={it.result.polishWeightGm.toFixed(3)} different={isDiff('polishWeightGm', it)} />
              <DiffCell value={it.result.polishValue.toFixed(2)} different={isDiff('polishValue', it)} />
              <DiffCell value={it.result.goldValueOnly.toFixed(2)} different={isDiff('goldValueOnly', it)} />
              <DiffCell value={it.result.stonesTotalValue.toFixed(2)} different={isDiff('stonesTotalValue', it)} />
              <DiffCell
                value={it.result.stonesDiscountTotal.toFixed(2)}
                different={isDiff('stonesDiscountTotal', it)}
              />
              <DiffCell value={it.result.labourNet.toFixed(2)} different={isDiff('labourNet', it)} />
              <DiffCell
                value={it.result.labourDiscountAmount.toFixed(2)}
                different={isDiff('labourDiscountAmount', it)}
              />
              <DiffCell value={it.result.miscCharges.toFixed(2)} different={isDiff('miscCharges', it)} />
              <DiffCell
                value={it.result.miscDiscountAmount.toFixed(2)}
                different={isDiff('miscDiscountAmount', it)}
              />
              <DiffCell
                value={it.result.subTotalBeforeGst.toFixed(2)}
                different={isDiff('subTotalBeforeGst', it)}
              />
              <DiffCell value={it.result.gstAmount.toFixed(2)} different={isDiff('gstAmount', it)} />
              <DiffCell value={it.result.grandTotal} different={isDiff('grandTotal', it)} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* =========================
   Misc helpers
========================= */

const metalLabel = (metal: MetalType): string => {
  switch (metal) {
    case 'GOLD_24':
      return '24kt';
    case 'GOLD_22':
      return '22kt';
    case 'GOLD_18':
      return '18kt';
    case 'GOLD_14':
      return '14kt';
    case 'SILVER':
      return 'Silver';
    default:
      return '';
  }
};

const formatStoneDesc = (s: StoneLineResult): string => {
  let weightText: string;
  if (s.weightDisplay && s.weightDisplay.trim() !== '') {
    weightText = s.weightDisplay.trim();
  } else if (s.weightValue != null) {
    weightText = s.weightValue.toFixed(3);
  } else {
    weightText = '0';
  }

  let unitText = '';
  if (s.weightUnit === 'gm') unitText = 'gm';
  if (s.weightUnit === 'ct') unitText = 'ct';
  if (s.weightUnit === 'rt') unitText = 'rt';

  let rateText: string;
  if (s.rateDisplay && s.rateDisplay.trim() !== '') {
    rateText = s.rateDisplay.trim();
  } else if (s.rateValue != null) {
    rateText = s.rateValue.toString();
  } else {
    rateText = '0';
  }

  let rateUnit = '';
  switch (s.rateType) {
    case 'per_gm':
      rateUnit = '/gm';
      break;
    case 'per_ct':
      rateUnit = '/ct';
      break;
    case 'per_rt':
      rateUnit = '/rt';
      break;
    case 'per_piece':
      rateUnit = '/pc';
      break;
  }

  if (s.rateType === 'per_piece') {
    let pcsText: string;
    if (s.piecesDisplay && s.piecesDisplay.trim() !== '') {
      pcsText = s.piecesDisplay.trim();
    } else if (s.pieces != null) {
      pcsText = s.pieces.toString();
    } else {
      pcsText = '0';
    }

    return `${pcsText} pcs * ${rateText}${rateUnit} = Rs. ${s.netStoneValue.toFixed(2)}`;
  }

  return `${weightText}${unitText} * ${rateText}${rateUnit} = Rs. ${s.netStoneValue.toFixed(2)}`;
};

export default EstimateComparisonPage;
