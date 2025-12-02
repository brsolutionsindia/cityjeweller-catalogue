'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ref, get, set, push } from 'firebase/database';
import { db } from '../../firebaseConfig'; // ⬅️ adjust path if needed

/* =========================
   Types & Constants
========================= */

type MetalType = 'GOLD_24' | 'GOLD_22' | 'GOLD_18' | 'GOLD_14' | 'SILVER';
type StoneUnit = 'gm' | 'ct' | 'rt';
type StoneRateType = 'per_gm' | 'per_ct' | 'per_rt' | 'per_piece';
type TouchedField = 'gross' | 'gold' | null;

type RateConfig = Record<string, number | string | undefined>;

interface StoneLineInput {
  id: string;
  label: string;
  enabled: boolean;

  // weight
  weightValue: number | null;   // used for calculations
  weightDisplay: string;        // what user types
  weightUnit: StoneUnit;

  // rate
  rateValue: number | null;     // used for calculations
  rateDisplay: string;          // what user types
  rateType: StoneRateType;

  // pieces
  pieces: number | null;        // used for calculations
  piecesDisplay: string;        // what user types
}


interface EstimateInput {
  metalType: MetalType;
  grossWeight: number | null;
  goldWeight: number | null;
  stones: StoneLineInput[];
  touchedField: TouchedField;
  ratePer10Gm: number; // per 10 gm for selected metal
  ctToGm: number;
  rtToGm: number;
  gstRate: number;
  labourOverride: number | null;
}

interface StoneLineResult extends StoneLineInput {
  stoneWeightGm: number;
  stoneValue: number;
}

interface EstimateResult {
  effectiveGoldWeight: number;
  effectiveGrossWeight: number;
  metalValue: number;
  stoneLines: StoneLineResult[];
  stonesTotalValue: number;
  baseLabourAmount: number; // system-calculated
  labourAmount: number; // final (after override if any)
  subTotalBeforeDiscount: number;
  amountAfterDiscount: number;
  gstAmount: number;
  grandTotal: number;
  halfGst: number;
  ratePerGm: number;
  totalStoneWeightGm: number;
}

