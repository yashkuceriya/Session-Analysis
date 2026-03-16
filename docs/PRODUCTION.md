# Nerdy: Production Deployment Guide

Complete instructions for deploying Nerdy to production with Supabase, Vercel, and optional Docker containerization.

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** — Run `node --version` to verify
- **Supabase account** — Sign up at https://supabase.com (free tier available)
- **Anthropic API key** — Get from https://console.anthropic.com (requires subscription)
- **Vercel account** or alternative Node.js hosting
  - Vercel (recommended)
  - AWS (Lambda, EC2, Elastic Beanstalk)
  - Railway
  - Render
  - DigitalOcean App Platform
  - Any VPS with Node.js installed
- **Docker** (optional, for containerized deployment)

## Supabase Setup

Supabase provides a PostgreSQL database with built-in real-time capabilities, perfect for Nerdy's signaling and session storage needs.

### Step 1: Create a Supabase Project

1. Navigate to https://supabase.com and sign in (create account if needed)
2. Click **"New Project"** in the dashboard
3. Configure project settings:
   - **Organization:** Select existing or create new
   - **Name:** `nerdy` (or your preferred name)
   - **Database Password:** Generate a strong password (save this!)
   - **Region:** Choose closest to your users for latency
4. Click **"Create new project"**
5. Wait 2-3 minutes for database provisioning

### Step 2: Initialize Database Schema

1. In Supabase dashboard, navigate to **SQL Editor** tab (left sidebar)
2. Click **"New Query"** button
3. Open `docs/supabase-schema.sql` from your project repository
4. Copy the entire file contents
5. Paste into the query editor
6. Click **"Run"** button (or press Ctrl+Enter)
7. Verify success — you should see "Query completed" message
8. Confirm tables created — Go to **"Database"** → **"Tables"** in sidebar
   - Should see: `sessions`, `metrics`, `nudges`, `signal_messages`, `users`

### Step 3: Enable Realtime Subscriptions

Realtime enables the WebRTC signaling to work efficiently:

1. Go to **Realtime** in the left sidebar
2. Select the **`signal_messages`** table
3. Toggle **"Realtime"** switch to **ON**
4. Confirm status shows as "Enabled"

### Step 4: Obtain API Credentials

1. Go to **Settings** → **API** (bottom of left sidebar)
2. Under "Project API keys", copy these values:
   - **Project URL** → Use as `NEXT_PUBLIC_SUPABASE_URL`
   - **Key (anon public)** → Use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Key (service_role)** → Use as `SUPABASE_SERVICE_ROLE_KEY` (keep private!)
3. Store these securely; you'll need them for environment configuration

## TURN Server Setup (Optional but Recommended)

### Understanding TURN

WebRTC uses peer-to-peer (P2P) connection for efficiency. However, NAT traversal fails on:
- Corporate networks with strict firewalls
- Mobile carriers with symmetric NAT
- ISPs with carrier-grade NAT

TURN servers relay media when P2P is impossible.

**Without TURN:**
- Local networks: Works great
- Corporate/mobile: Video fails

**With TURN:**
- All networks: Works reliably
- Trade-off: Uses more bandwidth for relayed sessions

### Free Option: Metered.ca (Default)

The app includes free TURN credentials (Metered.ca):
- **Free tier:** 500MB/month (~15 hours relayed video)
- Sufficient for small deployments
- Falls back to P2P after quota hit (may fail on restrictive networks)

### Paid Options (Recommended for Production)

If you expect heavy usage on restrictive networks:

| Provider | Cost | Bandwidth | Link |
|----------|------|-----------|------|
| **Metered.ca** | $10/mo | 50GB | https://www.metered.ca |
| **Twilio** | Pay-as-you-go | Unlimited | https://www.twilio.com/webrtc/turn |
| **Xirsys** | $5/mo | 25GB | https://xirsys.com |

### Configure Custom TURN Servers

Once you have TURN credentials from your provider:

