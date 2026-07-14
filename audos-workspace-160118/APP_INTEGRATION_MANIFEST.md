# App Integration Manifest

Before building any app feature, check this manifest. Use platform integrations instead of reinventing functionality. Every integration listed here is already deployed and available to your app via simple fetch() calls.

If your runtime exposes `get_integration_docs`, prefer `get_integration_docs({ integrationName: "stripe-payments" })` for full API details and working code examples.
Otherwise, read `integrations/{id}/docs.md` by file path.

---

## Quick Lookup: "I need X, which integration do I use?"

| I need to... | Use this integration |
|---|---|
| Accept payments or subscriptions | `stripe-payments` |
| Make AI phone calls | `ai-phone-calls` |
| Send emails | `task-scheduler` |
| Schedule tasks or recurring jobs | `task-scheduler` |
| Search the web | `web-search` |
| Scrape websites or social media | `web-scraping` |
| Generate text with AI (chatbot, content) | `openai-text-generation` |
| Real-time voice conversation with AI | `openai-realtime` |
| Text-to-speech or music generation | `elevenlabs-audio` |
| Analyze images | `gemini-vision-transform` |
| Analyze or summarize videos | `gemini-video-understanding` |
| Generate images or videos with AI | `google-veo3` |
| Analyze PDFs or documents | `document-analysis` |
| Transcribe audio/speech to text | `audio-transcription` |
| User authentication and sessions | `session-management` |
| Upload and store files/images | `file-storage` |
| Social feeds, posts, reactions, presence | `workspace-community` |
| Sell print-on-demand merchandise | `printify-products` |
| Run server-side logic (webhooks, hooks) | `server-functions` |
| Create public standalone pages | `permalink-pages` |
| Buy a domain (wallet-gated) | `domain-registration` |
| Provision a dedicated phone number | `ai-phone-calls` |
| Receive and process inbound emails | `inbound-email` |
| Automated email drip campaigns | `email-sequences` |
| Request human-in-the-loop tasks | `human-tasks` |
| Tag and segment CRM contacts | `crm-tags` |
| Search B2B leads | `apollo-leads` |
| Post to Slack channels | `slack` |

---

## Integration Reference

### ai-phone-calls
**Category:** Communication / Voice
Make and receive AI-powered phone calls on behalf of workspace customers using Retell AI or ElevenLabs. **Task #1235:** also supports dedicated, wallet-gated per-workspace numbers (with optional space- or contact-binding) — outbound resolution chain: contact → space → workspace-default → platform shared.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/workspaces/:workspaceId/phone/config` | Get Phone Config |
| `POST /api/workspaces/:workspaceId/phone/agents` | Create an Agent |
| `GET /api/workspaces/:workspaceId/phone/agents` | List Agents |
| `GET /api/workspaces/:workspaceId/phone/agents/:agentId` | Get a Specific Agent |
| `PATCH /api/workspaces/:workspaceId/phone/agents/:agentId` | Update an Agent's Prompt |
| `DELETE /api/workspaces/:workspaceId/phone/agents/:agentId` | Delete an Agent |
| `POST /api/workspaces/:workspaceId/phone/numbers/search` | Twilio inventory search (areaCode, contains) |
| `POST /api/workspaces/:workspaceId/phone/numbers/quote` | Monthly price quote with safety headroom |
| `POST /api/workspaces/:workspaceId/phone/numbers/purchase` | Wallet-gated purchase (idempotent, refund-on-failure). Returns canonical `insufficient_funds` (402) when the wallet is short. |
| `GET /api/workspaces/:workspaceId/phone/numbers` | List dedicated numbers |
| `DELETE /api/workspaces/:workspaceId/phone/numbers/:numberId` | Release a number (Twilio + DB) |

Recurring monthly charges are handled by the `phone-number-renewal` cron
(armed by `PHONE_NUMBER_RENEWAL_ENABLED=1`); a wallet that cannot fund
the renewal causes graceful release of the number with `status =
renewal_failed`.

```
GET /api/workspaces/:workspaceId/phone/config
```

---

### apollo-leads
**Category:** General
Search, enrich, and manage leads using Apollo.io's comprehensive B2B contact database. Find potential customers, partners, or media contacts for outreach.

