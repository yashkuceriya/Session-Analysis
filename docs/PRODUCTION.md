# Nerdy: Production Deployment Guide

This guide covers everything needed to deploy Nerdy to production.

## Prerequisites

- **Node.js 18+** (check with `node --version`)
- **Supabase account** (https://supabase.com)
- **Anthropic API key** (https://console.anthropic.com)
- **Vercel account** or any Node.js hosting (AWS, Railway, Render, DigitalOcean, etc.)
- **Docker** (optional, for containerized deployment)

## Supabase Setup

### 1. Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Fill in project details:
   - Organization: your organization or create one
   - Name: `nerdy` (or your choice)
   - Database Password: generate a strong password
   - Region: closest to your users
4. Click "Create new project" and wait for setup (2-3 minutes)

### 2. Run the Database Schema

1. Once your project is ready, go to the **SQL Editor** tab
2. Click "New Query"
3. Copy the entire contents of `docs/supabase-schema.sql`
4. Paste it into the query editor
5. Click "Run" (Ctrl+Enter)
6. Verify all tables are created (check "Database" → "Tables" in the sidebar)

### 3. Enable Realtime

1. Go to **Realtime** in the sidebar
2. Click on the `signal_messages` table
3. Toggle **Realtime** to ON

### 4. Get Your Credentials

In Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

## TURN Server Setup

### Why TURN?

WebRTC works peer-to-peer, but when both users are behind NAT (corporate networks, mobile carriers), direct connection fails. TURN servers relay media when needed.

**Without TURN:** Video fails on corporate networks or some mobile carriers.
**With TURN:** Video works everywhere, but relayed sessions use more bandwidth.

### Free Option: Metered.ca (Default)

The app includes free TURN credentials by default (500MB/month, ~15 hours of video relayed).

For small deployments, this is sufficient. If you hit the limit, videos will fall back to direct P2P (may fail on restrictive networks).

### Production Option: Paid TURN

If you expect heavy usage on restrictive networks:

**Metered.ca** (recommended)
- $10/month for 50GB
- https://www.metered.ca
- Easy to set up

**Twilio** (enterprise)
- Pay-as-you-go
- https://www.twilio.com/webrtc/turn

**Xirsys**
- $5/month for 25GB
- https://xirsys.com

### Setting TURN Environment Variables

Once you have TURN credentials, add to `.env.production.local`:

```env
NEXT_PUBLIC_TURN_URL=turn:your-turn-server.com:80
NEXT_PUBLIC_TURN_USERNAME=your-username
NEXT_PUBLIC_TURN_CREDENTIAL=your-credential
NEXT_PUBLIC_TURNS_URL=turn:your-turn-server.com:443
NEXT_PUBLIC_TURNS_TLS_URL=turns:your-turn-server.com:443?transport=tcp
```

## Environment Variables

Create a `.env.production.local` file with these values:

```env
# Required
AUTH_SECRET=<generate: openssl rand -base64 32>
ROOM_TOKEN_SECRET=<generate: openssl rand -base64 32>
NEXTAUTH_URL=https://your-domain.com
ANTHROPIC_API_KEY=<from https://console.anthropic.com>

# Database (from Supabase setup above)
NEXT_PUBLIC_SUPABASE_URL=<your project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Optional: TURN servers (only if using paid tier)
# NEXT_PUBLIC_TURN_URL=...
# NEXT_PUBLIC_TURN_USERNAME=...
# NEXT_PUBLIC_TURN_CREDENTIAL=...
# NEXT_PUBLIC_TURNS_URL=...
# NEXT_PUBLIC_TURNS_TLS_URL=...
```

### Generate Secrets

```bash
openssl rand -base64 32  # Run twice, use once for AUTH_SECRET, once for ROOM_TOKEN_SECRET
```

## Deploy to Vercel

### Quick Deploy

```bash
npm run build
vercel deploy --prod
```

### Configure Environment Variables in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add all variables from `.env.production.local`
5. Make sure they're set for **Production**
6. Redeploy: `vercel deploy --prod`

### Custom Domain

1. In Vercel dashboard, go to **Domains**
2. Add your custom domain
3. Update `NEXTAUTH_URL` in environment variables to match
4. Trigger a redeploy

## Deploy with Docker

### Basic Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app
COPY .next ./.next
COPY public ./public

# Expose port
EXPOSE 3000

# Start app
CMD ["node", ".next/standalone/server.js"]
```

### Build Docker Image

```bash
npm run build
docker build -t nerdy:latest .
```

### Run with docker-compose

```yaml
version: '3.8'

services:
  nerdy:
    image: nerdy:latest
    ports:
      - "3000:3000"
    environment:
      AUTH_SECRET: ${AUTH_SECRET}
      ROOM_TOKEN_SECRET: ${ROOM_TOKEN_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
```

Run:

```bash
docker-compose up -d
```

## Architecture Notes

### Signaling (Connecting Users)

**Development:** In-memory signaling (single server only)
**Production:** Supabase table polling for stateless scaling

When a user joins a room, the app polls `signal_messages` table every 500ms. This is slower than WebSockets but works with any hosting provider.

### Session Data

**Development:** File-based (`.data/sessions.json`)
**Production:** Supabase database

All session data, transcripts, and analysis results are stored in Supabase. Sessions persist across app restarts.

### AI Analysis

All AI analysis goes through **Anthropic Claude API**.

- Requires valid `ANTHROPIC_API_KEY`
- API requests are made from the server (Next.js API routes)
- Uses Claude 3.5 Sonnet for real-time analysis
- Costs ~$0.001-0.01 per analysis depending on session length

### Video/Audio

- **Peer-to-peer** with WebRTC (no server relays video)
- **TURN servers** relay media when P2P fails (NAT/firewall)
- **Audio routing:** Browser's audio element + Web Audio API for analysis
- **Auto-play policy:** User must interact with page before audio plays

### Authentication

**Default:** NextAuth with email/password credentials
**Optional:** Google OAuth, GitHub OAuth (configure via environment variables)

## Troubleshooting

### Video Not Connecting

1. Check browser console (F12) for errors
2. Verify TURN servers are reachable: https://test.webrtc.org
3. Check signaling: In browser console, run:
   ```javascript
   await fetch('/api/signaling/messages?roomId=test').then(r => r.json())
   ```
4. Verify `NEXT_PUBLIC_SUPABASE_URL` and anon key are correct

**Solution:** Ensure TURN credentials are valid, or upgrade to paid tier.

### AI Analysis Failing

1. Check `ANTHROPIC_API_KEY` is set and valid
2. Check API key has sufficient credits at https://console.anthropic.com
3. Check server logs for API errors

**Solution:** Verify key is active and has remaining balance.

### Session Data Lost

1. Verify Supabase is connected: check `NEXT_PUBLIC_SUPABASE_URL`
2. Check database: go to Supabase dashboard → "Tables"
3. Verify Row Level Security (RLS) policies don't block inserts

**Solution:** Re-run `docs/supabase-schema.sql` and `docs/supabase-rls-fix.sql` to reset policies.

### Audio Not Working

1. Check browser's autoplay policy: user must interact (click) before audio starts
2. Check microphone permissions: browser should prompt on first use
3. Verify WebRTC is connected (video working but audio muted?)

**Solution:** Click anywhere on page to enable audio context, check browser volume isn't muted.

## Monitoring

### Logs

- **Vercel:** Dashboard → "Functions" and "Deployments" tabs
- **Self-hosted:** Check stdout/stderr from your hosting provider

### Metrics to Watch

- **API response time:** Should be <200ms for signaling
- **Supabase database load:** Monitor via Supabase dashboard
- **TURN bandwidth:** If using paid tier, monitor monthly usage
- **Anthropic API costs:** Check at https://console.anthropic.com/account/usage

## Next Steps

1. **Test locally first:** `npm run dev`, sign up, create a room, test video/audio
2. **Set up custom domain:** Update DNS records
3. **Enable OAuth** (optional): Add Google/GitHub credentials for social login
4. **Set up monitoring:** Configure error tracking (Sentry, LogRocket, etc.)
5. **Plan scaling:** If >100 concurrent users, consider dedicated TURN infrastructure
