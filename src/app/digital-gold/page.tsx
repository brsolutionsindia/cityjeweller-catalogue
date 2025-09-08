// app/digital-gold/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig'; // ← one level up from /app/digital-gold
import styles from '../page.module.css';

// Keep the same header/footer + offer bars as Home
import PageLayout from '../components/PageLayout';
import OfferBar from '../components/OfferBar';

const WHATSAPP_NUMBER = '919023130944';

export default function DigitalGoldPage() {
  // For OfferBars (match Home)
  const [goldRate, setGoldRate] = useState('Loading...');
  const [rateDate, setRateDate] = useState('');

  // For page calculator
  const [ratePer10, setRatePer10] = useState<number | null>(null);
  const [mode, setMode] = useState<'AMOUNT' | 'GRAMS'>('AMOUNT');
  const [amount, setAmount] = useState<string>('5000');
  const [grams, setGrams] = useState<string>('');

  // Fetch live rates (paths identical to Home)
  useEffect(() => {
    const goldRef = ref(db, 'Global SKU/Rates/Gold 22kt');
    const dateRef = ref(db, 'Global SKU/Rates/Date');

    const un1 = onValue(goldRef, (s) => {
      const val = s.val();
      setGoldRate(val);
      const parsed = typeof val === 'string' ? parseFloat(val.replace(/[^\d.]/g, '')) : Number(val);
      setRatePer10(Number.isFinite(parsed) ? parsed : null);
    });
    const un3 = onValue(dateRef, (s) => setRateDate(s.val() || ''));

    return () => {
      un1();
      un2();
      un3();
    };
  }, []);

  const ratePerGram = useMemo(() => (ratePer10 ? ratePer10 / 10 : null), [ratePer10]);

  // Calculator derive (₹ ↔ g)
  useEffect(() => {
    if (!ratePerGram) return;
    if (mode === 'AMOUNT') {
      const amt = parseFloat(amount || '0');
      const g = amt > 0 ? amt / ratePerGram : 0;
      setGrams(g ? g.toFixed(4) : '');
    } else {
      const g = parseFloat(grams || '0');
      const a = g > 0 ? g * ratePerGram : 0;
      setAmount(a ? a.toFixed(0) : '');
    }
  }, [amount, grams, mode, ratePerGram]);

  const handleAmountChange = (v: string) => {
    setMode('AMOUNT');
    setAmount(v.replace(/[^\d.]/g, ''));
  };
  const handleGramsChange = (v: string) => {
    setMode('GRAMS');
    setGrams(v.replace(/[^\d.]/g, ''));
  };

  const whatsAppText = useMemo(() => {
    const a = amount || '0';
    const g = grams || '0';
    const r10 = ratePer10 ? `₹${ratePer10.toLocaleString('en-IN')}/10gm` : 'N/A';
    const r1 = ratePerGram ? `₹${ratePerGram.toFixed(2)}/gm` : 'N/A';
    const date = rateDate || 'Today';
    return encodeURIComponent(
      `Hello, I want to buy Digital Gold on CityJeweller.in\n\n` +
      `Amount: ₹${a}\n` +
      `Grams (approx): ${g} gm\n` +
      `Rate: ${r10} (≈ ${r1})\n` +
      `Rate Date: ${date}\n\n` +
      `Please share the next steps.`
    );
  }, [amount, grams, ratePer10, ratePerGram, rateDate]);

  const whatsappHref = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${whatsAppText}`;

  return (
    <>
      <Head>
        <title>Digital Gold | CityJeweller.in</title>
        <meta
          name="description"
          content="Buy 22kt Digital Gold at today's live rate. Accumulate in grams and redeem in gold or diamond jewellery at CityJeweller.in."
        />
        {/* FAQ Structured Data for SEO */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>

      <PageLayout>
        {/* Keep the same top bars like Home */}
        <OfferBar goldRate={goldRate} rateDate={rateDate} />

        <main className={styles.dgContainer}>
          {/* Hero */}
          <section className={styles.dgSection}>
            <div className={styles.dgHeroGrid}>
              <div>
                <h1 className={styles.dgH1}>Buy 22kt Digital Gold at Today’s Rate</h1>
                <p className={styles.dgMuted}>
                  Invest, save & redeem in beautiful <b>Gold</b> and <b>Certified Diamond</b> jewellery at CityJeweller.in.
                </p>
                <div className={styles.dgRateCard}>
                  <div>
                    <div className={styles.dgRateLabel}>Live 22kt Rate</div>
                    <div className={styles.dgRateValue}>
                      {ratePer10 ? (
                        <>
                          ₹{ratePer10.toLocaleString('en-IN')} <small style={{ fontWeight: 500 }}>/10gm</small>
                        </>
                      ) : (
                        'Fetching...'
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.dgRateLabel}>As of</div>
                    <div style={{ fontWeight: 600 }}>{rateDate || 'Today'}</div>
                  </div>
                </div>
                <ul className={styles.dgP} style={{ margin: '12px 0 0 18px', lineHeight: 1.6 }}>
                  <li>Start with any amount — even small, regular savings.</li>
                  <li>Track holdings in grams at transparent live rates.</li>
                  <li>Redeem anytime against jewellery on CityJeweller.in.</li>
                </ul>
              </div>

              {/* Calculator */}
              <div className={`${styles.dgCard} ${styles.dgCardSticky}`}>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Digital Gold Calculator</h3>
                <label className={styles.dgLabel}>Enter Amount (₹)</label>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="e.g., 5000"
                  className={styles.dgInput}
                />
                <div className={styles.dgNote} style={{ margin: '8px 0' }}>or</div>
                <label className={styles.dgLabel}>Enter Grams (gm)</label>
                <input
                  inputMode="decimal"
                  value={grams}
                  onChange={(e) => handleGramsChange(e.target.value)}
                  placeholder="e.g., 2.35"
                  className={styles.dgInput}
                />

                <div className={styles.dgNote}>
                  {ratePerGram
                    ? <>Using rate ≈ <b>₹{ratePerGram.toFixed(2)}/gm</b> (₹{ratePer10?.toLocaleString('en-IN')}/10gm)</>
                    : 'Fetching live rate...'}
                </div>

                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.dgCTA}>
                  Buy via WhatsApp
                </a>
                <div className={styles.dgNote} style={{ marginTop: 8 }}>
                  No online payment yet — confirm on WhatsApp, we’ll record your units.
                </div>
              </div>
            </div>
          </section>

          {/* Why Digital Gold with CityJeweller */}
          <section className={styles.dgSection}>
            <h2 className={styles.dgH2}>Why Digital Gold with CityJeweller.in?</h2>
            <div className={styles.dgGrid4}>
              <Feature title="Hedge Against Inflation" text="Gold is a time-tested store of value. Build a cushion against currency swings." />
              <Feature title="Start Small, Grow Consistently" text="Buy tiny amounts, regularly. Your grams add up over time." />
              <Feature title="Transparent Live Rates" text="We show the same wholesale-driven 22kt rate we use across our catalogue." />
              <Feature title="100% Redeemable" text="Convert to gold or certified diamond jewellery whenever you’re ready." />
            </div>
          </section>

          {/* How it works */}
          <section className={styles.dgSection}>
            <h2 className={styles.dgH2}>How It Works</h2>
            <ol className={styles.dgSteps}>
              <li><b>Check Today’s Rate</b> — auto-fetched from our live database.</li>
              <li><b>Use the Calculator</b> — choose ₹ or grams to plan your buy.</li>
              <li><b>Confirm on WhatsApp</b> — we record your units (grams) at the locked rate.</li>
              <li><b>Redeem Anytime</b> — set off against jewellery on CityJeweller.in.</li>
            </ol>
          </section>

          {/* Hedge explainer */}
          <section className={styles.dgSection}>
            <h2 className={styles.dgH2}>Hedge with Gold, Redeem as Jewellery</h2>
            <p className={styles.dgP}>
              Gold has historically acted as a safe-haven during uncertainty. With Digital Gold on CityJeweller.in, you can
              accumulate grams at live 22kt rates and later redeem them against stunning designs in gold and certified diamonds.
            </p>
          </section>

          {/* Redeem options */}
          <section className={styles.dgSection}>
            <h2 className={styles.dgH2}>Redeem Options</h2>
            <div className={styles.dgGrid4}>
              <RedeemCard title="Rings & Bands" />
              <RedeemCard title="Earrings & Tops" />
              <RedeemCard title="Chains & Pendants" />
              <RedeemCard title="Bangles & Bracelets" />
            </div>
            <div className={styles.dgNote} style={{ marginTop: 8 }}>
              Tip: Showcase 4–8 representative SKUs here to inspire confidence.
            </div>
          </section>

          {/* FAQs */}
          <section className={styles.dgSection}>
            <h2 className={styles.dgH2}>FAQs</h2>
            <FAQ q="What is Digital Gold on CityJeweller.in?" a="It’s 22kt gold tracked in grams at live rates. We record your units after you confirm on WhatsApp." />
            <FAQ q="How do I buy without a payment gateway?" a="Use the calculator, click WhatsApp, and confirm. We’ll share a payment link or offline options and record your units." />
            <FAQ q="Can I sell back for cash?" a="Currently, redemption is against jewellery purchases on CityJeweller.in. Cash buy-back is not enabled." />
            <FAQ q="Are there hidden charges?" a="No hidden charges. You purchase at live 22kt rate. Standard making/wastage/stone charges apply only when you redeem for jewellery, as per product." />
            <FAQ q="How do I track my holdings?" a="We’ll message your current grams and maintain records against your mobile number. A login dashboard can be added later." />
          </section>

          {/* Final CTA */}
          <section className={`${styles.dgSection} ${styles.dgFinalCenter}`}>
            <h3 style={{ marginTop: 0 }}>Ready to Start Your Gold Savings?</h3>
            <div className={styles.dgNote} style={{ marginBottom: 8 }}>
              Live 22kt rate: {ratePer10 ? <>₹{ratePer10.toLocaleString('en-IN')} /10gm</> : 'Fetching...'} {rateDate ? `(as of ${rateDate})` : ''}
            </div>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={styles.dgCTA}>
              Buy via WhatsApp
            </a>
          </section>

          {/* Light disclaimer */}
          <section className={styles.dgSection} style={{ fontSize: 12, color: '#6b7280' }}>
            <p className={styles.dgP}>
              Disclaimer: Digital Gold on CityJeweller.in is a savings & redemption facility recorded against your mobile number.
              Units are redeemable against jewellery purchases on our platform. Prices are linked to live 22kt rates and may change.
            </p>
          </section>
        </main>
      </PageLayout>
    </>
  );
}

/* ---------- Small presentational helpers ---------- */

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.dgFeature}>
      <div className={styles.dgFeatureTitle}>{title}</div>
      <div className={styles.dgFeatureText}>{text}</div>
    </div>
  );
}

function RedeemCard({ title }: { title: string }) {
  return (
    <div className={styles.dgRedeemCard}>
      <div className={styles.dgRedeemPreview} />
      <div style={{ fontWeight: 600 }}>{title}</div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className={styles.dgFaq}>
      <summary className={styles.dgFaqQ}>{q}</summary>
      <div className={styles.dgFaqA}>{a}</div>
    </details>
  );
}

/* ---------- FAQ JSON-LD for SEO ---------- */
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'mainEntity': [
    {
      '@type': 'Question',
      'name': 'What is Digital Gold on CityJeweller.in?',
      'acceptedAnswer': { '@type': 'Answer', 'text': 'It’s 22kt gold tracked in grams at live rates. We record your units after you confirm on WhatsApp.' }
    },
    {
      '@type': 'Question',
      'name': 'How do I buy without a payment gateway?',
      'acceptedAnswer': { '@type': 'Answer', 'text': 'Use the calculator, click WhatsApp, and confirm. We’ll share a payment link or offline options and record your units.' }
    },
    {
      '@type': 'Question',
      'name': 'Can I sell back for cash?',
      'acceptedAnswer': { '@type': 'Answer', 'text': 'Currently, redemption is against jewellery purchases on CityJeweller.in. Cash buy-back is not enabled.' }
    },
    {
      '@type': 'Question',
      'name': 'Are there hidden charges?',
      'acceptedAnswer': { '@type': 'Answer', 'text': 'No hidden charges. You purchase at live 22kt rate. Standard making/wastage/stone charges apply only when you redeem for jewellery, as per product.' }
    },
    {
      '@type': 'Question',
      'name': 'How do I track my holdings?',
      'acceptedAnswer': { '@type': 'Answer', 'text': 'We’ll message your current grams and maintain records against your mobile number. A login dashboard can be added later.' }
    }
  ]
};