```typescript
const response = await fetch('/api/leads/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'marketing automation',
    personTitles: ['VP Marketing', 'CMO', 'Director of Marketing'],
    personSeniorities: ['director', 'vp', 'c_suite'],
    includeSimilarTitles: true,
    limit: 25
  })
});

const { people, pagination } = await response.json();
// people[] contains name, title, company, email (if available), etc.
```

---

### audio-transcription
**Category:** AI/ML
Record audio and convert speech to text using OpenAI's GPT-4o Transcribe model. Simple POST endpoint for record-then-send transcription workflows.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/generate/transcribe` | API Endpoint |

```
POST /api/generate/transcribe
```

---

### crm-tags
**Category:** CRM
Manage contact and session tags for organizing and triggering automated boosters.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/workspace-tags/:workspaceId` | Create a Tag |
| `GET /api/workspace-tags/:workspaceId` | List All Tags |
| `POST /api/entity-tags/contacts/:contactId/tags?workspaceId=:workspaceId` | Apply Tag to Contact |
| `POST /api/entity-tags/sessions/:sessionId/tags?workspaceId=:workspaceId` | Apply Tag to Session |
| `GET /api/entity-tags/contacts/:contactId/tags?workspaceId=:workspaceId` | Get Contact Tags |
| `GET /api/entity-tags/sessions/:sessionId/tags?workspaceId=:workspaceId&includeInherited=true` | Get Session Tags |

```
POST /api/workspace-tags/:workspaceId
```

---

### document-analysis
**Category:** AI/ML
Analyze images and PDFs with GPT-4 vision - extract data from invoices, forms, diagrams, and more. Supports native PDF processing (up to 100 pages, 32MB max).

| Endpoint | Purpose |
|----------|--------|
| `POST /api/analyze-document` | API Endpoint |

```
POST /api/analyze-document
```

---

### elevenlabs-audio
**Category:** AI / Audio
Generate natural-sounding speech from text and create AI background music. Powered by ElevenLabs with 30+ premium voices and 8 music presets.

| Endpoint | Purpose |
|----------|--------|
| `GET /voiceover/voices` | List Available Voices |
| `POST /api/workspaces/:workspaceId/demo-video/voiceover` | Generate Speech |
| `POST /api/workspaces/:workspaceId/demo-video/voiceover/segments` | Generate Segmented Speech |
| `GET /music/presets` | List Music Presets |
| `POST /api/workspaces/:workspaceId/demo-video/music/preset` | Generate Music from Preset |
| `POST /api/workspaces/:workspaceId/demo-video/music/custom` | Generate Custom Music |

```
GET /voiceover/voices
```

---

### email-sequences
**Category:** Marketing / Automation
Create multi-step automated email campaigns triggered by events, schedules, or manual actions.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/workspaces/:workspaceId/email-sequences` | Create a Sequence |
| `GET /api/workspaces/:workspaceId/email-sequences` | List Sequences |
| `GET /api/workspaces/:workspaceId/email-sequences/:sequenceId` | Get Sequence Details |
| `PATCH /api/workspaces/:workspaceId/email-sequences/:sequenceId` | Update a Sequence |
| `DELETE /api/workspaces/:workspaceId/email-sequences/:sequenceId` | Delete a Sequence |
| `POST /api/workspaces/:workspaceId/email-sequences/:sequenceId/pause` | Pause / Resume a Sequence |

```
POST /api/workspaces/:workspaceId/email-sequences
```

---

### file-storage
**Category:** Storage
Permanently store images and files in Google Cloud Storage with public URLs.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/upload/image` | API Endpoints |

```
POST /api/upload/image
```

---

### gemini-video-understanding
**Category:** AI/ML
Analyze videos with Google's Gemini API to extract insights, summarize content, answer questions, and reference specific timestamps.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/generate/video-analysis` | 1. Analyze Video (File Upload for videos >20MB) |
| `POST /api/generate/video-inline` | 2. Analyze Video (Inline for videos <20MB) |
| `POST /api/generate/video-youtube` | 3. Analyze YouTube Video |

```
POST /api/generate/video-analysis
```

---

