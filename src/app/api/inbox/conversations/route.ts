import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebaseAdmin';

export async function GET(_req: NextRequest) {
  try {
    const snapshot = await firestore
      .collection('conversations')
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get();

    const conversations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        contactId: data.contactId,
        whatsappNumber: data.whatsappNumber,
        name: data.contactName || null,
        lastMessageText: data.lastMessageText || '',
        lastMessageAt: data.lastMessageAt?.toDate().toISOString() || null,
        lastDirection: data.lastDirection || null,
        unreadCount: data.unreadCount || 0,
      };
    });

    return new Response(JSON.stringify({ conversations }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
