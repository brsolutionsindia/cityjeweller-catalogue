import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (!conversationId) {
    return new Response(
      JSON.stringify({ error: 'Missing conversationId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const convRef = firestore.collection('conversations').doc(conversationId);

    const msgsSnap = await convRef
      .collection('messages')
      .orderBy('timestampWa', 'asc')
      .limit(200)
      .get();

    const messages = msgsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        conversationId: conversationId,
        direction: data.direction,
        textBody: data.textBody || '',
        timestamp: (data.timestampWa || data.createdAt).toDate().toISOString(),
      };
    });

    // Reset unread count when viewing
    await convRef.update({ unreadCount: 0 });

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error fetching messages:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
