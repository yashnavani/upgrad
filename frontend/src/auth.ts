import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

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
    Credentials({
      name: "Master Foundation",
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
    jwt({ token, user }) {
      if (user) {
        if ("accessToken" in user && user.accessToken) {
          token.accessToken = user.accessToken as string;
        }
        if (user.email) {
          token.email = user.email;
        }
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
