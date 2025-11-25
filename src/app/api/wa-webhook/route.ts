import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebaseAdmin';

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'mohit-wa-webhook-123';

// GET stays same as earlier (verification)
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
          const value = change.value;

          // Incoming messages from users
          if (value?.messages) {
            for (const msg of value.messages) {
              await handleIncomingMessage(msg, value);
            }
          }

          // TODO: handle value.statuses for delivery reports if needed
        }
      }
    }
  } catch (err) {
    console.error('Error handling webhook:', err);
  }

  return new Response('OK', { status: 200 });
}

async function handleIncomingMessage(msg: any, value: any) {
  const fromNumber = msg.from; // user
  const toNumber = value?.metadata?.display_phone_number || ''; // your number (if available)
  const waMessageId = msg.id;
  const type = msg.type;

  const textBody =
    type === 'text' ? msg.text?.body :
    type === 'button' ? msg.button?.text :
    '';

  const timestampWa = new Date(parseInt(msg.timestamp, 10) * 1000);

  const now = new Date();

  // 1) Upsert contact
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

  // 2) Conversation doc (1:1 with contact)
  const convId = contactId;
  const convRef = firestore.collection('conversations').doc(convId);
  const convSnap = await convRef.get();

  if (!convSnap.exists) {
    await convRef.set({
      contactId,
      whatsappNumber: fromNumber,
      contactName: contactSnap.exists
        ? contactSnap.data()?.name || null
        : null,
      lastMessageText: textBody,
      lastMessageAt: timestampWa,
      lastDirection: 'in',
      unreadCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const prevUnread = convSnap.data()?.unreadCount || 0;
    await convRef.update({
      lastMessageText: textBody,
      lastMessageAt: timestampWa,
      lastDirection: 'in',
      unreadCount: prevUnread + 1,
      updatedAt: now,
    });
  }

  // 3) Add message subdocument
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
