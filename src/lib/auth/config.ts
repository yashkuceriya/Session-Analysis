import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const { getUser } = await import('./user-store.server');
        const user = getUser(credentials.email as string);

        if (!user) {
          throw new Error('No user found with this email');
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, create/update user in database
      if (account?.provider === 'google' || account?.provider === 'github') {
        const { hasUser, addUser } = await import('./user-store.server');
        const email = user.email;
        if (email && !hasUser(email)) {
          addUser({
            id: user.id || randomUUID(),
            email,
            name: user.name || 'User',
            password: '', // OAuth users don't have passwords
            role: 'student', // Default role for OAuth users
            image: user.image,
            createdAt: new Date().toISOString(),
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // Add custom claims to JWT
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        // Get role from database if user exists
        if (user.email) {
          const { getUser } = await import('./user-store.server');
          const dbUser = getUser(user.email);
          token.role = dbUser?.role || 'student';
        } else {
          token.role = 'student';
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Pass custom claims to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
        (session.user as any).role = token.role as 'tutor' | 'student' | 'admin';
      }
      return session;
    },
  },
});

// Export functions from user-store for use in API routes
export async function getUser(email: string) {
  const { getUser } = await import('./user-store.server');
  return getUser(email);
}

export async function hasUser(email: string) {
  const { hasUser } = await import('./user-store.server');
  return hasUser(email);
}

export async function addUser(user: any) {
  const { addUser } = await import('./user-store.server');
  return addUser(user);
}
