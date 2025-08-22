'use client'

import { useEffect, useState } from 'react'
import { useForm, FormProvider, useFormContext } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'

// -----------------------------------------------
// Config (put images in /public/images)
// -----------------------------------------------
const IMG = {
  style: {
    Arabic: '/images/Arabic.png',
    Bharva: '/images/Bharva.png',
    Designer: '/images/designer.png',
    Custom: '/images/custom-placeholder.png',
  },
  coverage: {
    section1: '/images/wrist.png',
    section2: '/images/lowerArm.png',
    section3: '/images/upperArm.png',
  },
}

const PAYMENT = {
  upiId: 'baderarenu19@okicici',            // ← update to your UPI ID
  qrPath: '/images/upi-qr.png', // ← ensure this exists
}

// -----------------------------------------------
// Schema & Types
// -----------------------------------------------
const phoneRegexIN = /^(?:\+?91[-\s]?)?[6-9]\d{9}$/;


const FormSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  whatsapp: z.string().regex(phoneRegexIN, 'Enter a valid WhatsApp number (India)'),
  style: z.enum(['Arabic', 'Bharva', 'Designer', 'Custom design']),
  // SINGLE-SELECT coverage
  coverage: z.enum(['section1', 'section2', 'section3'], {
    required_error: 'Please select coverage',
    invalid_type_error: 'Please select coverage',
  }),
  figures: z.coerce.number().min(0).max(20).default(0),
  budgetRange: z.enum(['<2k', '2k-4k', '4k-7k', '7k+']).optional(),
  slot: z.string().min(1, 'Please pick a time slot'),
  notes: z.string().max(500).optional(),
  consent: z.boolean().refine(v => v === true, { message: 'You must accept the terms to proceed' }),
})

export type RegisterForm = z.infer<typeof FormSchema>

// -----------------------------------------------
// Helpers & constants
// -----------------------------------------------
const STEPS = ['Your Details', 'Design & Service', 'Pick a Slot', 'Review & Submit'] as const

const STYLE_BASE: Record<RegisterForm['style'], number> = {
  Arabic: 1100,
  Bharva: 2100,
  Designer: 2100,
  'Custom design': 2100,
}

const COVERAGE_LABEL: Record<'section1' | 'section2' | 'section3', string> = {
  section1: 'Front & Back Palm (till wrist)',
  section2: 'Front & Back Lower Arm',
  section3: 'Front & Back Upper Arm',
}
const SECTION_INDEX: Record<'section1' | 'section2' | 'section3', 1 | 2 | 3> = {
  section1: 1,
  section2: 2,
  section3: 3,
}

function pad(n: number) { return n.toString().padStart(2, '0') }
function generateSlots(startHour = 9, endHour = 23) {
  const out: string[] = []
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      const start = `${pad(h)}:${pad(m)}`
      const endMinutes = m + 30
      const endH = h + Math.floor(endMinutes / 60)
      const endM = endMinutes % 60
      out.push(`${start}–${pad(endH)}:${pad(endM)}`)
    }
  }
  return out
}
const SLOTS_ALL = generateSlots(9, 23)

function timeAdjustmentForSlot(slot?: string) {
  if (!slot) return { multiplier: 1, label: '—' }
  const hour = Number(slot.slice(0, 2))
  if (hour < 10) return { multiplier: 0.9, label: 'Early-bird 10% off (before 10 AM)' }
  if (hour >= 17) {
    const pct = (hour - 16) * 10 // 17→5%, 18→10%, ...
    return { multiplier: 1 + pct / 100, label: `Premium +${pct}% (post 5 PM)` }
  }
  return { multiplier: 1, label: 'Standard rate (10 AM – 5 PM)' }
}

function useLocalDraft(key: string, methods: ReturnType<typeof useForm<RegisterForm>>) {
  const { watch, reset } = methods
  useEffect(() => {
    const cached = localStorage.getItem(key)
    if (cached) { try { reset(JSON.parse(cached)) } catch {} }
  }, [key, reset])
  useEffect(() => {
    const s = watch(v => localStorage.setItem(key, JSON.stringify(v)))
    return () => s.unsubscribe()
  }, [key, watch])
}

