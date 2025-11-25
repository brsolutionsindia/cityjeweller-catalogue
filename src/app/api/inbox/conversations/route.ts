import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebaseAdmin';

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'mohit-wa-webhook-123';

// Simple interfaces for the parts we actually use
interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  type: 'text' | 'button' | string;
  text?: { body?: string };
  button?: { text?: string };
  timestamp: string; // epoch seconds as string
}

interface WhatsAppWebhookValue {
  metadata?: { display_phone_number?: string };
}

// GET = verification (unchanged)
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  console.log('📩 NEW WEBHOOK EVENT:', JSON.stringify(body, null, 2));

  try {
    if (body?.object === 'whatsapp_business_account') {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value as WhatsAppWebhookValue;

          if ((value as any).messages) {
            for (const msg of (value as any).messages as WhatsAppWebhookMessage[]) {
              await handleIncomingMessage(msg, value);
            }
          }

          // TODO: handle value.statuses if you want delivery/read updates
        }
      }
    }
  } catch (err) {
    console.error('Error handling webhook:', err);
  }

  return new Response('OK', { status: 200 });
}

async function handleIncomingMessage(
  msg: WhatsAppWebhookMessage,
  value: WhatsAppWebhookValue,
) {
  const fromNumber = msg.from;
  const toNumber = value.metadata?.display_phone_number || '';
  const waMessageId = msg.id;
  const type = msg.type;

  const textBody =
    type === 'text'
      ? msg.text?.body ?? ''
      : type === 'button'
      ? msg.button?.text ?? ''
      : '';

  const timestampWa = new Date(parseInt(msg.timestamp, 10) * 1000);
  const now = new Date();

  const contactId = fromNumber;
  const contactRef = firestore.collection('contacts').doc(contactId);
  const contactSnap = await contactRef.get();

  if (!contactSnap.exists) {
    await contactRef.set({
      whatsappNumber: fromNumber,
      name: null,
      source: 'whatsapp_incoming',
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await contactRef.update({ updatedAt: now });
  }

  const convId = contactId;
  const convRef = firestore.collection('conversations').doc(convId);
  const convSnap = await convRef.get();

  if (!convSnap.exists) {
    await convRef.set({
      contactId,
      whatsappNumber: fromNumber,
      contactName: contactSnap.exists
        ? (contactSnap.data()?.name as string | null) ?? null
        : null,
      lastMessageText: textBody,
      lastMessageAt: timestampWa,
      lastDirection: 'in',
      unreadCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const prevUnread = (convSnap.data()?.unreadCount as number | undefined) ?? 0;
    await convRef.update({
      lastMessageText: textBody,
      lastMessageAt: timestampWa,
      lastDirection: 'in',
      unreadCount: prevUnread + 1,
      updatedAt: now,
    });
  }

  const msgRef = convRef.collection('messages').doc(waMessageId);
  await msgRef.set({
    whatsappId: waMessageId,
    fromNumber,
    toNumber,
    direction: 'in',
    type,
    textBody,
    status: 'received',
    timestampWa,
    createdAt: now,
    rawPayload: msg,
  });
}