1. Add to `.env.production.local`:
```env
NEXT_PUBLIC_TURN_URL=turn:your-turn-server.com:80
NEXT_PUBLIC_TURN_USERNAME=your-username
NEXT_PUBLIC_TURN_CREDENTIAL=your-credential
NEXT_PUBLIC_TURNS_URL=turn:your-turn-server.com:443
NEXT_PUBLIC_TURNS_TLS_URL=turns:your-turn-server.com:443?transport=tcp
```

2. Test connectivity: https://test.webrtc.org

## Environment Configuration

Create `.env.production.local` with all required and optional variables:

### Generate Secrets

First, generate two cryptographically secure secrets:

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate ROOM_TOKEN_SECRET
openssl rand -base64 32
```

Store these values safely — you'll use them below.

### Full Environment Template

```env
# ============ REQUIRED ============

# Authentication secrets (from openssl above)
AUTH_SECRET=<your-first-secret-here>
ROOM_TOKEN_SECRET=<your-second-secret-here>

# Domain (must match actual deployment domain)
NEXTAUTH_URL=https://your-domain.com

# Anthropic API (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...

# Database (from Supabase setup)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# ============ OPTIONAL ============

# Custom TURN servers (only if using paid tier)
NEXT_PUBLIC_TURN_URL=turn:your-turn-server.com:80
NEXT_PUBLIC_TURN_USERNAME=your-username
NEXT_PUBLIC_TURN_CREDENTIAL=your-credential
NEXT_PUBLIC_TURNS_URL=turn:your-turn-server.com:443
NEXT_PUBLIC_TURNS_TLS_URL=turns:your-turn-server.com:443?transport=tcp
```

### Variable Reference

| Variable | Required | Source | Notes |
|----------|----------|--------|-------|
| `AUTH_SECRET` | Yes | Generated | Keep private; use for JWT signing |
| `ROOM_TOKEN_SECRET` | Yes | Generated | Keep private; use for WebRTC tokens |
| `NEXTAUTH_URL` | Yes | Your domain | Must match actual deployment URL |
| `ANTHROPIC_API_KEY` | Yes | console.anthropic.com | Keep private; required for AI features |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase dashboard | Public; OK to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase dashboard | Public; OK to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase dashboard | Keep private; server-only |
| `NEXT_PUBLIC_TURN_URL` | No | TURN provider | Optional; uses free Metered.ca if not set |
| `NEXT_PUBLIC_TURN_USERNAME` | No | TURN provider | — |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | No | TURN provider | — |
| `NEXT_PUBLIC_TURNS_URL` | No | TURN provider | — |
| `NEXT_PUBLIC_TURNS_TLS_URL` | No | TURN provider | — |

## Deploy to Vercel (Recommended)

Vercel is the easiest option for Next.js apps with built-in CI/CD and automatic deployments.

### Step 1: Build Locally

```bash
# Build production bundle
npm run build

