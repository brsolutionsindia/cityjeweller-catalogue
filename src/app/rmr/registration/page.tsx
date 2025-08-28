'use client'

import { useEffect, useState } from 'react'
import { useForm, FormProvider, useFormContext } from 'react-hook-form'
import type { FieldErrors, FieldError as RHFFieldError } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'

// -----------------------------------------------
// Config (put images in /public/images)
// -----------------------------------------------
const PAYMENT = {
  upiId: 'baderarenu19@okicici',            // ← update to your UPI ID if needed
  qrPath: '/images/upi-qr.png',             // ← ensure this exists
}
const ADVANCE_AMOUNT = 1100

// -----------------------------------------------
// Schema & Types
// -----------------------------------------------
const phoneRegexIN = /^(?:\+?91[-\s]?)?[6-9]\d{9}$/

// ---- Schema: coerce to number ----
const FormSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  whatsapp: z.string().regex(phoneRegexIN, 'Enter a valid WhatsApp number (India)'),
  slot: z.string().min(1, 'Please pick a time slot'),
  // ⬇️ coerce + int
  durationMinutes: z.coerce.number().int().min(30, 'Minimum 30 minutes').max(240, 'Max 4 hours'),
  notes: z.string().max(500).optional(),
  consent: z.boolean().refine(v => v === true, { message: 'You must accept the terms to proceed' }),
})


export type RegisterForm = z.infer<typeof FormSchema>

// -----------------------------------------------
// Helpers & constants
// -----------------------------------------------
const STEPS = ['Your Details', 'Pick Slot & Duration', 'Review & Submit'] as const

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

function hourOf(slot?: string) {
  if (!slot) return undefined
  const hour = Number(slot.slice(0, 2))
  return Number.isFinite(hour) ? hour : undefined
}

function slotBandLabel(slot?: string) {
  const h = hourOf(slot)
  if (h === undefined) return '—'
  if (h >= 17) return 'Premium Hours (post 5 PM): premium charges apply'
  if (h >= 9 && h < 11) return 'Happy Hours (9–11 AM): special offers apply'
  return 'Standard Hours'
}

