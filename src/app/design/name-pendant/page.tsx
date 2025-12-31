"use client";

import React, { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/firebaseConfig";

// ✅ Make header same as Gold Catalog
import PageLayout from "@/app/components/PageLayout";
import OfferBar from "@/app/components/OfferBar";

// ✅ Next.js App Router friendly Google Fonts
import {
  // Existing
  Allura,
  Alex_Brush,
  Great_Vibes,
  Satisfy,
  Dancing_Script,
  Pacifico,
  Italianno,
  Parisienne,
  Lobster,
  Yellowtail,
  Cookie,
  Playball,
  Rochester,
  Arizonia,

  // ✅ More Latin script fonts (20+)
  Sacramento,
  Tangerine,
  Pinyon_Script,
  Petit_Formal_Script,
  Mr_Dafoe,
  Damion,
  Courgette,
  Kaushan_Script,
  Merienda,
  Marck_Script,
  Bad_Script,
  Oleo_Script,
  Oleo_Script_Swash_Caps,
  Yesteryear,
  Sofia,
  Norican,
  Montez,
  Oooh_Baby,
  Caveat,
  Handlee,
  Rock_Salt,
  Shadows_Into_Light,

  // ✅ Regional – Hindi (Devanagari)
  Hind,
  Mukta,
  Kalam,
  Baloo_2,
  Noto_Serif_Devanagari,

  // ✅ Regional – Punjabi (Gurmukhi)
  Mukta_Mahee,
  Baloo_Paaji_2,
  Noto_Sans_Gurmukhi,
  Noto_Serif_Gurmukhi,
  Tiro_Gurmukhi,

  // ✅ Regional – Urdu/Arabic
  Noto_Nastaliq_Urdu,
  Noto_Naskh_Arabic,
  Amiri,
  Lateef,
  Scheherazade_New,
} from "next/font/google";

// --------------------
// Font loaders
// --------------------

// Base set
const fAllura = Allura({ weight: "400", subsets: ["latin"], display: "swap" });
const fAlexBrush = Alex_Brush({ weight: "400", subsets: ["latin"], display: "swap" });
const fGreatVibes = Great_Vibes({ weight: "400", subsets: ["latin"], display: "swap" });
const fSatisfy = Satisfy({ weight: "400", subsets: ["latin"], display: "swap" });
const fDancing = Dancing_Script({ weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap" });
const fPacifico = Pacifico({ weight: "400", subsets: ["latin"], display: "swap" });
const fItalianno = Italianno({ weight: "400", subsets: ["latin"], display: "swap" });
const fParisienne = Parisienne({ weight: "400", subsets: ["latin"], display: "swap" });
const fLobster = Lobster({ weight: "400", subsets: ["latin"], display: "swap" });
const fYellowtail = Yellowtail({ weight: "400", subsets: ["latin"], display: "swap" });
const fCookie = Cookie({ weight: "400", subsets: ["latin"], display: "swap" });
const fPlayball = Playball({ weight: "400", subsets: ["latin"], display: "swap" });
const fRochester = Rochester({ weight: "400", subsets: ["latin"], display: "swap" });
const fArizonia = Arizonia({ weight: "400", subsets: ["latin"], display: "swap" });

// More Latin scripts
const fSacramento = Sacramento({ weight: "400", subsets: ["latin"], display: "swap" });
const fTangerine = Tangerine({ weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const fPinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const fPetitFormal = Petit_Formal_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const fMrDafoe = Mr_Dafoe({ weight: "400", subsets: ["latin"], display: "swap" });
const fDamion = Damion({ weight: "400", subsets: ["latin"], display: "swap" });
const fCourgette = Courgette({ weight: "400", subsets: ["latin"], display: "swap" });
const fKaushan = Kaushan_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const fMerienda = Merienda({ weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const fMarck = Marck_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const fBadScript = Bad_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const fOleo = Oleo_Script({ weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const fOleoSwash = Oleo_Script_Swash_Caps({ weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const fYesteryear = Yesteryear({ weight: "400", subsets: ["latin"], display: "swap" });
const fSofia = Sofia({ weight: "400", subsets: ["latin"], display: "swap" });
const fNorican = Norican({ weight: "400", subsets: ["latin"], display: "swap" });
const fMontez = Montez({ weight: "400", subsets: ["latin"], display: "swap" });
const fOooh = Oooh_Baby({ weight: "400", subsets: ["latin"], display: "swap" });
const fCaveat = Caveat({ weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const fHandlee = Handlee({ weight: "400", subsets: ["latin"], display: "swap" });
const fRockSalt = Rock_Salt({ weight: "400", subsets: ["latin"], display: "swap" });
const fShadows = Shadows_Into_Light({ weight: "400", subsets: ["latin"], display: "swap" });

// Regional fonts
// Hindi (Devanagari)
const fHind = Hind({ weight: ["400", "600"], subsets: ["devanagari"], display: "swap" });
const fMukta = Mukta({ weight: ["400", "600"], subsets: ["devanagari"], display: "swap" });
const fKalam = Kalam({ weight: ["400", "700"], subsets: ["devanagari"], display: "swap" });
const fBaloo2 = Baloo_2({ weight: ["400", "600", "700"], subsets: ["devanagari"], display: "swap" });
const fNotoSerifDeva = Noto_Serif_Devanagari({ weight: ["400", "600"], subsets: ["devanagari"], display: "swap" });

// Punjabi (Gurmukhi)
const fMuktaMahee = Mukta_Mahee({ weight: ["400", "600"], subsets: ["gurmukhi"], display: "swap" });
const fBalooPaaji2 = Baloo_Paaji_2({ weight: ["400", "600", "700"], subsets: ["gurmukhi"], display: "swap" });
const fNotoSansGurm = Noto_Sans_Gurmukhi({ weight: ["400", "600"], subsets: ["gurmukhi"], display: "swap" });
const fNotoSerifGurm = Noto_Serif_Gurmukhi({ weight: ["400", "600"], subsets: ["gurmukhi"], display: "swap" });
const fTiroGurm = Tiro_Gurmukhi({ weight: ["400"], subsets: ["gurmukhi"], display: "swap" });

// Urdu/Arabic
const fNastaliq = Noto_Nastaliq_Urdu({ weight: ["400", "600"], subsets: ["arabic"], display: "swap" });
const fNaskh = Noto_Naskh_Arabic({ weight: ["400", "600"], subsets: ["arabic"], display: "swap" });
const fAmiri = Amiri({ weight: ["400", "700"], subsets: ["arabic"], display: "swap" });
const fLateef = Lateef({ weight: ["400"], subsets: ["arabic"], display: "swap" });
const fScheher = Scheherazade_New({ weight: ["400", "700"], subsets: ["arabic"], display: "swap" });

// --------------------
// Types + font lists
// --------------------

type FontItem = {
  id: string;
  className: string;
};

const LATIN_FONTS: FontItem[] = [
  { id: "allura", className: fAllura.className },
  { id: "alexbrush", className: fAlexBrush.className },
  { id: "greatvibes", className: fGreatVibes.className },
  { id: "satisfy", className: fSatisfy.className },
  { id: "dancingscript", className: fDancing.className },
  { id: "pacifico", className: fPacifico.className },
  { id: "italianno", className: fItalianno.className },
  { id: "parisienne", className: fParisienne.className },
  { id: "lobster", className: fLobster.className },
  { id: "yellowtail", className: fYellowtail.className },
  { id: "cookie", className: fCookie.className },
  { id: "playball", className: fPlayball.className },
  { id: "rochester", className: fRochester.className },
  { id: "arizonia", className: fArizonia.className },

  { id: "sacramento", className: fSacramento.className },
  { id: "tangerine", className: fTangerine.className },
  { id: "pinyon", className: fPinyon.className },
  { id: "petitformal", className: fPetitFormal.className },
  { id: "mrdafoe", className: fMrDafoe.className },
  { id: "damion", className: fDamion.className },
  { id: "courgette", className: fCourgette.className },
  { id: "kaushan", className: fKaushan.className },
  { id: "merienda", className: fMerienda.className },
  { id: "marck", className: fMarck.className },
  { id: "badscript", className: fBadScript.className },
  { id: "oleo", className: fOleo.className },
  { id: "oleoswash", className: fOleoSwash.className },
  { id: "yesteryear", className: fYesteryear.className },
  { id: "sofia", className: fSofia.className },
  { id: "norican", className: fNorican.className },
  { id: "montez", className: fMontez.className },
  { id: "ooohbaby", className: fOooh.className },
  { id: "caveat", className: fCaveat.className },
  { id: "handlee", className: fHandlee.className },
  { id: "rocksalt", className: fRockSalt.className },
  { id: "shadows", className: fShadows.className },
];

const REGIONAL_FONTS: FontItem[] = [
  // Hindi / Devanagari
  { id: "hind", className: fHind.className },
  { id: "mukta", className: fMukta.className },
  { id: "kalam", className: fKalam.className },
  { id: "baloo2", className: fBaloo2.className },
  { id: "notoserifdeva", className: fNotoSerifDeva.className },

  // Punjabi / Gurmukhi
  { id: "muktamahee", className: fMuktaMahee.className },
  { id: "baloopaaji2", className: fBalooPaaji2.className },
  { id: "notosansgurm", className: fNotoSansGurm.className },
  { id: "notoserifgurm", className: fNotoSerifGurm.className },
  { id: "tirogurm", className: fTiroGurm.className },

  // Urdu / Arabic
  { id: "nastaliq", className: fNastaliq.className },
  { id: "naskh", className: fNaskh.className },
  { id: "amiri", className: fAmiri.className },
  { id: "lateef", className: fLateef.className },
  { id: "scheher", className: fScheher.className },
];

const WHATSAPP_NUMBER = "919023130944";

// --- Estimate rules ---
const GM_PER_CHAR = 0.8;
const HOOKS_GM = 0.8;
const LABOUR_PERCENT = 0.1;

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
function money(n: number) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function NameFontsPage() {
  const [name, setName] = useState("Aashi");
  const [selectedFontId, setSelectedFontId] = useState(LATIN_FONTS[0].id);

  // ✅ same header data as GoldCatalog
  const [goldRate, setGoldRate] = useState("Loading...");
  const [rateDate, setRateDate] = useState("");

  useEffect(() => {
    const rateRef = ref(db, "Global SKU/Rates/Gold 22kt");
    const dateRef = ref(db, "Global SKU/Rates/Date");

    const unsubRate = onValue(rateRef, (s) => setGoldRate(s.val()));
    const unsubDate = onValue(dateRef, (s) => setRateDate(s.val()));

    return () => {
      unsubRate();
      unsubDate();
    };
  }, []);

  // ✅ Convert string rate to number for calculations
  const rate22 = useMemo(() => {
    const n = Number(goldRate);
    return Number.isFinite(n) ? n : null;
  }, [goldRate]);

  const cleanName = useMemo(() => name.trim(), [name]);

  const tentativeWeightGm = useMemo(() => {
    const charCount = cleanName.replace(/\s+/g, "").length;
    if (!charCount) return 0;
    return round3(charCount * GM_PER_CHAR + HOOKS_GM);
  }, [cleanName]);

  const estimatedTotal = useMemo(() => {
    if (!rate22 || tentativeWeightGm <= 0) return 0;

    // rate22 is ₹ per 10gm (as per your Firebase)
    const ratePerGram = rate22 / 10;

    const base = tentativeWeightGm * ratePerGram;
    const labour = base * LABOUR_PERCENT;
    return base + labour;
  }, [rate22, tentativeWeightGm]);

  const selectedFont = useMemo(() => {
    const all = [...LATIN_FONTS, ...REGIONAL_FONTS];
    return all.find((f) => f.id === selectedFontId) ?? LATIN_FONTS[0];
  }, [selectedFontId]);

  const whatsappLink = useMemo(() => {
    const txt = [
      "Hi CityJeweller.in, I want a quote for a personalised name pendant.",
      `Name: ${cleanName || "(empty)"}`,
      `Style: Font Selection`,
      `Font ID: ${selectedFontId}`,
      `Tentative Weight: ${tentativeWeightGm.toFixed(3)} gm`,
      `Estimated Total: ₹${money(estimatedTotal)}`,
      "",
      "Please share final quote & delivery timeline.",
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(txt)}`;
  }, [cleanName, selectedFontId, tentativeWeightGm, estimatedTotal]);

  const whatsappDesignPhotoLink = useMemo(() => {
    const txt = [
      "Hi CityJeweller.in, I want a quote for a personalised name pendant.",
      `Name: ${cleanName || "(empty)"}`,
      "",
      "I will share my design photo here. Please confirm final quote & timeline.",
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(txt)}`;
  }, [cleanName]);

  return (
    <PageLayout>
      {/* ✅ SAME header bar as Gold Catalog */}
      <OfferBar goldRate={goldRate} rateDate={rateDate} />

      <div className="wrap">
        <header className="header">
          <div>
            <h1 className="title">Choose Your Name Pendant Style</h1>
            <p className="subtitle">Type your name, tap any style, then send it for quotation.</p>
          </div>

          <div className="headerBtns">
            <a className="btn secondary" href={whatsappDesignPhotoLink} target="_blank" rel="noreferrer">
              Share design photo
            </a>
            <a className="btn primary" href={whatsappLink} target="_blank" rel="noreferrer">
              Send for Quote
            </a>
          </div>
        </header>

        <section className="controls">
          <div className="field">
            <label className="label">Enter Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type name…"
              maxLength={20}
            />
          </div>

          <div className="estimateCard">
            <div className="estimateTitle">Tentative Estimate</div>

            <div className="estimateGrid">
              <div className="row">
                <div className="k">Tentative Weight</div>
                <div className="v">{tentativeWeightGm > 0 ? `${tentativeWeightGm.toFixed(3)} gm` : "—"}</div>
              </div>

              <div className="row total">
                <div className="k">Estimated Total</div>
                <div className="v">{rate22 && tentativeWeightGm > 0 ? `₹${money(estimatedTotal)}` : "—"}</div>
              </div>
            </div>

            <div className="note">
              *Tentative estimate. Final quote may vary based on thickness, finishing, hooks and exact design.
            </div>
          </div>
        </section>

        <div className="sectionTitle">Popular Script Styles</div>
        <section className="grid">
          {LATIN_FONTS.map((font) => {
            const isSelected = font.id === selectedFontId;
            return (
              <button
                key={font.id}
                className={`card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedFontId(font.id)}
                type="button"
                aria-label={`Select style ${font.id}`}
              >
                <div className="check">{isSelected ? "✓" : ""}</div>
                <div className={`preview ${font.className}`}>{cleanName || "Your Name"}</div>
              </button>
            );
          })}
        </section>

        <div className="sectionTitle">Regional Language Styles (Hindi • Punjabi • Urdu)</div>
        <section className="grid">
          {REGIONAL_FONTS.map((font) => {
            const isSelected = font.id === selectedFontId;
            return (
              <button
                key={font.id}
                className={`card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedFontId(font.id)}
                type="button"
                aria-label={`Select style ${font.id}`}
              >
                <div className="check">{isSelected ? "✓" : ""}</div>
                <div className={`preview ${font.className}`}>{cleanName || "Your Name"}</div>
              </button>
            );
          })}
        </section>

        {/* hidden use so TS doesn't mark it unused */}
        <div style={{ display: "none" }}>{selectedFont.className}</div>
      </div>

      <style jsx>{`
        .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px 16px 40px;
        }

        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .title {
          font-size: 28px;
          line-height: 1.2;
          margin: 0;
        }
        .subtitle {
          margin: 8px 0 0;
          opacity: 0.8;
        }

        .headerBtns {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .btn {
          text-decoration: none;
          padding: 10px 12px;
          border-radius: 12px;
          font-weight: 800;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: inherit;
        }
        .btn.primary {
          background: #0b7;
          border-color: rgba(0, 0, 0, 0);
          color: #fff;
        }
        .btn.secondary {
          background: rgba(255, 255, 255, 0.06);
        }

        .controls {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 14px;
          margin: 14px 0 18px;
        }
        @media (max-width: 900px) {
          .controls {
            grid-template-columns: 1fr;
          }
        }

        .field {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 14px;
        }
        .label {
          display: block;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .input {
          width: 100%;
          font-size: 18px;
          padding: 12px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          outline: none;
          background: rgba(0, 0, 0, 0.25);
          color: inherit;
        }

        .estimateCard {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 14px;
        }
        .estimateTitle {
          font-size: 18px;
          font-weight: 900;
          margin-bottom: 10px;
        }
        .estimateGrid {
          display: grid;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 14px;
        }
        .k {
          opacity: 0.75;
        }
        .v {
          font-weight: 900;
        }
        .total .v {
          font-size: 18px;
        }
        .note {
          margin-top: 10px;
          font-size: 12px;
          opacity: 0.7;
          line-height: 1.35;
        }

        .sectionTitle {
          margin: 18px 2px 10px;
          font-weight: 900;
          opacity: 0.9;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 8px;
        }
        @media (max-width: 980px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 520px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          position: relative;
          text-align: left;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 18px;
          padding: 18px 14px;
          cursor: pointer;
          transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
          min-height: 110px;
          display: flex;
          align-items: center;
        }
        .card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.045);
        }
        .selected {
          border-color: rgba(0, 187, 119, 0.65);
          box-shadow: 0 0 0 1px rgba(0, 187, 119, 0.25) inset;
        }

        .check {
          position: absolute;
          top: 10px;
          right: 12px;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 14px;
          color: #0b7;
        }

        .preview {
          font-size: 44px;
          line-height: 1;
          letter-spacing: 0.2px;
          word-break: break-word;
          width: 100%;
        }
      `}</style>
    </PageLayout>
  );
}
