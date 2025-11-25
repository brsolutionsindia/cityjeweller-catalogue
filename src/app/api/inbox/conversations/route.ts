import { firestore } from '@/lib/firebaseAdmin';
import type { DocumentData } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const snapshot = await firestore
      .collection('conversations')
      .orderBy('lastMessageAt', 'desc')
      .limit(50)
      .get();

    const conversations = snapshot.docs.map((doc) => {
      const data = doc.data() as DocumentData;

      return {
        id: doc.id,
        contactId: data.contactId as string | undefined,
        whatsappNumber: data.whatsappNumber as string,
        name: (data.contactName as string | null) ?? null,
        lastMessageText: (data.lastMessageText as string | undefined) || '',
        lastMessageAt: data.lastMessageAt
          ? data.lastMessageAt.toDate().toISOString()
          : null,
        lastDirection: (data.lastDirection as 'in' | 'out' | undefined) ?? null,
        unreadCount: (data.unreadCount as number | undefined) ?? 0,
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
