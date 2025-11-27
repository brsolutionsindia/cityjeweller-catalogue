import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebaseAdmin';

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'mohit-wa-webhook-123';

// --- Types for WhatsApp webhook payload ---

interface WhatsAppMessage {
  from: string;
  id: string;
  type: string; // "text", "button", etc.
  text?: { body?: string };
  button?: { text?: string };
  timestamp: string; // epoch seconds as string
}

// ✅ NEW: contact + profile name
interface WhatsAppContact {
  wa_id: string;
  profile?: {
    name?: string;
  };
}

interface WhatsAppChangeValue {
  metadata?: { display_phone_number?: string };
  messages?: WhatsAppMessage[];
  // ✅ NEW: contacts array from WA payload
  contacts?: WhatsAppContact[];
  // statuses?: ... // you can extend later if needed
}

interface WhatsAppChange {
  value: WhatsAppChangeValue;
}

interface WhatsAppEntry {
  changes?: WhatsAppChange[];
}

interface WhatsAppWebhookBody {
  object?: string;
  entry?: WhatsAppEntry[];
}

// --- GET = verification (unchanged logic) ---

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

// --- POST = incoming messages / status updates ---

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as WhatsAppWebhookBody | null;
  console.log('📩 NEW WEBHOOK EVENT:', JSON.stringify(body, null, 2));

  try {
    if (body?.object === 'whatsapp_business_account') {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value;

          // Incoming messages from users
          if (value.messages && Array.isArray(value.messages)) {
            for (const msg of value.messages) {
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

// --- Helper: store 1 incoming message in Firestore ---

async function handleIncomingMessage(
  msg: WhatsAppMessage,
  value: WhatsAppChangeValue,
) {
  const fromNumber = msg.from; // user
  const toNumber = value.metadata?.display_phone_number || ''; // your WA number (if present)
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

  // ✅ 1) Extract contact name from payload, if present
  let profileName: string | null = null;
  if (value.contacts && Array.isArray(value.contacts) && value.contacts.length > 0) {
    const matchedContact =
      value.contacts.find((c) => c.wa_id === fromNumber) ?? value.contacts[0];
    profileName = matchedContact?.profile?.name ?? null;
  }

  // 2) Upsert contact
  const contactId = fromNumber;
  const contactRef = firestore.collection('contacts').doc(contactId);
  const contactSnap = await contactRef.get();

  if (!contactSnap.exists) {
    // ✅ use profileName when creating contact
    await contactRef.set({
      whatsappNumber: fromNumber,
      name: profileName ?? null,
      source: 'whatsapp_incoming',
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const existingName = (contactSnap.data()?.name as string | null) ?? null;

    const contactUpdate: Record<string, unknown> = {
      updatedAt: now,
    };

    // ✅ if we didn't have a name earlier but now we do, update it
    if (!existingName && profileName) {
      contactUpdate.name = profileName;
    }

    await contactRef.update(contactUpdate);
  }

  const latestContactSnap = await contactRef.get();
  const finalContactName =
    (latestContactSnap.data()?.name as string | null) ?? profileName ?? null;

  // 3) Conversation doc (1:1 with contact for now)
  const convId = contactId;
  const convRef = firestore.collection('conversations').doc(convId);
  const convSnap = await convRef.get();

  if (!convSnap.exists) {
    await convRef.set({
      contactId,
      whatsappNumber: fromNumber,
      contactName: finalContactName, // ✅ store name here
      lastMessageText: textBody,
      lastMessageAt: timestampWa,
      lastDirection: 'in',
      unreadCount: 1,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const prevUnread = (convSnap.data()?.unreadCount as number | undefined) ?? 0;

    const convUpdate: Record<string, unknown> = {
      lastMessageText: textBody,
      lastMessageAt: timestampWa,
      lastDirection: 'in',
      unreadCount: prevUnread + 1,
      updatedAt: now,
    };

    // ✅ keep conversation name in sync if we just learned it
    if (finalContactName) {
      convUpdate.contactName = finalContactName;
    }

    await convRef.update(convUpdate);
  }

  // 4) Add message subdocument
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
