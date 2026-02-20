import { NextRequest, NextResponse } from "next/server";
import {
  getPasswordResetToken,
  deletePasswordResetToken,
  updateUserPassword,
} from "@/lib/mongodb";
import { randomBytes, scryptSync } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate the reset token
    const resetToken = await getPasswordResetToken(token);
    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token. Please request a new password reset." },
        { status: 400 }
      );
    }

    // Hash the new password
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 32).toString("hex");
    const hashedPassword = `${salt}:${hash}`;

    // Update the user's password
    const updated = await updateUserPassword(resetToken.email, hashedPassword);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update password. User not found." },
        { status: 400 }
      );
    }

    // Delete the used token
    await deletePasswordResetToken(token);

    return NextResponse.json({
      message: "Password has been reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
