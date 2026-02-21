import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // delete expired OTPs
  await db.oTP.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return NextResponse.json({
    success: true,
    message: "Expired OTPs deleted",
  });
}