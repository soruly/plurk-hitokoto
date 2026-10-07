# plurk-hitokoto

[![License](https://img.shields.io/github/license/soruly/plurk-hitokoto.svg?style=flat-square)](https://github.com/soruly/plurk-hitokoto/blob/master/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/soruly/plurk-hitokoto/node.js.yml?style=flat-square)](https://github.com/soruly/plurk-hitokoto/actions)

Post quotes from [hitokoto (一言)](https://hitokoto.cn) to Plurk (噗浪) with automatic Simplified to Traditional Chinese conversion via Wikipedia API.

Has 0 runtime dependencies and runs both locally with Node.js and serverless on Cloudflare Workers (Cron Triggers).

---

## 1. Initial Setup & Plurk Authorization

1. Clone this repository and install dependencies:
   ```bash
   npm install
   ```
2. Create an application on [Plurk App Console](https://www.plurk.com/PlurkApp/) and obtain your **App key** (`CONSUMER_KEY`) and **App secret** (`CONSUMER_SECRET`).
3. Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```
4. Run the authorization script:
   ```bash
   npm run auth
   ```
   Open the authorization URL shown in the console, approve the app, and enter the verification code. This will automatically append `TOKEN` and `TOKEN_SECRET` to your `.env` file.

---

## 2. Running Locally

### Manual Run

Once authenticated, you can post manually:

```bash
npm start
# or: node index.ts
```

### Scheduled Run via Systemd Timer

You can install a system-wide systemd timer so it runs automatically in the background without needing any user to log in:

1. **Create the service file** (`/etc/systemd/system/plurk-hitokoto.service`):

   ```ini
   [Unit]
   Description=Plurk Hitokoto Poster
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=oneshot
   User=soruly
   WorkingDirectory=/path/to/plurk-hitokoto
   ExecStart=/usr/bin/node index.ts
   ```

   _(Note: Replace `User` with your Linux username, `WorkingDirectory` with your project's absolute path, and `/usr/bin/node` with the output of `which node`)._

2. **Create the timer file** (`/etc/systemd/system/plurk-hitokoto.timer`):

   ```ini
   [Unit]
   Description=Run Plurk Hitokoto daily

   [Timer]
   OnCalendar=daily
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

   _(Tip: `daily` triggers every day at 00:00. You can also specify an exact time such as `*-*-* 09:00:00`)._

3. **Enable and start the timer**:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now plurk-hitokoto.timer
   ```

4. **Useful management commands**:
   - Check timer status and next trigger time:
     ```bash
     systemctl list-timers plurk-hitokoto.timer
     ```
   - Trigger a test run immediately:
     ```bash
     sudo systemctl start plurk-hitokoto.service
     ```
   - View execution logs:
     ```bash
     journalctl -u plurk-hitokoto.service -f
     ```

---

## 3. Deploying to Cloudflare Workers (Cron Trigger)

This project can be deployed as a Cloudflare Worker scheduled with a Cron Trigger.

### A. Set Cloudflare Secrets

Set the four credentials obtained from your `.env` file into Cloudflare Workers:

```bash
npx wrangler secret put CONSUMER_KEY
npx wrangler secret put CONSUMER_SECRET
npx wrangler secret put TOKEN
npx wrangler secret put TOKEN_SECRET
```

### B. Configure Cron Schedule (Optional)

The schedule is defined in [`wrangler.toml`](./wrangler.toml). By default, it runs once a day:

```toml
[triggers]
crons = ["0 0 * * *"] # Every day at 00:00 UTC
```

You can change this cron expression (e.g. `0 1 * * *` for 09:00 UTC+8, or `0 0,12 * * *` for twice daily).

### C. Deploy

Deploy the worker to Cloudflare:

```bash
npm run deploy
```

Once deployed, Cloudflare Workers will automatically post quotes to Plurk according to your cron schedule.