# Test production build locally (optional)
npm run start
# Opens http://localhost:3789
```

### Step 2: Configure Vercel Project

1. Visit https://vercel.com/dashboard
2. Create new project from your repository (or import existing)
3. Vercel auto-detects Next.js — click **"Deploy"** to build
4. Wait for first deployment to complete

### Step 3: Set Environment Variables

1. In Vercel dashboard, select your project
2. Go to **Settings** → **Environment Variables**
3. Add each variable from your `.env.production.local`:
   - **Key:** `AUTH_SECRET`, **Value:** `<your-secret>`
   - **Key:** `ROOM_TOKEN_SECRET`, **Value:** `<your-secret>`
   - **Key:** `NEXTAUTH_URL`, **Value:** `https://your-domain.com` (or Vercel preview URL)
   - **Key:** `ANTHROPIC_API_KEY`, **Value:** `sk-ant-...`
   - **Key:** `NEXT_PUBLIC_SUPABASE_URL`, **Value:** `https://...supabase.co`
   - **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`, **Value:** `eyJ...`
   - **Key:** `SUPABASE_SERVICE_ROLE_KEY`, **Value:** `eyJ...`
   - (Optional) Custom TURN variables if applicable
4. Set environment scope to **"Production"**
5. Click **"Save"**

### Step 4: Trigger Production Deployment

```bash
# Redeploy with new environment variables
vercel deploy --prod
```

Or simply push to `main` branch — Vercel auto-deploys on git push.

### Step 5: Configure Custom Domain (Optional)

1. In Vercel, go to **Settings** → **Domains**
2. Click **"Add Domain"**
3. Enter your custom domain (e.g., `tutoring.yourdomain.com`)
4. Follow DNS configuration instructions (add CNAME record)
5. Update `NEXTAUTH_URL` environment variable to match new domain
6. Trigger redeploy

### Verify Deployment

Once deployed:
1. Visit your Vercel URL or custom domain
2. Sign up / log in
3. Create a room and test video/audio
4. Check browser console (F12) for errors
5. Test analytics by completing a mock session

## Deploy with Docker

Useful for self-hosted deployments on AWS, DigitalOcean, Railway, or any Docker-capable platform.

### Step 1: Build Production Bundle

```bash
npm run build
```

This creates `.next/` directory with optimized app.

### Step 2: Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Use official Node.js runtime as base image
FROM node:18-alpine

WORKDIR /app

# Install dependencies from package-lock.json (reproducible)
COPY package*.json ./
RUN npm ci --only=production

# Copy pre-built Next.js app
COPY .next ./.next
COPY public ./public

# Expose port (change if needed)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start Node.js server
CMD ["node", ".next/standalone/server.js"]
```

### Step 3: Build Docker Image

```bash
# Build image locally
docker build -t nerdy:latest .

# Test locally
docker run -p 3000:3000 \
  -e AUTH_SECRET=test-secret \
  -e ROOM_TOKEN_SECRET=test-secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  nerdy:latest
```

### Step 4: Run with Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  nerdy:
    image: nerdy:latest
    container_name: nerdy-app
    ports:
      - "3000:3000"
    environment:
      # Required
      AUTH_SECRET: ${AUTH_SECRET}
      ROOM_TOKEN_SECRET: ${ROOM_TOKEN_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}

      # Database
      NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}

      # Optional: TURN servers
      NEXT_PUBLIC_TURN_URL: ${NEXT_PUBLIC_TURN_URL:-}
      NEXT_PUBLIC_TURN_USERNAME: ${NEXT_PUBLIC_TURN_USERNAME:-}
      NEXT_PUBLIC_TURN_CREDENTIAL: ${NEXT_PUBLIC_TURN_CREDENTIAL:-}

    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    # Optional: Restrict resource usage
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

### Step 5: Run with Docker Compose

```bash
# Create .env file with your production variables
cat > .env << EOF
AUTH_SECRET=<your-secret>
ROOM_TOKEN_SECRET=<your-secret>
NEXTAUTH_URL=https://yourdomain.com
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
EOF

# Start services
docker-compose up -d

# View logs
docker-compose logs -f nerdy

# Stop services
docker-compose down
```

### Step 6: Deploy to Production Server

#### Option A: Push to Docker Registry (Docker Hub, ECR, etc.)

```bash
# Tag image
docker tag nerdy:latest your-username/nerdy:latest

# Push to registry
docker push your-username/nerdy:latest

# On production server:
docker pull your-username/nerdy:latest
docker-compose up -d
```

#### Option B: Use AWS ECS

```bash
# Tag for ECR
docker tag nerdy:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/nerdy:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/nerdy:latest

# Create ECS task definition, service, etc.
```

#### Option C: Use Railway, Render, or DigitalOcean

- **Railway:** Connect GitHub repo, Railway auto-builds Docker image
- **Render:** Similar to Railway; specify `docker-compose.yml`
- **DigitalOcean App Platform:** Connect repo, configure environment

## Architecture & Infrastructure

### Signaling (WebRTC Peer Connection)

Nerdy uses a polling-based signaling system for maximum hosting flexibility:

**Development:**
- In-memory signaling (requires single server)
- Fast but doesn't scale

