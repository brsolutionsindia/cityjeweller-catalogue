// src/app/api/wa-webhook/route.ts
import { NextRequest } from 'next/server';

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'mohit-wa-webhook-123';

// STEP 1: VERIFY WEBHOOK (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    console.log('✅ WEBHOOK_VERIFIED');
    return new Response(challenge, { status: 200 });
  }

  console.log('❌ WEBHOOK_VERIFICATION_FAILED', { mode, token });
  return new Response('Forbidden', { status: 403 });
}

// STEP 2: RECEIVE MESSAGES / STATUS UPDATES (POST)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  console.log('📩 NEW WEBHOOK EVENT:', JSON.stringify(body, null, 2));

  // ---- Example: extract incoming messages ----
  if (body?.object === 'whatsapp_business_account') {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // Incoming messages from users
        if (value?.messages) {
          for (const msg of value.messages) {
            const from = msg.from; // user's WhatsApp number
            const type = msg.type;
            const text = type === 'text' ? msg.text?.body : '';

            console.log(`💬 Message from ${from}: ${text}`);
            // TODO: Save to DB (Firebase / Mongo / SQL) for your inbox
          }
        }

        // Delivery / read status updates etc. are in value.statuses
      }
    }
  }

  // Important: Always respond quickly
  return new Response('OK', { status: 200 });
}