### gemini-vision-transform
**Category:** General
Analyze images with Gemini Vision and transform them into new styles (line art, stylization, etc.) using AI-powered image-to-image processing.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/generate/vision` | 1. Vision Analysis — Describe or analyze an image |
| `POST /api/generate/image-to-image` | 2. Image-to-Image — Transform an image into a new style |

```
POST /api/generate/vision
```

---

### google-veo3
**Category:** AI/ML
Generate AI-powered videos and images using Google Veo3, Gemini 2.5 Flash, or OpenAI DALL-E 3.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/generate/image` | API Endpoints |
| `POST /api/generate/video` |  |
| `GET /api/veo/jobs/:operationId` |  |

```
POST /api/generate/image
```

---

### human-tasks
**Category:** General
Request, approve, track, and complete human tasks with wallet-based budgeting. Tasks go through an approval workflow before being posted to Slack.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/human-tasks?workspaceId={workspaceId}` | List Tasks |
| `GET /api/workspace/{workspaceId}/human-tasks` | List Tasks |
| `POST /api/human-tasks` | Create Task |
| `POST /api/workspace/{workspaceId}/human-tasks` | Create Task |
| `POST /api/human-tasks/{taskId}/approve` | Approve Task |
| `POST /api/workspace/{workspaceId}/human-tasks/{taskId}/approve` | Approve Task |

```
GET /api/human-tasks?workspaceId={workspaceId}
GET /api/workspace/{workspaceId}/human-tasks
```

---

### inbound-email
**Category:** Communication
Receive, process, and auto-respond to emails on behalf of workspace customers using Mailgun inbound routing and server functions.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/workspaces/:workspaceId/emails/send` | Send an Email |
| `GET /api/workspaces/:workspaceId/emails` | List Email Messages |
| `GET /api/workspaces/:workspaceId/emails/:messageId` | Get a Specific Email |
| `GET /api/workspaces/:workspaceId/emails/thread/:email` | Get Email Thread by Customer Email |
| `POST /api/mailgun/webhooks/inbound` | Inbound Webhook (Platform-Level) |
| `POST /api/workspaces/:workspaceId/hooks` | Optional: Custom Processing via Server Functions Hook |

```
Incoming Email → Mailgun → POST /api/mailgun/webhooks/inbound → Email Processor stores to workspace_email_messages → AI Chat Service auto-responds
```

---

### openai-realtime
**Category:** AI/ML
Real-time voice conversations with AI using OpenAI's Realtime API.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/realtime/token` | API Endpoint |

```
GET /api/realtime/token
```

---

### openai-text-generation
**Category:** AI/ML
Generate text, chatbots, content creation, and AI responses using OpenAI GPT models.

| Endpoint | Purpose |
|----------|--------|
| `POST /proxy/openai/v1/chat/completions` | API Endpoint |

```
POST /proxy/openai/v1/chat/completions
```

---

### permalink-pages
**Category:** Content / Publishing
Generate standalone, publicly accessible pages at unique URLs — static HTML or compiled React/TSX apps. **Task #1235:** pages can now be served on any of the workspace's verified custom domains via the optional `host` field on POST/PATCH; the union of (primary `custom_domain` ∪ `workspace_permalink_hosts`) is exposed via the host-registry endpoints below.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/workspaces/:workspaceId/permalink-pages` | Create a Permalink Page (accepts optional `host`) |
| `GET /api/workspaces/:workspaceId/permalink-pages` | List Permalink Pages |
| `GET /api/workspaces/:workspaceId/permalink-pages/:pageId` | Get a Permalink Page |
| `PATCH /api/workspaces/:workspaceId/permalink-pages/:pageId` | Update a Permalink Page (accepts optional `host`) |
| `POST /api/workspaces/:workspaceId/permalink-pages/:pageId/recompile` | Recompile a TSX Page |
| `DELETE /api/workspaces/:workspaceId/permalink-pages/:pageId` | Delete a Permalink Page |
| `GET /api/workspaces/:workspaceId/permalink-hosts` | List eligible hosts (primary + secondary) |
| `POST /api/workspaces/:workspaceId/permalink-hosts` | Register a secondary host (ownership-checked) |
| `POST /api/workspaces/:workspaceId/permalink-hosts/check-ownership` | Pre-flight ownership check |
| `DELETE /api/workspaces/:workspaceId/permalink-hosts/:host` | Remove a secondary host |

```
POST /api/workspaces/:workspaceId/permalink-pages
```