interface HsnEntry {
  id: string;
  code: string;
  title: string;
  gstRate: number;
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

/* =========================
   Pure Calculation Utility
========================= */

function calculateEstimate(input: EstimateInput): EstimateResult {
  const {
    metalType,
    grossWeight,
    goldWeight,
    stones,
    touchedField,
    ratePer10Gm,
    ctToGm,
    rtToGm,
    gstRate,
    labourOverride,
  } = input;

  const ratePerGm = ratePer10Gm > 0 ? ratePer10Gm / 10 : 0;

  // 1. Stone weights & values
  const stoneLines: StoneLineResult[] = [];
  let totalStoneWeightGm = 0;
  let stonesTotalValue = 0;

  stones.forEach((s) => {
    if (!s.enabled) {
      stoneLines.push({
        ...s,
        stoneWeightGm: 0,
        stoneValue: 0,
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
    totalStoneWeightGm += stoneWeightGm;
    stonesTotalValue += stoneValue;

    stoneLines.push({
      ...s,
      stoneWeightGm,
      stoneValue,
    });
  });

  totalStoneWeightGm = round(totalStoneWeightGm, 3);
  stonesTotalValue = round(stonesTotalValue, 2);

  // 2. Gold/gross weights
  let effGross = grossWeight ?? 0;
  let effGold = goldWeight ?? 0;

  if (touchedField === 'gross') {
    effGold = Math.max(round(effGross - totalStoneWeightGm, 3), 0);
  } else if (touchedField === 'gold') {
    effGross = round(effGold + totalStoneWeightGm, 3);
  } else {
    // Fallback if neither explicitly touched
    if (grossWeight != null && goldWeight == null) {
      effGross = grossWeight;
      effGold = Math.max(round(effGross - totalStoneWeightGm, 3), 0);
    } else if (goldWeight != null && grossWeight == null) {
      effGold = goldWeight;
      effGross = round(effGold + totalStoneWeightGm, 3);
    }
  }

  // 3. Metal value
  const metalWeightGm = effGold; // or silver weight
  const metalValue = round(metalWeightGm * ratePerGm, 2);

  // 4. Labour (base + override)
  let labourBase = 0;
  if (metalType === 'GOLD_24' || metalType === 'GOLD_22') {
    labourBase = 0.1 * metalValue;
  } else if (metalType === 'GOLD_18' || metalType === 'GOLD_14') {
    labourBase = 0.2 * metalValue;
  } else if (metalType === 'SILVER') {
    labourBase = 0.2 * metalValue;
  }

  let baseLabourAmount = 0;
  if (metalType === 'SILVER') {
    baseLabourAmount = Math.max(Math.ceil(labourBase), 400); // nearest rupee, min 400
  } else {
    baseLabourAmount = Math.ceil(labourBase / 100) * 100; // round up to next 100
  }
  baseLabourAmount = round(baseLabourAmount, 2);

  const labourAmount =
    labourOverride != null ? round(labourOverride, 2) : baseLabourAmount;

  // 5. Totals (no Misc, no Discount)
  const subTotalBeforeDiscount = round(
    metalValue + labourAmount + stonesTotalValue,
    2,
  );
  const amountAfterDiscount = subTotalBeforeDiscount; // no discount in this spec

  const gstAmount = round((amountAfterDiscount * gstRate) / 100, 2);
  const grandTotal = Math.round(amountAfterDiscount + gstAmount);
  const halfGst = round(gstAmount / 2, 2);

  return {
    effectiveGoldWeight: round(effGold, 3),
    effectiveGrossWeight: round(effGross, 3),
    metalValue,
    stoneLines,
    stonesTotalValue,
    baseLabourAmount,
    labourAmount,
    subTotalBeforeDiscount,
    amountAfterDiscount,
    gstAmount,
    grandTotal,
    halfGst,
    ratePerGm,
    totalStoneWeightGm,
  };
}

/* =========================
   React Page Component
========================= */

const metalOptions: { value: MetalType; label: string }[] = [
  { value: 'GOLD_24', label: '24kt Gold' },
  { value: 'GOLD_22', label: '22kt Gold' },
  { value: 'GOLD_18', label: '18kt Gold' },
  { value: 'GOLD_14', label: '14kt Gold' },
  { value: 'SILVER', label: 'Silver' },
];

const defaultStones: StoneLineInput[] = [
  {
    id: 'DIAM1',
    label: 'Diam1',
    enabled: true,
    weightValue: null,
    weightDisplay: '',
    weightUnit: 'ct',
    rateValue: null,
    rateDisplay: '',
    rateType: 'per_ct',
    pieces: null,
    piecesDisplay: '',
  },
  {
    id: 'STONE1',
    label: 'Stone1',
    enabled: true,
    weightValue: null,
    weightDisplay: '',
    weightUnit: 'rt',
    rateValue: null,
    rateDisplay: '',
    rateType: 'per_rt',
    pieces: null,
    piecesDisplay: '',
  },
];


const DEFAULT_CT_TO_GM = 0.2;
const DEFAULT_RT_TO_GM = 0.12;
const DEFAULT_GST = 3;

const EstimatePage: React.FC = () => {
  const [metalType, setMetalType] = useState<MetalType>('GOLD_22');
  const [grossWeightStr, setGrossWeightStr] = useState('');
  const [goldWeightStr, setGoldWeightStr] = useState('');
  const [stones, setStones] = useState<StoneLineInput[]>(defaultStones);
  const [touchedField, setTouchedField] = useState<TouchedField>(null);

  const [rateConfig, setRateConfig] = useState<RateConfig | null>(null);
  const [ratePer10GmInput, setRatePer10GmInput] = useState<string>('');
  const [overridden, setOverridden] = useState({
    goldRate: false,
    labour: false,
    gst: false,
    goldWeight: false,
    grossWeight: false,
  });

  const [labourStr, setLabourStr] = useState<string>(''); // editable labour

  const [hsnList, setHsnList] = useState<HsnEntry[]>([]);
  const [selectedHsnId, setSelectedHsnId] = useState<string>('');
  const [gstRate, setGstRate] = useState<number>(DEFAULT_GST);

  // enquiry fields
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerRemarks, setCustomerRemarks] = useState('');
  const [preferredContact, setPreferredContact] = useState('WhatsApp');

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  /* -------- Fetch rates & HSN from Firebase ---------- */

  useEffect(() => {
    const fetchConfig = async () => {
      setLoadingConfig(true);
      setConfigError(null);
      try {
        const ratesSnap = await get(ref(db, '/Global SKU/Rates'));
const ratesVal = (ratesSnap.val() || {}) as RateConfig;
setRateConfig(ratesVal);


        // HSN list
        const hsnSnap = await get(ref(db, '/Global SKU/Rates/HSNList'));
        const hsnVal = hsnSnap.val() || {};
        const list: HsnEntry[] = Object.keys(hsnVal).map((id) => ({
          id,
          code: hsnVal[id].code,
          title: hsnVal[id].title,
          gstRate: Number(hsnVal[id].gstRate ?? 3),
        }));
        setHsnList(list);
        if (list.length > 0) {
          setSelectedHsnId(list[0].id);
          setGstRate(list[0].gstRate);
        }

        // initialise ratePer10Gm for default metal
        const initialRate = resolveRatePer10Gm('GOLD_22', ratesVal);
        setRatePer10GmInput(initialRate > 0 ? String(initialRate) : '');
      } catch (err: unknown) {
        console.error('Error loading config', err);
        setConfigError(
          'Live rates not available. You can still enter your own rate manually.',
        );
      } finally {
        setLoadingConfig(false);
      }
    };

    fetchConfig();
  }, []);

  // When metalType changes, update ratePer10GmInput from config if not overridden
  useEffect(() => {
    if (!rateConfig) return;
    if (overridden.goldRate) return; // user manually edited

    const r = resolveRatePer10Gm(metalType, rateConfig);
    if (r > 0) {
      setRatePer10GmInput(String(r));
    }
  }, [metalType, rateConfig, overridden.goldRate]);

  const ratePer10Gm = parseFloat(ratePer10GmInput) || 0;

  /* -------- Derived estimate -------- */

  const estimateResult: EstimateResult = useMemo(() => {
    const grossWeight = parseNumber(grossWeightStr);
    const goldWeight = parseNumber(goldWeightStr);

    let labourOverride: number | null = parseNumber(labourStr);
    if (overridden.labour && labourOverride == null) {
      labourOverride = 0; // if user cleared, treat as 0
    }

    return calculateEstimate({
      metalType,
      grossWeight,
      goldWeight,
      stones,
      touchedField,
      ratePer10Gm,
      ctToGm: DEFAULT_CT_TO_GM,
      rtToGm: DEFAULT_RT_TO_GM,
      gstRate,
      labourOverride,
    });
  }, [
    metalType,
    grossWeightStr,
    goldWeightStr,
    stones,
    touchedField,
    ratePer10Gm,
    gstRate,
    labourStr,
    overridden.labour,
  ]);

  /* -------- Sync Gross ↔ Gold input boxes -------- */

  useEffect(() => {
    if (touchedField === 'gross') {
      const currentGold = parseNumber(goldWeightStr);
      const computed = estimateResult.effectiveGoldWeight;
      if (
        computed >= 0 &&
        (currentGold == null ||
          round(currentGold, 3) !== round(computed, 3))
      ) {
        setGoldWeightStr(computed ? computed.toFixed(3) : '');
      }
    } else if (touchedField === 'gold') {
      const currentGross = parseNumber(grossWeightStr);
      const computedGross = estimateResult.effectiveGrossWeight;
      if (
        computedGross >= 0 &&
        (currentGross == null ||
          round(currentGross, 3) !== round(computedGross, 3))
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

  /* -------- Auto-fill labour from system calc when not overridden -------- */

  useEffect(() => {
    if (!overridden.labour) {
      const base = estimateResult.baseLabourAmount || 0;
      if (base > 0) {
        const current = parseNumber(labourStr);
        if (current == null || round(current, 2) !== round(base, 2)) {
          setLabourStr(base.toFixed(2));
        }
      }
    }
  }, [estimateResult.baseLabourAmount, overridden.labour, labourStr]);

const handleStoneChange = (
  id: string,
  field: 'enabled' | 'weightValue' | 'weightUnit' | 'rateValue' | 'rateType' | 'pieces',
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

      // weightUnit or rateType
      return {
        ...s,
        [field]: value,
      } as StoneLineInput;
    }),
  );
};


const handleAddStoneLine = () => {
  setStones((prev) => {
    // Count existing DiamX / StoneX lines
    const diamCount = prev.filter((s) => s.label.startsWith('Diam')).length;
    const stoneCount = prev.filter((s) => s.label.startsWith('Stone')).length;

    // Decide what to add next:
    // - If Diam and Stone are equal, or Diam are fewer, add Diam(N+1)
    // - Otherwise add Stone(N+1)
    const useDiam = diamCount <= stoneCount;

    const base = useDiam ? 'Diam' : 'Stone';
    const num = (useDiam ? diamCount : stoneCount) + 1;

    const id = `${base.toUpperCase()}${num}`;
    const isDiam = useDiam;

    const newLine: StoneLineInput = {
      id,
      label: `${base}${num}`,
      enabled: true,

      // weight
      weightValue: null,
      weightDisplay: '',
      weightUnit: isDiam ? 'ct' : 'rt',   // follow your default (Diam=ct, Stone=rt)

      // rate
      rateValue: null,
      rateDisplay: '',
      rateType: isDiam ? 'per_ct' : 'per_rt',

      // pieces
      pieces: null,
      piecesDisplay: '',
    };

    return [...prev, newLine];
  });
};


const handleSubmitEnquiry = async () => {
  setSubmitStatus(null);
  if (!customerName || !customerMobile) {
    setSubmitStatus('Please enter customer name and mobile number.');
    return;
  }
  try {
    // Use a Firebase-generated unique ID under /EstimateEnquiries
    const enquiriesRootRef = ref(db, '/EstimateEnquiries');
    const enquiryRef = push(enquiriesRootRef);

    const payload = {
      createdAt: new Date().toISOString(),
      metalType,
      grossWeight: estimateResult.effectiveGrossWeight,
      goldWeight: estimateResult.effectiveGoldWeight,
      ratePer10Gm,
      ratePerGm: estimateResult.ratePerGm,
      metalValue: estimateResult.metalValue,
      stoneLines: estimateResult.stoneLines.map((s) => ({
        label: s.label,
        weightValue: s.weightValue,
        weightUnit: s.weightUnit,
        rateType: s.rateType,
        rateValue: s.rateValue,
        pieces: s.pieces,
        stoneValue: s.stoneValue,
      })),
      stonesTotalValue: estimateResult.stonesTotalValue,
      labourAmount: estimateResult.labourAmount,
      discountType: 'amount',
      discountValue: 0,
      discountAmount: 0,
      subTotalBeforeDiscount: estimateResult.subTotalBeforeDiscount,
      amountAfterDiscount: estimateResult.amountAfterDiscount,
      hsnCode: hsnList.find((h) => h.id === selectedHsnId)?.code ?? '',
      gstRate,
      gstAmount: estimateResult.gstAmount,
      grandTotal: estimateResult.grandTotal,
      overridden,
      articleType: 'Article',
      customerName,
      customerMobile,
      customerCity,
      preferredContact,
      remarks: customerRemarks,
      source: 'web_estimate_page',
    };

    await set(enquiryRef, payload);

    setSubmitStatus('Enquiry saved successfully.');
  } catch (err: unknown) {
    console.error('Error saving enquiry:', err);
    setSubmitStatus(
      'Could not save enquiry. Please try again or WhatsApp us directly.',
    );
  }
};

  /* =========================
     Render
  ========================= */

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Jewellery Estimate Calculator
        </h1>
        <p className="text-sm text-gray-600">
          Get an approximate value of your jewellery article (CityJeweller
          calculation). All values are estimates; final price may vary.
        </p>
        {loadingConfig && (
          <p className="text-xs text-gray-500">
            Loading live rates from server…
          </p>
        )}
        {configError && (
          <p className="text-xs text-orange-600">{configError}</p>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left column – inputs */}
        <section className="space-y-4">
          {/* Metal & weights */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Metal & Weights</h2>

            <div className="space-y-2">
              <label className="block text-xs font-medium mb-1">
                Metal Type
              </label>
              <div className="flex flex-wrap gap-2">
                {metalOptions.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMetalType(m.value)}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      metalType === m.value
                        ? 'bg-amber-100 border-amber-500'
                        : 'bg-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Gross Wt (gm)
                </label>
                <input
                  type="number"
                  value={grossWeightStr}
                  onChange={(e) => {
                    setGrossWeightStr(e.target.value);
                    setTouchedField('gross');
                    setOverridden((o) => ({ ...o, grossWeight: true }));
                  }}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  {metalType === 'SILVER'
                    ? 'Silver Wt (gm)'
                    : 'Gold Wt (gm)'}
                </label>
                <input
                  type="number"
                  value={goldWeightStr}
                  onChange={(e) => {
                    setGoldWeightStr(e.target.value);
                    setTouchedField('gold');
                    setOverridden((o) => ({ ...o, goldWeight: true }));
                  }}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>
            </div>

            <p className="text-[11px] text-gray-600 mt-1">
              Net Wt = (Gold) = {grossWeightStr || '0.000'} gm −{' '}
              {estimateResult.totalStoneWeightGm.toFixed(3)} gm (stones) ={' '}
              {estimateResult.effectiveGoldWeight.toFixed(3)} gm
            </p>
          </div>

          {/* Stone lines */}
          <div className="border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Stones / Diamonds</h2>
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
                <div
                  key={s.id}
                  className="border rounded-md px-2 py-2 space-y-2 bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{s.label}</span>
                    <label className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) =>
                          handleStoneChange(s.id, 'enabled', e.target.checked)
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  {s.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[11px]">Weight</label>
                        <div className="flex gap-1">
<input
  type="number"
  value={
    s.weightDisplay !== undefined
      ? s.weightDisplay
      : s.weightValue != null
      ? String(s.weightValue)
      : ''
  }
  onChange={(e) =>
    handleStoneChange(
      s.id,
      'weightValue',
      e.target.value,
    )
  }
  className="w-2/3 border rounded px-2 py-1 text-xs"
/>
                          <select
                            value={s.weightUnit}
                            onChange={(e) =>
                              handleStoneChange(
                                s.id,
                                'weightUnit',
                                e.target.value,
                              )
                            }
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
  value={
    s.rateDisplay !== undefined
      ? s.rateDisplay
      : s.rateValue != null
      ? String(s.rateValue)
      : ''
  }
  onChange={(e) =>
    handleStoneChange(
      s.id,
      'rateValue',
      e.target.value,
    )
  }
  className="w-2/3 border rounded px-2 py-1 text-xs"
/>

                          <select
                            value={s.rateType}
                            onChange={(e) =>
                              handleStoneChange(
                                s.id,
                                'rateType',
                                e.target.value,
                              )
                            }
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
  value={
    s.piecesDisplay !== undefined
      ? s.piecesDisplay
      : s.pieces != null
      ? String(s.pieces)
      : ''
  }
  onChange={(e) =>
    handleStoneChange(
      s.id,
      'pieces',
      e.target.value,
    )
  }
  className="w-full border rounded px-2 py-1 text-xs"
/>

                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rate & labour / HSN & GST */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Rates & Labour</h2>

            <div>
              <label className="block text-xs font-medium mb-1">
                {metalType === 'SILVER'
                  ? 'Silver Rate per 10 gm'
                  : 'Gold Rate per 10 gm'}
              </label>
              <input
                type="number"
                value={ratePer10GmInput}
                onChange={(e) => {
                  setRatePer10GmInput(e.target.value);
                  setOverridden((o) => ({ ...o, goldRate: true }));
                }}
                className={`w-full border rounded px-2 py-1 text-sm ${
                  overridden.goldRate
                    ? 'border-orange-500 bg-orange-50'
                    : ''
                }`}
              />
              {overridden.goldRate && (
                <p className="text-[10px] text-orange-600 mt-1">
                  Edited rate (not system default).
                </p>
              )}
              <p className="text-[11px] text-gray-600 mt-1">
                Rate per gm: Rs. {estimateResult.ratePerGm.toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Labour (₹)
              </label>
              <input
                type="number"
                value={labourStr}
                onChange={(e) => {
                  setLabourStr(e.target.value);
                  setOverridden((o) => ({ ...o, labour: true }));
                }}
                className={`w-full border rounded px-2 py-1 text-sm ${
                  overridden.labour
                    ? 'border-orange-500 bg-orange-50'
                    : ''
                }`}
              />
              {!overridden.labour && (
                <p className="text-[10px] text-gray-500 mt-1">
                  Auto calculated from metal value. You can change if needed.
                </p>
              )}
              {overridden.labour && (
                <p className="text-[10px] text-orange-600 mt-1">
                  Edited labour amount.
                </p>
              )}
            </div>

            <div className="border-t pt-3 mt-2 space-y-2">
              <h3 className="text-xs font-semibold">HSN & GST</h3>
              <div className="space-y-1">
                <label className="block text-[11px]">HSN Code</label>
                <select
                  value={selectedHsnId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedHsnId(id);
                    const entry = hsnList.find((h) => h.id === id);
                    if (entry) {
                      setGstRate(entry.gstRate);
                    }
                  }}
                  className="w-full border rounded px-2 py-1 text-xs"
                >
                  {hsnList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} – {h.title} ({h.gstRate}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px]">GST %</label>
                <input
                  type="number"
                  value={gstRate}
                  onChange={(e) => {
                    setGstRate(Number(e.target.value || 0));
                    setOverridden((o) => ({ ...o, gst: true }));
                  }}
                  className={`w-24 border rounded px-2 py-1 text-xs ${
                    overridden.gst
                      ? 'border-orange-500 bg-orange-50'
                      : ''
                  }`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right column – summary & enquiry */}
        <section className="space-y-4">
          {/* Summary card */}
          <div className="rounded-md border bg-yellow-50 overflow-hidden">
            <div className="bg-yellow-200 px-4 py-2 flex items-center justify-between">
              <h2 className="font-semibold text-sm">Summary</h2>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <p className="text-[11px] text-gray-700">
                {new Date().toLocaleString()}
              </p>
              <p className="text-[11px] text-red-600">
                {metalType === 'SILVER'
                  ? `Silver Rate per 10gm = Rs.${ratePer10Gm.toFixed(0)}`
                  : `Gold Rate per 10gm = Rs.${ratePer10Gm.toFixed(
                      0,
                    )} (${metalLabel(metalType)})`}
              </p>

              <div className="bg-cyan-50 border border-cyan-100 px-2 py-1 text-[11px]">
                Net Wt = (Gold) ={' '}
                {(estimateResult.effectiveGrossWeight || 0).toFixed(3)}gm –{' '}
                {estimateResult.totalStoneWeightGm.toFixed(3)}gm (stones) ={' '}
                {estimateResult.effectiveGoldWeight.toFixed(3)}gm
              </div>

              {/* Net row */}
              <Row
                label="Net:"
                desc={`${estimateResult.effectiveGoldWeight.toFixed(
                  3,
                )} gm × Rs.${estimateResult.ratePerGm.toFixed(2)}`}
                amount={estimateResult.metalValue}
              />

{/* All stones (Diam1, Stone1, Diam2, Stone2, etc.) */}
{estimateResult.stoneLines
  .filter((s) => s.enabled && s.stoneValue !== 0)
  .map((s) => (
    <Row
      key={s.id}
      label={`${s.label}:`}
      desc={formatStoneDesc(s)}
      amount={s.stoneValue}
    />
  ))}

              {/* Labour (no 10%/20% mention) */}
              <Row
                label="Labour:"
                desc="Making / Labour"
                amount={estimateResult.labourAmount}
                highlighted={overridden.labour}
              />

              {/* Total before GST */}
              <Row
                label="Total:"
                desc=""
                amount={estimateResult.amountAfterDiscount}
                bold
              />

              {/* GST */}
              <Row
                label="GST:"
                desc={`${gstRate}% = Rs.${estimateResult.halfGst.toFixed(
                  2,
                )} + Rs.${estimateResult.halfGst.toFixed(2)}`}
                amount={estimateResult.gstAmount}
                color="text-purple-700"
              />
            </div>
            <div className="bg-sky-500 text-white font-semibold text-lg px-4 py-2 flex justify-between">
              <span>Grand Total:</span>
              <span>Rs.{estimateResult.grandTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Enquiry / Share */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Share / Save Estimate</h2>
            <div className="grid gap-2 text-sm">
              <div>
                <label className="block text-xs mb-1">
                  Customer Name *
                </label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">
                  Mobile Number *
                </label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">City</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Remarks</label>
                <textarea
                  className="w-full border rounded px-2 py-1"
                  rows={2}
                  value={customerRemarks}
                  onChange={(e) => setCustomerRemarks(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">
                  Preferred Contact
                </label>
                <select
                  value={preferredContact}
                  onChange={(e) => setPreferredContact(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Call">Call</option>
                  <option value="Either">Either</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitEnquiry}
              className="mt-2 w-full bg-emerald-600 text-white text-sm font-medium py-2 rounded"
            >
              Save Enquiry
            </button>
            {submitStatus && (
              <p className="text-xs mt-1 text-gray-700">{submitStatus}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

/* =========================
   Small Presentational Bits
========================= */

const Row: React.FC<{
  label: string;
  desc: string;
  amount: number;
  bold?: boolean;
  highlighted?: boolean;
  color?: string;
}> = ({ label, desc, amount, bold, highlighted, color }) => {
  return (
    <div
      className={`flex justify-between text-sm ${
        highlighted ? 'text-orange-700' : color ?? ''
      }`}
    >
      <div className="flex flex-col">
        <span className={bold ? 'font-semibold' : ''}>{label}</span>
        {desc && (
          <span className="text-[11px] text-gray-600">{desc}</span>
        )}
      </div>
      <div className={bold ? 'font-semibold' : ''}>
        Rs.{amount.toFixed(2)}
      </div>
    </div>
  );
};

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
  // Weight text (prefer what user typed)
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

  // Rate text (prefer what user typed)
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

  // Per-piece style (3 pcs * 5000/pc)
  if (s.rateType === 'per_piece') {
    let pcsText: string;
    if (s.piecesDisplay && s.piecesDisplay.trim() !== '') {
      pcsText = s.piecesDisplay.trim();
    } else if (s.pieces != null) {
      pcsText = s.pieces.toString();
    } else {
      pcsText = '0';
    }

    return `${pcsText} pcs * ${rateText}${rateUnit} = Rs. ${s.stoneValue.toFixed(
      2,
    )}`;
  }

  // Weight-based style (e.g. 3.409ct * 13500/ct = Rs. 46305.00)
  return `${weightText}${unitText} * ${rateText}${rateUnit} = Rs. ${s.stoneValue.toFixed(
    2,
  )}`;
};


function resolveRatePer10Gm(metal: MetalType, cfg: RateConfig | null): number {

  if (!cfg) return 0;
  // /Global SKU/Rates:
  //  Gold 24kt, Gold 22kt, Gold 18kt, Gold 14kt are per 10gm
  //  Silver is per 1kg
  switch (metal) {
    case 'GOLD_24':
      return Number(cfg['Gold 24kt'] ?? 0);
    case 'GOLD_22':
      return Number(cfg['Gold 22kt'] ?? 0);
    case 'GOLD_18':
      return Number(cfg['Gold 18kt'] ?? 0);
    case 'GOLD_14':
      return Number(cfg['Gold 14kt'] ?? 0);
    case 'SILVER': {
      const perKg = Number(cfg['Silver'] ?? 0); // DB is per 1 kg
      // convert per kg → per 10 gm
      return perKg / 100;
    }
    default:
      return 0;
  }
}

export default EstimatePage;
