import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type AuthTokenPayload } from "./auth";

/* ================= TYPES ================= */

export type AuthPayload = AuthTokenPayload;

export interface AuthResult {
  authorized: boolean;
  response: NextResponse;
  payload: AuthPayload | null;
}

/* ================= REQUIRE AUTH ================= */

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  try {
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

    const payload = await verifyToken(token);
    if (!payload) {
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 }
        ),
        payload: null,
      };
    }

    return {
      authorized: true,
      response: NextResponse.next(),
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