---

### domain-registration
**Category:** Infrastructure / Domains
Wallet-gated apex-domain purchase via DNSimple with automatic Cloudflare hostname setup and auto-attachment to the permalink-host registry. Every attempt is audit-logged; failures auto-refund. Shares the canonical `insufficient_funds {required, available, shortfall, headroomMultiplier, message}` shape with `phone-numbers/purchase`.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/workspaces/:workspaceId/domains/quote` | Availability + price (no charge) |
| `POST /api/workspaces/:workspaceId/domains/preview-spend` | Wallet preview vs quoted price |
| `POST /api/workspaces/:workspaceId/domains/register` | Idempotent purchase; agent-origin requires `userConfirmed: true` |
| `GET /api/workspaces/:workspaceId/domains/audit` | Per-workspace audit feed |
| `GET /api/workspaces/:workspaceId/domains` | List `purchased_domains` |

```
POST /api/workspaces/:workspaceId/domains/register
{ "domain": "myapp.com", "userConfirmed": true, "idempotencyKey": "stable-key" }
```

---

### printify-products
**Category:** E-commerce / Print-on-Demand
Create and sell custom branded merchandise (t-shirts, hoodies, mugs, etc.) using Printify's print-on-demand platform with real-time mockup previews.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/printify/shops` | Get Shops |
| `GET /api/printify/catalog/blueprints` | Get Product Catalog (Blueprints) |
| `GET /api/printify/catalog/blueprints/:blueprintId/providers` | Get Print Providers for Blueprint |
| `GET /api/printify/catalog/blueprints/:blueprintId/providers/:providerId/variants` | Get Variants for Blueprint/Provider |
| `POST /api/printify/uploads` | Upload Design Image |
| `GET /api/proxy/image?url=<encoded-url>` | Proxy External Images (CORS) |

```
GET /api/printify/shops
```

---

### server-functions
**Category:** Backend / Server Logic
Define server-side handler functions that receive HTTP requests at unique URLs per workspace.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/workspaces/665201/hooks` |  |
| `GET /api/workspaces/workspace-665201/hooks` |  |
| `GET /api/workspaces/8a8181a4-.../hooks` |  |
| `POST /api/workspaces/:workspaceId/hooks` | Create a Hook |
| `GET /api/workspaces/:workspaceId/hooks` | List Hooks |
| `GET /api/workspaces/:workspaceId/hooks/:hookId` | Get a Hook |

```
GET /api/workspaces/665201/hooks       ✅ works
GET /api/workspaces/workspace-665201/hooks  ✅ works
GET /api/workspaces/8a8181a4-.../hooks ✅ works
```

---

### session-management
**Category:** Authentication
User authentication and session handling with secure state management, including email verification via OTP.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/space/{spaceId}/register` | Basic Session Management |
| `GET /api/session` |  |
| `DELETE /api/session` |  |
| `POST /api/auth/otp/space/check-session` | Check if Email Was Previously Verified |
| `GET /api/auth/otp/space/check-session?workspaceId={workspaceId}&sessionUuid={sessionUuid}` | Check if Current Session is Verified |
| `POST /api/auth/otp/space/send` | Send OTP Code |

```
POST /api/space/{spaceId}/register
```

---

### slack
**Category:** Communication & Collaboration
Post messages, manage channels, and track VA tasks through Slack.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/slack/channels?workspaceId=...` | List Channels |
| `POST /api/slack/messages` | Post Message |
| `POST /api/slack/tasks` | Create VA Task |
| `GET /api/slack/tasks?workspaceId=...&status=pending` | List Tasks |
| `PATCH /api/slack/tasks/:taskId` | Update Task Status |

```
GET /api/slack/channels?workspaceId=...
```

---

### stripe-payments
**Category:** General
Accept payments and subscriptions in your Space. Payments work out of the box using the platform's Stripe account, with an optional upgrade to your own Stripe Connect account.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/crm/subscribers/:workspaceId` | List Subscribers (Metadata-Based) |
| `GET /api/crm/subscribers/:workspaceId?planTier=companion` | List Subscribers (Metadata-Based) |
| `GET /api/crm/subscribers/:workspaceId?planTier=companion,guide` |  |
| `GET /api/crm/subscribers/:workspaceId?status=active` |  |
| `GET /api/crm/subscribers/:workspaceId?planTier=guide&limit=50` |  |
| `POST /api/crm/subscribers/:workspaceId/backfill` | Backfill Existing Subscribers |

