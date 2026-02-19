import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/mongodb";
import { randomBytes, scryptSync } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password using Node.js built-in crypto (scrypt)
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 32).toString("hex");
    const hashedPassword = `${salt}:${hash}`;

    // Create user
    await createUser({
      email: normalizedEmail,
      name,
      password: hashedPassword,
    });

    return NextResponse.json(
      { message: "User created successfully" },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error: " + errorMessage },
      { status: 500 }
    );
  }
}