function computeTotals(v: Partial<RegisterForm>) {
  const sectionIdx = v.coverage ? SECTION_INDEX[v.coverage as keyof typeof SECTION_INDEX] : 0
  const base = v.style ? STYLE_BASE[v.style] : 0
  const figuresCost = Number(v.figures || 0) * 750
  const subtotal = base * sectionIdx + figuresCost
  const { multiplier, label } = timeAdjustmentForSlot(v.slot)
  const total = Math.round(subtotal * multiplier)
  const advance = Math.round(total * 0.1)
  return { sectionIdx, base, figuresCost, subtotal, multiplier, label, total, advance }
}

// -----------------------------------------------
// Page
// -----------------------------------------------
export default function Page() {
  const [step, setStep] = useState(0)

  const methods = useForm<RegisterForm>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fullName: '',
      whatsapp: '',
      style: 'Arabic',
      coverage: 'section1',  // default single selection
      figures: 0,
      budgetRange: undefined,
      slot: '',
      notes: '',
      consent: false,
    },
    mode: 'onChange',
  })

  useLocalDraft('royal-mehendi-register-draft', methods)

  const values = methods.watch()
  const progress = Math.round(((step + 1) / STEPS.length) * 100)
  const totals = computeTotals(values)

  const nextFields: Record<number, (keyof RegisterForm)[]> = {
    0: ['fullName', 'whatsapp'],
    1: ['style', 'coverage', 'figures', 'budgetRange', 'notes'],
    2: ['slot'],
    3: ['consent'],
  }

  const goNext = async () => {
    const ok = await methods.trigger(nextFields[step])
    if (ok) setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const goBack = () => setStep(s => Math.max(s - 1, 0))

  const onSubmit = async (data: RegisterForm) => {
    const t = computeTotals(data)
    const lines = [
      'Royal Mehendi by Renu — Registration',
      '',
      `Name: ${data.fullName}`,
      `WhatsApp: ${data.whatsapp}`,
      `Style: ${data.style}`,
      `Coverage: ${COVERAGE_LABEL[data.coverage]}`,
      `Figures: ${data.figures}`,
      `Preferred Slot: ${data.slot} (${timeAdjustmentForSlot(data.slot).label})`,
      data.budgetRange ? `Budget: ${data.budgetRange}` : undefined,
      data.notes ? `Notes: ${data.notes}` : undefined,
      '',
      `Subtotal: ₹${t.subtotal.toLocaleString('en-IN')}`,
      `Time Adj: ${timeAdjustmentForSlot(data.slot).label}`,
      `Total Payable: ₹${t.total.toLocaleString('en-IN')}`,
      `Advance (10%): ₹${t.advance.toLocaleString('en-IN')}`,
      '',
      `I will pay 10% advance to UPI ID: ${PAYMENT.upiId}, and share the screenshot here for confirmation.`,

    ].filter(Boolean)
    const msg = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/919023296310?text=${msg}`, '_blank')
    localStorage.removeItem('royal-mehendi-register-draft')
    setStep(0); methods.reset()
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-white via-[#fafafa] to-white">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-10">
        {/* Header */}
        <div className="mb-6 flex flex-col items-start justify-between gap-2 md:mb-8 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Royal Mehendi by Renu — Registration</h1>
            <p className="mt-1 text-sm text-gray-500">Event: <span className="font-medium">9 October</span> • Venue: <span className="font-medium">Rajasthan Bhawan</span></p>
          </div>
          <a className="inline-flex items-center rounded-lg border bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50"
             href="https://docs.google.com/forms/d/1mycJyWkD8QjW1kv4-C9JgoDHanP6BaaIdfurOsZ_fLQ/viewform" target="_blank" rel="noreferrer">
            Prefer Google Form?
          </a>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
              <div className="bg-gradient-to-r from-emerald-50 to-amber-50 px-6 py-4">
                <h2 className="text-lg font-semibold">{STEPS[step]}</h2>
              </div>
              <div className="p-6">
                {step === 0 && <StepDetails />}
                {step === 1 && <StepDesign />}
                {step === 2 && <StepSlots />}
                {step === 3 && <StepReview values={values as RegisterForm} totals={totals} />}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={goBack} disabled={step === 0}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button
  type="button"
  onClick={goNext}
  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
>
  Continue
</button>

              ) : (
                <button
  type="button"
  onClick={methods.handleSubmit(onSubmit)}
  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
>
  Submit & Open WhatsApp
</button>

              )}
            </div>
          </form>
        </FormProvider>

        <div className="mt-10 text-sm text-gray-500">
          <p>Having trouble? You can also register via our{' '}
            <a className="text-emerald-700 underline"
               href="https://docs.google.com/forms/d/1mycJyWkD8QjW1kv4-C9JgoDHanP6BaaIdfurOsZ_fLQ/viewform" target="_blank" rel="noreferrer">
              Google Form
            </a>.
          </p>
          <p className="mt-2">For any queries, WhatsApp: 9023296310</p>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------
// Steps
// -----------------------------------------------
function StepDetails() {
  const methods = useFormContext<RegisterForm>()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="fullName" className="text-sm font-medium">Full Name</label>
        <input id="fullName" className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
               placeholder="e.g., Riya Sharma" {...methods.register('fullName')} />
        <FieldError name="fullName" />
      </div>
      <div className="grid gap-2">
        <label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp Number (India)</label>
        <input id="whatsapp" inputMode="numeric" className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
               placeholder="10-digit number" {...methods.register('whatsapp')} />
        <FieldError name="whatsapp" />
      </div>
    </motion.div>
  )
}

function StepDesign() {
  const methods = useFormContext<RegisterForm>()
  const style = methods.watch('style')
  const coverage = methods.watch('coverage')
  const figures = methods.watch('figures')
  const preview = computeTotals({ style, coverage, figures })

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6">
      {/* Style */}
      <div className="grid gap-2">
        <span className="text-sm font-medium">Preferred Style</span>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(['Arabic', 'Bharva', 'Designer', 'Custom design'] as RegisterForm['style'][]).map((opt) => (
            <label key={opt}
                   className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center ${style === opt ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-gray-50'}`}>
              <img
  src={opt === 'Custom design' ? IMG.style.Custom : IMG.style[opt as 'Arabic' | 'Bharva' | 'Designer']}
  alt={`${opt} preview`}
  className="mx-auto block h-40 w-auto rounded-lg object-contain"
/>

              <input type="radio" name="style" className="hidden" checked={style === opt} onChange={() => methods.setValue('style', opt)} />
              <div className="text-sm font-medium">{opt}</div>
              <div className="text-xs text-gray-500">₹{STYLE_BASE[opt].toLocaleString('en-IN')} × section index</div>
            </label>
          ))}
        </div>
        <FieldError name="style" />
      </div>

      {/* Coverage (single-select) */}
      <div className="grid gap-2">
        <span className="text-sm font-medium">Coverage</span>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {([
            { id: 'section1', label: COVERAGE_LABEL.section1, img: IMG.coverage.section1 },
            { id: 'section2', label: COVERAGE_LABEL.section2, img: IMG.coverage.section2 },
            { id: 'section3', label: COVERAGE_LABEL.section3, img: IMG.coverage.section3 },
          ] as const).map((c) => {
            const active = coverage === c.id
            return (
              <label key={c.id}
                     className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center ${active ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-gray-50'}`}>
                <img src={c.img} alt={c.label} className="mx-auto block h-44 w-auto rounded-lg object-contain" />

                <input type="radio" name="coverage" className="hidden" checked={active}
                       onChange={() => methods.setValue('coverage', c.id as RegisterForm['coverage'])}/>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-gray-500">Section {SECTION_INDEX[c.id]}</div>
              </label>
            )
          })}
        </div>
        <FieldError name="coverage" />
      </div>

      {/* Figures & Estimator */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <label htmlFor="figures" className="text-sm font-medium">Number of Figures (₹750 each)</label>
          <input id="figures" type="number" min={0} max={20}
                 className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
                 {...methods.register('figures', { valueAsNumber: true })} />
          <FieldError name="figures" />
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Budget</span>
<select
  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
  value={methods.watch('budgetRange') || ''}
  onChange={(e) =>
    methods.setValue(
      'budgetRange',
      (e.target.value || undefined) as RegisterForm['budgetRange']
    )
  }
>

            <option value="">Optional</option>
            <option value="<2k">Below ₹2,000</option>
            <option value="2k-4k">₹2,000–₹4,000</option>
            <option value="4k-7k">₹4,000–₹7,000</option>
            <option value="7k+">₹7,000+</option>
          </select>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Subtotal (before time adj.)</span>
          <div className="rounded-lg border bg-gray-50 p-2 text-center text-sm font-medium">
            ₹ {preview.subtotal.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="notes" className="text-sm font-medium">Notes (Design refs, allergies, etc.)</label>
        <textarea id="notes" rows={4} className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                  placeholder="Anything we should know?" {...methods.register('notes')} />
      </div>
    </motion.div>
  )
}

function StepSlots() {
  const methods = useFormContext<RegisterForm>()
  const slot = methods.watch('slot')
  const adj = timeAdjustmentForSlot(slot)
  const preview = computeTotals({ ...methods.getValues(), slot })

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4">
      <p className="text-sm text-gray-500">
        Slots available <b>9:00 AM – 11:00 PM</b>. Early-bird <b>10% off</b> before 10 AM. Premium <b>+10% per hour</b> after 5 PM.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SLOTS_ALL.map((t) => {
          const active = slot === t
          return (
            <button type="button" key={t} onClick={() => methods.setValue('slot', t)}
                    className={`rounded-xl border p-3 text-sm ${active ? 'border-emerald-500 bg-emerald-50 font-medium' : 'hover:bg-gray-50'}`}>
              {t}
            </button>
          )
        })}
      </div>
      <FieldError name="slot" />

      {slot ? (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div>Time adjustment: <b>{adj.label}</b></div>
          <div>
            Total with adjustment: <b>₹ {preview.total.toLocaleString('en-IN')}</b> (advance 10%: ₹ {preview.advance.toLocaleString('en-IN')})
          </div>
        </div>
      ) : null}
    </motion.div>
  )
}