**Production:**
- Supabase table polling (`signal_messages` table)
- 500ms poll interval
- Slower than WebSockets but works anywhere (Vercel, self-hosted, etc.)
- Stateless — enables horizontal scaling

When users join a room:
1. Client polls `/api/signaling/messages?roomId=...` every 500ms
2. Server queries `signal_messages` table
3. Client receives WebRTC offers/answers/ICE candidates
4. P2P connection established; polling can stop (optional optimization)

### Session Data Storage

**Development:**
- File-based storage (`.data/sessions.json`)
- Data lost on app restart

**Production:**
- Supabase PostgreSQL database
- Persistent across restarts
- Real-time subscriptions for live updates
- Backed up automatically by Supabase

Data persisted:
- Session metadata (start time, participants, config)
- Metrics snapshots (every 500ms-1s)
- Nudge history with timestamps
- User transcripts and analysis results

### AI Analysis Engine

**Claude API Integration:**
- Powered by Anthropic Claude 3.5 Sonnet
- Requires valid `ANTHROPIC_API_KEY`
- API calls made from Next.js backend (secure, not exposed to client)
- Called post-session for:
  - Session summaries
  - Key insights
  - Personalized recommendations
- Cost: ~$0.001-0.01 per analysis (depends on session length)

**Features:**
- Analyzes metrics history + nudges
- Generates structured insights
- Provides educational recommendations
- Identifies patterns and trends

### Media Handling (Video & Audio)

**Video/Audio Transmission:**
- **Peer-to-peer (P2P) with WebRTC** — Direct connection between browsers
- No video relay through servers (saves bandwidth, reduces latency)
- Media encrypted end-to-end

**When P2P Fails (NAT/Firewall):**
- TURN servers relay media through them
- Fallback is automatic via ICE candidates
- Trade-off: More bandwidth, but ensures connectivity

**Audio Analysis:**
- Browser's Web Audio API captures audio stream
- Analyze for:
  - Energy level (RMS)
  - Speaking time (energy threshold)
  - Pitch variance (expressiveness)
  - Fundamental frequency
- Analysis done in-browser (not sent to server)

**Auto-Play Policy:**
- Modern browsers require user interaction before audio plays
- User must click anywhere on page first
- App auto-requests microphone permission on first use

### Authentication & Authorization

**Built-in:**
- NextAuth email/password authentication
- Session-based authentication
- Secure session tokens

**Optional Extensions:**
- Google OAuth (social login)
- GitHub OAuth (for developers)
- Custom identity providers

**Row-Level Security (RLS):**
- Supabase enforces RLS policies
- Users can only access their own sessions
- See `docs/supabase-rls-fix.sql` for policy setup

## Troubleshooting

### Video Not Connecting

**Symptoms:** Camera/screen shares but no video received from other person

**Diagnostics:**
1. Open browser console (F12) → **Console** tab
2. Look for WebRTC errors like "ICE connection failed"
3. Check if local camera is working (should see preview)
4. Test TURN server connectivity: https://test.webrtc.org

**Solutions:**
- Verify firewall/NAT allows WebRTC
- Test TURN credentials: `NEXT_PUBLIC_TURN_*` variables
- Try upgrade to paid TURN tier (free tier may be rate-limited)
- Check browser compatibility (Chrome, Firefox, Safari 11+)
- Try incognito/private mode (cache/extension issues)

### Audio Not Working

**Symptoms:** No audio transmitted or heard

**Diagnostics:**
1. Check microphone icon in address bar — grant permission if needed
2. System sound settings — is browser allowed to access microphone?
3. Test microphone: https://test.webrtc.org
4. Check browser console for microphone permission errors

**Solutions:**
1. Click anywhere on page to enable audio context (browser auto-play policy)
2. Reset microphone permissions:
   - Chrome: Settings → Privacy → Microphone → Reset
   - Firefox: Preferences → Privacy → Permissions → Microphone → Reset
3. Check OS microphone permissions (macOS, Windows settings)
4. Verify no other app has exclusive microphone access
5. Try different browser or incognito mode

### AI Analysis Failing

