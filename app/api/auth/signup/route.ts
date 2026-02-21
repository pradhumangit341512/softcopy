import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // ✅ FIXED
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, password, companyName } = body;

    // Validation
    if (!name || !email || !phone || !password || !companyName) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check existing user
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create subscription expiry
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30);

    // Create company
    const company = await db.company.create({
      data: {
        companyName,
        subscriptionType: "Basic",
        subscriptionExpiry,
        status: "active",
      },
    });

    // Create admin user
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        role: "admin",
        companyId: company.id,
        status: "active",
      },
    });

    // JWT secret check
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Generate token
    const token = jwt.sign(
      {
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Response
    const response = NextResponse.json(
      {
        message: "Account created successfully",
        user,
      },
      { status: 201 }
    );

    // Set cookie
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}