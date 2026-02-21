import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(req: NextRequest) {
  // Verify cron secret
  if (
    req.headers.get('Authorization') !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Tomorrow's visits
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate()
    );
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const upcomingVisits = await db.client.findMany({
      where: {
        visitingDate: {
          gte: tomorrowStart,
          lt: tomorrowEnd,
        },
        status: { not: 'Rejected' },
      },
    });

    // Send WhatsApp messages
    for (const client of upcomingVisits) {
      try {
        await twilioClient.messages.create({
          from: process.env.TWILIO_WHATSAPP_NUMBER,
          to: `whatsapp:${client.phone}`,
          body: `Hi ${client.clientName}, This is a reminder about your property visit scheduled for tomorrow at ${client.visitingTime}. Please confirm if you can make it. Thank you!`,
        });

        // Log message
        console.log(`WhatsApp sent to ${client.phone}`);
      } catch (error) {
        console.error(`Failed to send WhatsApp to ${client.phone}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      messagesSent: upcomingVisits.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Cron job failed', details: String(error) },
      { status: 500 }
    );
  }
}