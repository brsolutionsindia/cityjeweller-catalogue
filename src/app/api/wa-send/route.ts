import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebaseAdmin';

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID!;
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN!;
const YOUR_WA_NUMBER = process.env.YOUR_WA_NUMBER || ''; // optional

export async function POST(req: NextRequest) {
  try {
    const { to, text, conversationId } = await req.json();

    if (!to || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing "to" or "text"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1) Send to WhatsApp Cloud API
    const waRes = await fetch(
      `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    const waJson = await waRes.json();

    if (!waRes.ok) {
      console.error('WhatsApp API error:', waJson);
      return new Response(
        JSON.stringify({ error: 'Failed to send message', details: waJson }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const waMessageId = waJson.messages?.[0]?.id || null;
    const now = new Date();

    // 2) Firestore writes
    const convId = conversationId || to; // fallback: use 'to' as convId
    const convRef = firestore.collection('conversations').doc(convId);
    const convSnap = await convRef.get();

    if (!convSnap.exists) {
      await convRef.set({
        contactId: to,
        whatsappNumber: to,
        contactName: null,
        lastMessageText: text,
        lastMessageAt: now,
        lastDirection: 'out',
        unreadCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await convRef.update({
        lastMessageText: text,
        lastMessageAt: now,
        lastDirection: 'out',
        updatedAt: now,
      });
    }

    const msgRef = convRef
      .collection('messages')
      .doc(waMessageId || undefined); // let Firestore auto-id if null

    await msgRef.set({
      whatsappId: waMessageId,
      fromNumber: YOUR_WA_NUMBER || '', // your number if you want
      toNumber: to,
      direction: 'out',
      type: 'text',
      textBody: text,
      status: 'sent',
      timestampWa: now,
      createdAt: now,
      rawPayload: waJson,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: waMessageId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in /api/wa-send:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