**Symptoms:** Analysis page shows error or never completes

**Diagnostics:**
1. Check `ANTHROPIC_API_KEY` is set: `echo $ANTHROPIC_API_KEY`
2. Verify key is valid at https://console.anthropic.com
3. Check remaining API credits at https://console.anthropic.com/account/usage
4. Check server logs for API errors:
   - Vercel: Dashboard → Deployments → Function logs
   - Self-hosted: `docker-compose logs nerdy` or stdout

**Solutions:**
- Activate API key if deactivated
- Add billing method if out of credits
- Check API key format (should start with `sk-ant-`)
- Verify key has "Messages" API permission
- Request higher rate limit if hitting quotas

### Session Data Lost

**Symptoms:** Session doesn't appear in dashboard after completion

**Diagnostics:**
1. Verify Supabase URL: check `.env` file has `NEXT_PUBLIC_SUPABASE_URL`
2. Check database connection: In browser console:
   ```javascript
   await fetch('/api/sessions?limit=1').then(r => r.json()).then(console.log)
   ```
3. Check Supabase dashboard:
   - Go to "Tables"
   - Query `SELECT COUNT(*) FROM sessions`
   - Should return result

**Solutions:**
- Verify Supabase credentials in `.env`
- Re-run schema: `docs/supabase-schema.sql`
- Re-run RLS policies: `docs/supabase-rls-fix.sql`
- Check Row Level Security isn't blocking writes:
  - Supabase → Database → RLS
  - Verify policies allow authenticated users to write
- Check database quotas (free tier limited to 500MB)

### Signaling Timeout

**Symptoms:** Users can't connect; "Waiting for peer" message persists

**Diagnostics:**
1. Check signaling API responds:
   ```bash
   curl -s https://your-domain.com/api/signaling/messages?roomId=test
   ```
2. Monitor Supabase polling:
   - Browser DevTools → Network
   - Filter by `/api/signaling`
   - Should see requests every 500ms

**Solutions:**
- Check network latency to Supabase (high ping = slow signaling)
- Verify room token: Check JWT token is valid
- Check database hasn't hit query rate limits
- Increase signaling poll interval in `src/lib/session/webrtc-session.ts`

### Metrics Not Recording

**Symptoms:** Analytics page empty or shows no data

**Diagnostics:**
1. Check metrics are captured during session:
   - Browser console → `sessionStore.getState().metricsHistory.length`
   - Should increase every second
2. Verify camera access:
   - Should see camera preview during session
   - Check camera permissions granted

**Solutions:**
- Grant camera permission when prompted
- Check CPU/GPU usage (low specs may drop frames)
- Verify MediaPipe loading: Check Network tab for face_landmarker.task
- Try different camera (USB vs. built-in)

### High CPU/Memory Usage

**Symptoms:** App runs slow, fan spins up, page becomes unresponsive

**Diagnostics:**
- Chrome DevTools → Performance tab → Record
- Look for long tasks and garbage collection events
- Check heap size growth

**Solutions:**
- Reduce metrics sampling frequency (currently ~1Hz)
- Limit metrics history in memory (currently keeps all)
- Disable expression analysis if not needed
- Increase Docker memory limits:
  ```yaml
  deploy:
    resources:
      limits:
        memory: 2G
  ```

## Monitoring & Maintenance

### Production Observability

#### Vercel
- **Logs:** Dashboard → select project → **"Functions"** tab
- **Metrics:** **"Analytics"** tab (requests, bandwidth, performance)
- **Deployments:** **"Deployments"** tab (see deployment logs and errors)

#### Self-Hosted
- **Logs:** `docker-compose logs -f nerdy`
- **Exit code:** `docker-compose ps` (shows if container is running)
- **System resources:** `docker stats`

### Key Metrics to Monitor

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| **API Response Time** | < 100ms | 200ms+ | > 500ms |
| **Signaling Latency** | < 500ms | 1s+ | > 2s |
| **WebRTC Connection Rate** | 95%+ | < 90% | < 80% |
| **Supabase DB Load** | < 50% | 70%+ | > 90% |
| **TURN Bandwidth** | Monitor quota | 80% used | 100% used |
| **Claude API Cost** | < $100/month | Monitor | Alert at $200 |
| **Error Rate** | < 1% | 5%+ | > 10% |

