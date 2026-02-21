import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

/* ================= TYPES ================= */

export interface AuthPayload {
  userId: string;
  companyId: string;
  role: string;
  email: string;
}

export interface AuthResult {
  authorized: boolean;
  response: NextResponse;
  payload: AuthPayload | null;
}

/* ================= REQUIRE AUTH ================= */

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
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
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as AuthPayload;

      return {
        authorized: true,
        response: NextResponse.next(), // always valid response
        payload,
      };
    } catch {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 }
        ),
        payload: null,
      };
    }
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