```typescript
// Uses defaults: 7-day trial, $5/mo
const { checkoutUrl } = await fetch('/api/payments/subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-App-Id': window.__APP_ID__ || window.__SPACE_ID__ },
  body: JSON.stringify({
    customerEmail: 'customer@example.com',
    successUrl: window.location.origin + '/welcome',
    cancelUrl: window.location.href
  })
}).then(r => r.json());

// Redirect to Stripe Checkout
window.location.href = checkoutUrl;
```

---

### task-scheduler
**Category:** General
Send emails and schedule recurring tasks from your apps. This integration provides three capabilities:

```json
{
  "to": "user@example.com",
  "subject": "Your Weekly Digest",
  "text": "Plain text version of the email",
  "html": "<h1>HTML version</h1><p>Optional but recommended</p>",
  "replyTo": "support@yourdomain.com"
}
```

---

### web-scraping
**Category:** General
Scrape data from Instagram, LinkedIn, Amazon, websites, and more using Apify actors.

```json
{
  "actorId": "apify/instagram-scraper",
  "input": {
    "search": "fitness",
    "resultsLimit": 5,
    "searchType": "user"
  },
  "timeout": 5,
  "memory": 512,
  "parseWithGPT": false
}
```

---

### web-search
**Category:** Data & Search
Search Google for real-time web results, news, images, shopping, and academic papers.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/search` | API Endpoint |

```
POST /api/search
```

---

### workspace-community
**Category:** Social
Create shared, social experiences in your mini-apps with feeds, posts, reactions, real-time updates, and user presence (who's online). Perfect for leaderboards, team collaboration, and multiplayer features.

| Endpoint | Purpose |
|----------|--------|
| `POST /api/community/spaces` | API Endpoints |
| `GET /api/community/spaces?workspaceId=workspace-123` |  |
| `POST /api/community/spaces/:spaceId/posts` |  |
| `GET /api/community/spaces/:spaceId/posts?limit=50` |  |
| `POST /api/community/posts/:postId/reactions` |  |
| `POST /api/presence/spaces/:spaceId/join` | Presence API Endpoints |

```
POST /api/community/spaces
```

---

### workspace-db
**Category:** Data Persistence / Database
Store and query structured data in isolated PostgreSQL tables. Every workspace gets its own database schema. The SDK is auto-injected into Space apps — no imports needed.

| Endpoint | Purpose |
|----------|--------|
| `GET /api/workspaces/{workspaceId}/db/tables` | List Tables |
| `GET /api/workspaces/{workspaceId}/db/tables/{tableName}?module={module}` | Describe Table |
| `GET /api/workspaces/{workspaceId}/data/{table}?_limit=50&_offset=0&_sort=created_at&_order=desc&status=eq.active` | Query Rows |
| `POST /api/workspaces/{workspaceId}/data/{table}` | Insert Rows |
| `PATCH /api/workspaces/{workspaceId}/data/{table}/{id}` | Update Row |
| `DELETE /api/workspaces/{workspaceId}/data/{table}/{id}` | Delete Row |

```tsx
function MyComponent() {
  const { data, loading, error, total, refresh } = useWorkspaceDB('orders', {
    filters: [
      { column: 'status', operator: 'eq', value: 'active' }
    ],
    orderBy: { column: 'created_at', direction: 'desc' },
    limit: 50,
    offset: 0,
    shared: false
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <ul>{data.map(row => <li key={row.id}>{row.name}</li>)}</ul>;
}
```

---

## What Apps CANNOT Do

- **No direct database access** outside the WorkspaceDB SDK (`window.__workspaceDb` / `window.useWorkspaceDB`)
- **No server-side code execution** -- apps are client-side React components. Use `server-functions` for backend logic.
- **No direct access to API keys** -- all secrets are handled server-side via proxy endpoints
- **No file system access** -- use `file-storage` integration for persistent files
- **No direct Stripe/OpenAI/ElevenLabs API calls** -- always use the platform proxy endpoints listed above
- **No WebSocket servers** -- use `workspace-community` for real-time features
