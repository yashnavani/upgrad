import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

function apiBase(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api/v1"
  ).replace(/\/$/, "");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Credentials({
      name: "Luminous SaaS",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const loginUrl = `${apiBase()}/auth/login`;
        const res = await fetch(loginUrl, {
          method: "POST",
          body: new URLSearchParams({
            username: email,
            password,
          }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(15_000),
        });

        const data = (await res.json().catch(() => ({}))) as {
          access_token?: string;
          detail?: string;
        };

        if (!res.ok || !data.access_token) {
          return null;
        }

        return {
          id: email,
          email,
          accessToken: data.access_token,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth, create/sync user with backend
      if (account?.provider === "google" && user.email) {
        try {
          const registerUrl = `${apiBase()}/auth/register`;
          const res = await fetch(registerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              full_name: user.name || user.email,
              password: crypto.randomUUID(), // Random password for OAuth users
            }),
          });

          // 200 = created, 400 with "already exists" = OK
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (res.status !== 400 || !data.detail?.includes("already exists")) {
              console.error("Failed to sync Google user with backend:", data);
            }
          }
        } catch (error) {
          console.error("Error syncing Google user:", error);
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // For Google OAuth, get backend JWT token
      if (account?.provider === "google" && user.email) {
        try {
          // Generate a backend JWT for this Google user
          const loginUrl = `${apiBase()}/auth/google-token`;
          const res = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              google_id: user.id,
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as { access_token?: string };
            if (data.access_token) {
              token.accessToken = data.access_token;
            }
          }
        } catch (error) {
          console.error("Error getting backend token for Google user:", error);
        }
      }

      // For credentials login
      if (user && "accessToken" in user && user.accessToken) {
        token.accessToken = user.accessToken as string;
      }

      if (user?.email) {
        token.email = user.email;
      }

      return token;
    },
    session({ session, token }) {
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