### Useful Commands

```bash
# Check Vercel deployment status
vercel status

# Monitor Docker container
docker-compose ps
docker-compose logs -f --tail=100 nerdy

# Check Supabase status
curl -s https://<your-project>.supabase.co/health

# Test TURN server
curl -s https://test.webrtc.org

# Monitor disk space
df -h

# Monitor memory
free -h

# CPU usage
top -b -n 1
```

### Set Up Alerts

#### For Vercel
1. Go to Project Settings → Integrations
2. Add monitoring integration (Sentry, DataDog, etc.)
3. Configure alerts for:
   - High error rate
   - Function timeout
   - Cold start issues

#### For Self-Hosted
- Use monitoring service:
  - **Uptime Robot** (free uptime monitoring)
  - **New Relic** (comprehensive APM)
  - **Sentry** (error tracking)
  - **DataDog** (infrastructure monitoring)

Configure webhook alerts to Slack/email.

### Database Maintenance

**Monthly:**
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

-- Clean up old metrics (keep last 90 days)
DELETE FROM metrics
WHERE created_at < NOW() - INTERVAL '90 days';

-- Vacuum to reclaim space
VACUUM ANALYZE;
```

**Quarterly:**
- Review and optimize RLS policies
- Archive old sessions to cold storage
- Review database indexes for performance

### TURN Bandwidth Management

If using paid TURN tier:
1. Check monthly usage at TURN provider dashboard
2. Set bandwidth alerts
3. Plan capacity based on:
   - Concurrent users
   - Session duration
   - Network conditions (% on restrictive networks)
4. Typical: 50MB per hour relayed video

### Claude API Cost Management

1. Set API usage limits at https://console.anthropic.com
2. Monitor costs at https://console.anthropic.com/account/usage
3. Set up usage alerts
4. Consider batch processing for analysis (cheaper rates)

## Deployment Checklist

Before going live:

- [ ] Database schema initialized in Supabase
- [ ] Realtime enabled on `signal_messages` table
- [ ] All environment variables set (no test/placeholder values)
- [ ] TURN servers configured (or using free Metered.ca)
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Custom domain configured and DNS updated
- [ ] NEXTAUTH_URL matches deployment domain
- [ ] Email/password sign-up tested
- [ ] OAuth configured (if using social login)
- [ ] Test session created and analytics verified
- [ ] Mobile responsiveness tested
- [ ] Performance tested on slow network (Chrome DevTools throttling)
- [ ] Error handling verified (test with invalid credentials, etc.)
- [ ] Analytics page loads and displays metrics
- [ ] AI analysis works post-session
- [ ] Monitoring/alerts configured
- [ ] Backup strategy in place (Supabase auto-backups)
- [ ] Documentation updated with your domain
- [ ] Support contact info configured

## Next Steps

1. **Test locally:**
   ```bash
   npm run dev
   # Sign up, create room, test video/audio
   ```

2. **Deploy to staging:**
   - Vercel preview environment
   - Internal domain
   - Use test Anthropic/Supabase keys

3. **Test staging thoroughly:**
   - Full session completion
   - Analytics page
   - AI analysis
   - Mobile access
   - Network latency simulation

4. **Deploy to production:**
   - Set production environment variables
   - Trigger production deployment
   - Monitor logs for first 24 hours

5. **Post-launch monitoring:**
   - Daily check of logs and metrics
   - Weekly review of error rates and performance
   - Monthly cost and capacity review

## Support & Documentation

- **Metrics Reference:** See `docs/METRICS.md`
- **Methodology:** See `docs/METHODOLOGY.md`
- **API Docs:** See `docs/README.md`
- **Limitations:** See `docs/LIMITATIONS.md`

For deployment questions, check the troubleshooting section above or contact your infrastructure team.
