import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUserByEmail } from "@/lib/mongodb";
import { scryptSync } from "crypto";

// Helper function to verify password
function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(":");
  const inputHash = scryptSync(password, salt, 32).toString("hex");
  return hash === inputHash;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Look up user in database (convert to lowercase to match registration)
        const user = await getUserByEmail((credentials.email as string).toLowerCase());
        
        if (!user) {
          return null;
        }

        // Verify password
        const isValid = verifyPassword(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        // Return user object
        return {
          id: user._id?.toString(),
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
