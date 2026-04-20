import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const OWNER_EMAIL = (process.env.AUTH_OWNER_EMAIL ?? "").toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ profile }) {
      return Boolean(profile?.email_verified);
    },
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email;
      const email = typeof token.email === "string" ? token.email.toLowerCase() : "";
      token.role = OWNER_EMAIL && email === OWNER_EMAIL ? "owner" : "viewer";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string | undefined) ?? session.user.email;
      }
      (session as { role?: string }).role = (token.role as string) ?? "viewer";
      return session;
    },
  },
});