function slotBandShort(slot?: string) {
  const h = hourOf(slot)
  if (h === undefined) return '—'
  if (h >= 17) return 'Premium Hours'
  if (h >= 9 && h < 11) return 'Happy Hours'
  return 'Standard Hours'
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
      slot: '',
      durationMinutes: 30,
      notes: '',
      consent: false,
    },
    mode: 'onChange',
  })

  useLocalDraft('royal-mehendi-register-draft', methods)

  const values = methods.watch()
  const progress = Math.round(((step + 1) / STEPS.length) * 100)

  const nextFields: Record<number, (keyof RegisterForm)[]> = {
    0: ['fullName', 'whatsapp'],
    1: ['slot', 'durationMinutes'],
    2: ['consent'],
  }

  const goNext = async () => {
    const ok = await methods.trigger(nextFields[step])
    if (ok) setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const goBack = () => setStep(s => Math.max(s - 1, 0))

  const onSubmit = async (data: RegisterForm) => {
    const lines = [
      'Royal Mehendi by Renu — Slot Booking',
      '',
      `Name: ${data.fullName}`,
      `WhatsApp: ${data.whatsapp}`,
      `Preferred Slot: ${data.slot} (${slotBandShort(data.slot)})`,
      `Duration: ${data.durationMinutes} minutes`,
      data.notes ? `Notes: ${data.notes}` : undefined,
      '',
      `Advance to confirm booking: ₹${ADVANCE_AMOUNT.toLocaleString('en-IN')}`,
      `Pay to UPI ID: ${PAYMENT.upiId}`,
      '',
      'I will pay the advance now and share the screenshot for confirmation.',
      'I understand:',
      '- Happy Hours (9–11 AM): special offers are available.',
      '- Post 5 PM: premium charges apply on the final bill.',
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
            <p className="mt-1 text-sm text-gray-500">
              Event: <span className="font-medium">9 October</span> • Venue: <span className="font-medium">Rajasthan Bhawan</span>
            </p>
          </div>
          {/* (Google Form link removed as requested) */}
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
                {step === 1 && <StepSlotsAndDuration />}
                {step === 2 && <StepReview values={values as RegisterForm} />}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
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
          <p>For any queries, WhatsApp: 9023296310</p>
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
        <input
          id="fullName"
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="e.g., Riya Sharma"
          {...methods.register('fullName')}
        />
        <FieldError name="fullName" />
      </div>
      <div className="grid gap-2">
        <label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp Number (India)</label>
        <input
          id="whatsapp"
          inputMode="numeric"
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="10-digit number"
          {...methods.register('whatsapp')}
        />
        <FieldError name="whatsapp" />
      </div>
    </motion.div>
  )
}

function StepSlotsAndDuration() {
  const methods = useFormContext<RegisterForm>()
  const slot = methods.watch('slot')

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <div><b>Happy Hours:</b> 9:00 AM – 11:00 AM (special offers apply)</div>
        <div className="mt-1"><b>Premium Hours:</b> 5:00 PM onwards (premium charges apply)</div>
      </div>

      {/* Make sure slot is registered for validation */}
      <input type="hidden" {...methods.register('slot')} />

      {/* Slots */}
      <div className="grid gap-2">
        <span className="text-sm font-medium">Preferred Time Slot</span>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SLOTS_ALL.map((t) => {
            const active = slot === t
            const h = hourOf(t)
            const isHappy = h !== undefined && h >= 9 && h < 11
            const isPremium = h !== undefined && h >= 17
            return (
              <button
                type="button"
                key={t}
                onClick={() => methods.setValue('slot', t, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
                className={`rounded-xl border p-3 text-sm ${active ? 'border-emerald-500 bg-emerald-50 font-medium' : 'hover:bg-gray-50'}`}
                title={isHappy ? 'Happy Hours' : isPremium ? 'Premium Hours' : 'Standard Hours'}
              >
                {t}
                {(isHappy || isPremium) && (
                  <div className={`mt-1 text-[10px] ${isHappy ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {isHappy ? 'Happy Hours' : 'Premium Hours'}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <FieldError name="slot" />
      </div>

      {/* Duration (REGISTER + valueAsNumber) */}
      <div className="grid gap-2 md:max-w-sm">
        <label htmlFor="duration" className="text-sm font-medium">Duration (in 30-min intervals)</label>
        <select
          id="duration"
          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-emerald-500 focus:outline-none"
          defaultValue={30}
          {...methods.register('durationMinutes', { valueAsNumber: true })}
        >
          {[30, 60, 90, 120, 150, 180, 210, 240].map(min => (
            <option key={min} value={min}>{min} minutes</option>
          ))}
        </select>
        <FieldError name="durationMinutes" />
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <label htmlFor="notes" className="text-sm font-medium">Notes (Design refs, allergies, etc.)</label>
        <textarea
          id="notes"
          rows={4}
          className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="Anything we should know?"
          {...methods.register('notes')}
        />
      </div>

      {/* Advance info */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
        To confirm your booking, please pay an advance of <b>₹{ADVANCE_AMOUNT.toLocaleString('en-IN')}</b> and share the screenshot on WhatsApp. Special offers apply.
      </div>
    </motion.div>
  )
}

function StepReview({ values }: { values: RegisterForm }) {
  const methods = useFormContext<RegisterForm>()
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <ReviewRow label="Name" value={values.fullName} />
      <ReviewRow label="WhatsApp" value={values.whatsapp} />
      <hr className="my-2 border-gray-200" />
      <ReviewRow label="Preferred Slot" value={`${values.slot} (${slotBandShort(values.slot)})`} />
      <ReviewRow label="Duration" value={`${values.durationMinutes} minutes`} />
      {values.notes ? <ReviewRow label="Notes" value={values.notes} /> : null}

      <div className="rounded-xl border bg-gray-50 p-4">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Slot Band</span>
            <span className="font-medium">{slotBandLabel(values.slot)}</span>
          </div>
          <div className="flex items-center justify-between text-base">
            <span className="font-semibold">Advance to Pay Now</span>
            <span className="font-semibold">₹ {ADVANCE_AMOUNT.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="text-sm">
          <div className="mb-2 font-semibold">Pay ₹{ADVANCE_AMOUNT.toLocaleString('en-IN')} to reserve your slot</div>

          <div className="mb-1">
            UPI ID:{' '}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(PAYMENT.upiId)
                alert('UPI ID copied to clipboard!')
              }}
              className="font-medium text-emerald-700 hover:underline"
            >
              {PAYMENT.upiId}
            </button>
          </div>

          <div className="mb-2 text-xs text-gray-500">
            Please pay and share the screenshot on WhatsApp for confirmation.
          </div>
          <img
            src={PAYMENT.qrPath}
            alt="Payment QR"
            className="mx-auto h-60 w-60 rounded-xl border-2 object-contain shadow-md"
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3">
        <input
          id="consent"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300"
          checked={values.consent}
          onChange={(e) => methods.setValue('consent', e.target.checked)}
        />
        <label htmlFor="consent" className="text-sm leading-5 text-gray-600">
          I agree to be contacted on WhatsApp/SMS/Call about my appointment. I accept the event T&Cs and privacy policy.
        </label>
      </div>
      <FieldError name="consent" />

      <p className="text-xs text-gray-500">
        Note: Submitting will open WhatsApp with your details. Please attach the screenshot of the advance payment there.
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
  } = useFormContext<RegisterForm>()

  const err = (errors as FieldErrors<RegisterForm>)[name] as RHFFieldError | undefined
  if (!err?.message) return null

  return <p className="text-xs text-red-600">{String(err.message)}</p>
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-3 text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
