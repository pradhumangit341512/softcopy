import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// Payload type
interface AuthPayload {
  userId: string;
  companyId: string;
  role: string;
  email: string;
}

// ================= REQUIRE AUTH =================
export async function requireAuth(req: NextRequest) {
  try {
    // 1️⃣ Get token from cookie
    const token = req.cookies.get("auth_token")?.value;

    if (!token) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Unauthorized - No token" },
          { status: 401 }
        ),
        payload: null,
      };
    }

    // 2️⃣ Verify JWT
    let payload: AuthPayload | null = null;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    } catch (error) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 }
        ),
        payload: null,
      };
    }

    // 3️⃣ Return authorized payload
    return {
      authorized: true,
      response: null,
      payload,
    };
  } catch (error) {
    console.error("Auth middleware error:", error);

    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 }
      ),
      payload: null,
    };
  }
}