function StepReview({ values, totals }: { values: RegisterForm; totals: ReturnType<typeof computeTotals> }) {
  const methods = useFormContext<RegisterForm>()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <ReviewRow label="Name" value={values.fullName} />
      <ReviewRow label="WhatsApp" value={values.whatsapp} />
      <hr className="my-2 border-gray-200" />
      <ReviewRow label="Style" value={values.style} />
      <ReviewRow label="Coverage" value={COVERAGE_LABEL[values.coverage]} />
      <ReviewRow label="Figures" value={String(values.figures)} />
      <ReviewRow label="Budget" value={values.budgetRange || '—'} />
      <ReviewRow label="Preferred Slot" value={`${values.slot} (${timeAdjustmentForSlot(values.slot).label})`} />
      {values.notes ? <ReviewRow label="Notes" value={values.notes} /> : null}

      <div className="rounded-xl border bg-gray-50 p-4">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-medium">₹ {totals.subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Time adjustment</span>
            <span className="font-medium">{timeAdjustmentForSlot(values.slot).label}</span>
          </div>
          <div className="flex items-center justify-between text-base">
            <span className="font-semibold">Total Payable</span>
            <span className="font-semibold">₹ {totals.total.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Advance (10%)</span>
            <span className="font-medium">₹ {totals.advance.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-sm">
          <div className="mb-2 font-semibold">Pay 10% advance to reserve your slot</div>

          <div className="mb-1">
  UPI ID:{" "}
  <button
    type="button"
    onClick={() => {
      navigator.clipboard.writeText(PAYMENT.upiId)
      alert("UPI ID copied to clipboard!")
    }}
    className="font-medium text-emerald-700 hover:underline"
  >
    {PAYMENT.upiId}
  </button>
</div>


          <div className="mb-2 text-xs text-gray-500">Please pay and share the screenshot on WhatsApp for confirmation.</div>
          <img
  src={PAYMENT.qrPath}
  alt="Payment QR"
  className="mx-auto h-60 w-60 rounded-xl border-2 object-contain shadow-md"
/>

        </div>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <input id="consent" type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300"
               checked={values.consent} onChange={(e) => methods.setValue('consent', e.target.checked)} />
        <label htmlFor="consent" className="text-sm leading-5 text-gray-600">
          I agree to be contacted on WhatsApp/SMS/Call about my appointment. I accept the event T&Cs and privacy policy.
        </label>
      </div>
      <FieldError name="consent" />

      <p className="text-xs text-gray-500">
        Note: Submitting will open WhatsApp with your details and pricing. Please attach the screenshot of the advance
        payment there.
      </p>
    </motion.div>
  )
}

// -----------------------------------------------
// Small UI helpers
// -----------------------------------------------
function FieldError({ name }: { name: keyof RegisterForm }) {
  const {
    formState: { errors },
  } = useFormContext<RegisterForm>();

  const err = (errors as FieldErrors<RegisterForm>)[name] as RHFFieldError | undefined;
  if (!err?.message) return null;

  return <p className="text-xs text-red-600">{String(err.message)}</p>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-3 text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
