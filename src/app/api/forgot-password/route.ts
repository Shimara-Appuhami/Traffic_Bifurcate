import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/mongodb";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

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
      // User not found
      console.log(`[Password Reset] No user found with email: ${normalizedEmail}`);
      return NextResponse.json({
        message: "No account found with this email address.",
        userFound: false,
      });
    }

    // User exists - generate reset token
    const token = randomBytes(32).toString("hex");
    await createPasswordResetToken(normalizedEmail, token);

    // Generate reset URL
    const resetUrl = `${process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    
    // TODO: Integrate with email service (Resend, SendGrid, Nodemailer)
    // Example with Nodemailer:
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({
    //   from: 'noreply@yourdomain.com',
    //   to: normalizedEmail,
    //   subject: 'Password Reset',
    //   html: `<a href="${resetUrl}">Reset your password</a>`
    // });
    
    console.log(`[Password Reset] Sending email to: ${normalizedEmail}`);
    console.log(`[Password Reset] Reset URL: ${resetUrl}`);

    return NextResponse.json({
      message: "Password reset link sent to your email!",
      userFound: true,
      // Show resetUrl for testing (remove in production with real email)
      resetUrl,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
