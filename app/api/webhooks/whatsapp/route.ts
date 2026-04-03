// app/api/webhooks/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import twilio from 'twilio';

function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

async function sendWhatsAppMessage(phone: string, message: string) {
  const client = getTwilioClient();
  return client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155552671',
    to: `whatsapp:${phone}`,
    body: message,
  });
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require CRON_SECRET to prevent unauthorized trigger
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Get clients with visits tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate()
    );
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const clientsForTomorrow = await db.client.findMany({
      where: {
        visitingDate: {
          gte: tomorrowStart,
          lt: tomorrowEnd,
        },
        status: 'Interested',
      },
    });

    // Send WhatsApp messages
    for (const client of clientsForTomorrow) {
      try {
        await sendWhatsAppMessage(
          client.phone,
          `Reminder: You have a property visit scheduled tomorrow at ${client.visitingTime}. Please confirm your availability.`
        );
      } catch (error) {
        console.error(`Failed to send message to ${client.phone}:`, error);
      }
    }

    // Get clients with follow-up date today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const clientsForFollowUp = await db.client.findMany({
      where: {
        followUpDate: {
          gte: todayStart,
          lt: todayEnd,
        },
        status: 'Interested',
      },
    });

    for (const client of clientsForFollowUp) {
      try {
        await sendWhatsAppMessage(
          client.phone,
          `Follow-up: We wanted to check if you're still interested in the property. Please let us know!`
        );
      } catch (error) {
        console.error(`Failed to send follow-up to ${client.phone}:`, error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}