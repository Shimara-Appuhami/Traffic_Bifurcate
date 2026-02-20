import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/mongodb";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

// Email transporter configuration
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Send reset email
const sendResetEmail = async (email: string, resetUrl: string) => {
  const transporter = getTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_FROM || "noreply@yourdomain.com",
    to: email,
    subject: "Password Reset Request",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset</h2>
        <p>You requested a password reset for your account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link in your browser:<br/>
          ${resetUrl}
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();

    console.log(`[Password Reset] Looking up user: ${normalizedEmail}`);

    // Check if user exists
    const user = await getUserByEmail(normalizedEmail);

    console.log(`[Password Reset] User found:`, user ? "YES" : "NO");

    if (!user) {
      // User not found - but still return success to prevent email enumeration
      console.log(`[Password Reset] No user found with email: ${normalizedEmail}`);
      return NextResponse.json({
        message: "No account found with this email address. Please sign up first.",
        userFound: false,
      });
    }

    // User exists - generate reset token
    const token = randomBytes(32).toString("hex");
    await createPasswordResetToken(normalizedEmail, token);

    // Generate reset URL
    const resetUrl = `${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    
    console.log(`[Password Reset] Reset URL: ${resetUrl}`);

    // Try to send email
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await sendResetEmail(normalizedEmail, resetUrl);
        console.log(`[Password Reset] Email sent to: ${normalizedEmail}`);
      } catch (emailError) {
        console.error("[Password Reset] Failed to send email:", emailError);
        return NextResponse.json({
          message: "Failed to send email. Please try again later.",
          userFound: true,
        }, { status: 500 });
      }
    } else {
      console.log("[Password Reset] SMTP not configured - email not sent");
      return NextResponse.json({
        message: "Email service not configured. Please contact support.",
        userFound: true,
      }, { status: 503 });
    }

    return NextResponse.json({
      message: "Password reset link sent to your email! Check your inbox to reset your password.",
      userFound: true,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
