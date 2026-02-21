import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-middleware";
import { db } from "@/lib/db";
import path from "path";
import fs from "fs/promises";

export async function POST(req: NextRequest) {
  try {
    const { authorized, response, payload } = await requireAuth(req);
    if (!authorized || !payload) return response;

    const formData = await req.formData();
    const file = formData.get("photo") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // convert file → buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // create filename
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(process.cwd(), "public/uploads", fileName);

    // save file
    await fs.writeFile(filePath, buffer);

    const imageUrl = `/uploads/${fileName}`;

    // update user profile photo
    await db.user.update({
      where: { id: payload.userId },
      data: { profilePhoto: imageUrl }, // ✅ fixed field
    });

    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}