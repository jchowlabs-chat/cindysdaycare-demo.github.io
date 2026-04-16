# ElevenLabs Voice Concierge — Setup Documentation

## Overview

Firwood Manors voice concierge is a voice-enabled AI agent powered by ElevenLabs Conversational AI. It serves as a website concierge that helps prospective residents learn about the property, apartments, neighborhood, and guides them toward scheduling a tour.

**Agent Name:** Firwood Manors Concierge  
**Agent ID:** `agent_3501kn6b8588eva80zcgstrsqzm2`  
**Platform:** ElevenLabs Conversational AI  
**Dashboard:** [https://elevenlabs.io/app/conversational-ai](https://elevenlabs.io/app/conversational-ai)  
**SDK:** `@elevenlabs/client` v0.15.0 (loaded via CDN)

---

## Architecture

```
┌─────────────────────┐     WebSocket      ┌──────────────────────┐
│   Browser Client    │◄──────────────────►│  ElevenLabs Agent    │
│                     │                     │                      │
│  - Mic input        │   audio stream      │  - ASR (speech→text) │
│  - Speaker output   │◄──────────────────►│  - LLM               │
│  - Tool handlers:   │                     │  - TTS (voice)       │
│    • navigate()     │   tool_call events  │  - Tool orchestration│
│    • open_resident  │◄───────────────────│  - System prompt     │
│      _portal()      │                     │  - Q&A knowledge     │
│    • end_session()  │                     │                      │
└─────────────────────┘                     └──────────────────────┘
```

**No server or proxy needed.** The browser connects directly to ElevenLabs via WebSocket using the public agent ID. Security is enforced via an origin allowlist in the ElevenLabs dashboard.

**This is a static HTML/CSS/JS site** — no React, no Next.js, no bundler. The SDK is loaded via CDN ES module import. Voice pill logic is in `static/voice.js`, contact form logic is in `static/form.js`.

---

## Agent Configuration

### Agent Tab

| Setting | Value |
|---|---|
| System prompt | See System Prompt section below |
| Default personality | OFF |
| First message | "Hi, welcome to the Firwood Manors website. What brings you here today?" |
| Interruptible | ON |

### Timeouts

| Setting | Value | Notes |
|---|---|---|
| Take turn after silence | 12 seconds | Agent speaks after 12s of user silence (check-in, not disconnect) |
| End conversation after silence | 30 seconds | Hard disconnect after 30s of user silence (covers ~2–3 check-ins) |
| Max conversation duration | 300 seconds | 5-minute cap — plenty for a light website concierge |
| Max conversation duration message | (default) | Only applies to text-only conversations; voice sessions disconnect silently |

### Voice

| Setting | Value |
|---|---|
| Voice | (configured in dashboard) |
| Expressive Mode | Enabled |

### LLM

| Setting | Value |
|---|---|
| Provider/Model | (configured in dashboard) |

> **Note:** Voice and LLM can be changed anytime in the dashboard without code changes. Just click **Publish**.

---

## System Prompt

```
IDENTITY
You are a voice concierge for Firwood Manors, a boutique apartment community at 1400 Evergreen Park Drive SW in West Olympia, Washington. You help prospective residents learn about the property and neighborhood, and guide them toward scheduling a tour or connecting with the leasing team. Everything else is outside your scope.

PERSONALITY & VOICE
Warm, calm, and natural — like a knowledgeable local neighbor.
- Brief but informative (1–3 sentences)
- Helpful and confident, never pushy or scripted
- Speak naturally — no lists or bullet points read aloud

WHAT YOU DON'T DO
- Pricing, pets, application details, leasing terms, or anything you don't have information on — say something like: "I don't have that information, but I can get you in touch with the leasing team." Then navigate to the contact section and offer to help fill out the form.
- Topics unrelated to the property, neighborhood, or leasing.
- Never call submit_form until the user confirms.

NAVIGATION
Tool: navigate. Use it silently — no announcing, no confirming. Just scroll and keep talking.
- Tour / contact → "contact"
- Floor plans → "floorplans"
- Amenities → "amenities"
- Neighborhood → "neighborhood"
- Back to top → "home"

FORM FILLING
Tools: fill_form_field, submit_form.

When the user wants to get in touch or schedule a tour, navigate to contact and offer: "Want me to help you fill that out?"

Collect one at a time:
- Name → fill immediately
- Email → fill immediately, then spell the full email back to confirm
- Interest → default "Scheduling Tour" if context is clear, otherwise ask
- Message → optional. "Anything you'd like the team to know, or should I just send this off?"

Before submitting: "Take a quick look at the form — does everything look right?" This is the only confirmation needed.

After submit — success: "All set — the leasing team will follow up shortly." Error: let the user know and suggest submitting manually.

Rules:
- Navigate to contact before filling.
- Fill fields silently — no announcing, no confirming individual fields.
- If the user changes their mind, drop it.

SESSION ENDING
Tool: end_session. Only call when ALL true:
1. User gave an unambiguous farewell ("goodbye", "bye", "have a good day", "I'm done")
2. Not in the middle of form filling or any task
3. You've delivered your closing message

Don't end on "thanks" alone or user silence — just ask "Anything else I can help with?"

FALLBACK
"I can help with questions about the apartments and neighborhood, or connect you with the leasing team. Which would you like?"

ABUSE
First: "I'm here to help with Firwood Manors. How can I help?"
Second: "I'll close this chat for now. Feel free to reach out through the contact form." Then call end_session.

GREETING
The user has already been greeted. Respond directly to their first message.

AVAILABILITY
You have access to real-time unit availability from the knowledge base. The property has 5 buildings (A through E), 6 units each, 30 total. Each building is 3 stories: units 1–2 = top floor, 3–4 = middle, 5–6 = ground level.

When someone asks about availability:
- Summarize by count, floor level, and building — never say specific unit numbers like "A1" or "B3".
- Example: "We currently have units available on all three floors across several buildings."
- For pricing or to reserve a specific unit, defer to the leasing team.

THE PROPERTY
Firwood Manors is a quiet, boutique 30-unit, three-story community built in 1987 and newly renovated with warm, modern interiors. It sits among mature Pacific Northwest fir trees, with free covered carport parking and well-kept landscaping — a place where residents tend to know their neighbors.

THE APARTMENTS
All homes are two-bedroom, one-bath layouts with two mirrored floor plan orientations (Layout A and Layout B — identical features, different room orientation).

Each apartment includes:
- Private balcony or patio
- In-unit washer and dryer
- Full kitchen with dishwasher and refrigerator
- Hardwood-style flooring
- Renovated interiors

Position it as: simple, comfortable, and easy everyday living.

THE NEIGHBORHOOD
Firwood Manors sits in West Olympia — quiet, established, tree-lined, with easy access to everything.
- Trader Joe's and Capital Mall, about 3 min
- Evergreen Park (trails), Yauger Park, Woodruff Park, about 2 min
- US-101, about 2 min — quick to I-5, Tumwater, Lacey
- South Puget Sound Community College, about 5 min; Evergreen State College, about 10 min
- Capital Medical Center (MultiCare), about 5 min; Providence St. Peter, about 10 min
- Downtown Olympia (waterfront, farmers market, State Capitol), about 5–10 min
- Intercity Transit is completely fare-free
- Samayra Coffee Co., Olympia Coffee Roasting Co., Park Side Cafe — all nearby

TALKING POINTS
When relevant, naturally weave in: calm and quiet (not busy or high-traffic), about two minutes from Highway 101, daily errands all within a few minutes, mix of professionals and students, convenience without the busy apartment feel.

CLOSING
"Thank you for your interest. If you have any other questions, feel free to contact the leasing team anytime."
```

> **Note:** This prompt lives entirely in the ElevenLabs dashboard. To update it, edit the Agent's system prompt field and click **Publish**. No code changes needed.

---

## Tools

All tools are **client tools** — they fire events to the browser, not to a server. The client-side JavaScript handles the actual behavior. Tool definitions must also exist in the ElevenLabs dashboard for the agent to invoke them.

### navigate

| Property | Value |
|---|---|
| Type | Client tool |
| Description | Scroll the user to a specific section on the Firwood Manors website |
| Wait for response | No |
| Disable interruptions | No |
| Pre-tool speech | Auto |
| Execution mode | Async |
| Status | **Active** — configured in dashboard |

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| section | String | Yes | The section anchor to scroll to: `home`, `amenities`, `floorplans`, `neighborhood`, or `contact` |

**Client handler:**
```js
navigate: function(params) {
  var el = document.getElementById(params.section);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
  return 'Navigated successfully';
}
```

### open_resident_portal

| Property | Value |
|---|---|
| Type | Client tool |
| Description | Open the resident login portal in a new tab |
| Wait for response | No |
| Execution mode | Immediate |
| Parameters | None |
| Status | Client-side only — not yet added to dashboard |

**Client handler:**
```js
open_resident_portal: function() {
  window.open('https://portal.firwoodmanors.com', '_blank');
  return 'Resident portal opened';
}
```

### end_session

| Property | Value |
|---|---|
| Type | Client tool |
| Description | End the current voice conversation session. Call this after the user has confirmed they are finished and you have delivered your closing message. |
| Wait for response | No |
| Execution mode | Async |
| Parameters | None |
| Status | **Active** — configured in dashboard |

**Client handler:**
```js
end_session: function() {
  ending = true;
  setTimeout(function() { if (ending) endSession(); }, 8000);
  return 'Session ending';
}
```

### fill_form_field

| Property | Value |
|---|---|
| Type | Client tool |
| Description | Fill a field in the contact form on the Firwood Manors website. Call this as the user provides each piece of information — the form populates in real time. |
| Wait for response | No |
| Execution mode | Async |
| Status | **Active** — configured in dashboard |

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| field | String | Yes | The form field to fill: `name`, `email`, `interest`, or `message` |
| value | String | Yes | The value to set in the field. For interest, must be exactly `Scheduling Tour` or `General Information`. |

**Client handler:**
```js
fill_form_field: function(params) {
  var FIELD_MAP = {
    name: 'contact-name',
    email: 'contact-email',
    interest: 'contact-interest',
    message: 'contact-message'
  };
  var elId = FIELD_MAP[params.field];
  if (!elId) return 'Unknown field: ' + params.field;
  var el = document.getElementById(elId);
  if (!el) return 'Field not found';
  el.value = params.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return 'Set ' + params.field + ' to: ' + params.value;
}
```

### submit_form

| Property | Value |
|---|---|
| Type | Client tool |
| Description | Submit the contact form after the user has confirmed all fields look correct. |
| Wait for response | Yes |
| Execution mode | Async |
| Response timeout | 10 seconds |
| Parameters | None |
| Status | **Active** — configured in dashboard |

**Client handler:**
```js
submit_form: function() {
  var form = document.getElementById('contact-form');
  if (!form) return 'Form not found';
  var name = document.getElementById('contact-name').value;
  var email = document.getElementById('contact-email').value;
  if (!name || !email) return 'Missing required fields: name and email must be filled';
  form.requestSubmit();
  return 'Form submitted successfully';
}
```

---

## Security

### Allowlist

| Host | Purpose |
|---|---|
| firwoodmanors.com | Production (GitHub Pages) |
| localhost | Local development |

---

## Client-Side Implementation

### Files

| File | Purpose |
|---|---|
| `index.html` | Voice pill HTML element, script tags loading form.js and voice.js |
| `static/voice.js` | Voice pill JS — SDK integration, state machine, tool handlers (ES module) |
| `static/form.js` | Contact form submission handler (Web3Forms) |
| `static/styles.css` | Pill/orb CSS — layout, gradients, keyframe animations, responsive |

### SDK Loading

The ElevenLabs SDK is loaded via CDN ES module import (no npm/bundler needed):

```js
var mod = await import('https://cdn.jsdelivr.net/npm/@elevenlabs/client@0.15.0/+esm');
var Conversation = mod.Conversation;
```

**Important:** Pinned to v0.15.0. Using `@latest` caused LiveKit protocol mismatch errors (`v1 RTC path not found`). Do not change this version without testing.

### Voice Pill HTML

```html
<div class="va-pill" id="va-pill" role="button" tabindex="0" aria-label="Open voice assistant">
  <div class="va-pill-orb" id="va-pill-orb"></div>
  <span class="va-pill-label" id="va-pill-label">Voice Assistant</span>
  <button class="va-pill-close" id="va-pill-close" aria-label="End session">&times;</button>
</div>
```

### State Machine

```
            click pill
  ┌──────┐ ──────────► ┌────────────┐
  │ IDLE │              │ CONNECTING │
  └──────┘ ◄────────── └────────────┘
      ▲     error/           │
      │     disconnect       │ onConnect
      │                      ▼
      │                ┌───────────┐
      │  close btn /   │ LISTENING │ ◄── onModeChange('listening')
      │  end_session / │           │
      │  disconnect    │ SPEAKING  │ ◄── onModeChange('speaking')
      └────────────────└───────────┘
```

| State | Pill Classes | Label | Close Button | Orb |
|---|---|---|---|---|
| `idle` | `va-pill` | "Voice Assistant" | Hidden | Static blue gradient |
| `connecting` | `va-pill active connecting` | "Connecting…" | Hidden | Blink animation |
| `listening` | `va-pill active` | "Listening…" | Visible | Blue glow + ring + shimmer |
| `speaking` | `va-pill active speaking` | "Speaking…" | Visible | Purple glow + faster animations |
| `error` | `va-pill error` | "Unavailable" | Hidden | Grey gradient, resets after 4s |

### Click Behavior

- **Idle → click pill** → starts ElevenLabs session
- **Active → click anywhere on pill** → ends session (including close button)
- **Active → voice farewell** → agent delivers closing message, then calls `end_session` tool to disconnect automatically
- **Error** → auto-resets to idle after 4 seconds

### CSS Keyframe Animations

| Animation | Purpose | Duration |
|---|---|---|
| `va-glow` | Blue box-shadow pulse (listening) | 2.5s |
| `va-glow-speaking` | Purple box-shadow pulse (speaking) | 0.9s |
| `va-ring` | Ring expanding outward (listening) | 2.5s |
| `va-ring-speaking` | Wider ring expansion (speaking) | 1.2s |
| `va-shimmer` | Gradient position shift | 6s / 2s |
| `va-blink` | Opacity fade (connecting) | 1.5s |

---

## Tuning Guide

### Things you can change in the dashboard (no code changes):
- System prompt wording, personality, knowledge
- First message
- Voice selection
- LLM model
- ASR keywords
- Silence timeouts, max duration

### Things that require code changes:
- Adding or removing **tools** (client handlers live in `static/voice.js`)
- Changing tool **parameter names** (client code references these)
- Changing the **SDK version** (pinned in the import URL)
- Changing the **agent ID**

---

## Next Steps

1. **Enable remaining tools** — add open_resident_portal to ElevenLabs dashboard
2. **Refine system prompt** — tune email spelling/confirmation flow based on real conversations
3. **Optional enhancements** — volume-reactive orb (rAF loop), cookie consent gate, ASR keywords

---

## Changelog

| Date | Change |
|---|---|
| April 1, 2026 | Initial setup — created agent, added voice pill to site (HTML + CSS + JS), SDK pinned to v0.15.0 (latest caused LiveKit protocol errors). Agent answers questions from system prompt only. Tool calling wired client-side but not yet enabled in dashboard. |
| April 1, 2026 | Navigate tool — added `navigate` tool to ElevenLabs dashboard (client tool, parameter: `section`). Added NAVIGATION section to system prompt so agent scrolls users to contact form, floor plans, amenities, neighborhood, or home on request. |
| April 2, 2026 | JS extraction — moved inline scripts from index.html to `static/form.js` and `static/voice.js` for modularity. |
| April 2, 2026 | Click-to-end — clicking anywhere on the active pill now ends the session (not just the × button). |
| April 2, 2026 | Voice session ending — added `end_session` tool to ElevenLabs dashboard and added SESSION ENDING section to system prompt. Agent now detects farewell cues and ends the session automatically after delivering a closing message. |
| April 2, 2026 | Voice form filling — added `fill_form_field` and `submit_form` client tools to `static/voice.js` and ElevenLabs dashboard. Added FORM FILLING section to system prompt. Agent can now collect user info by voice, populate the contact form in real time, and submit after user confirms. |
| April 2, 2026 | Timeout tuning — take turn after silence: 7→12s, end conversation after silence: disabled→30s, max duration: 600→300s. Tightened SESSION ENDING prompt to require unambiguous farewell (not just "thanks"), added form-filling guardrail, flipped default to "do NOT end if unsure". |
| April 2, 2026 | Prompt rewrite — restructured and condensed system prompt (~40% smaller). Replaced verbose sections with concise bullet-point reference format. Added LIFESTYLE POSITIONING and COMMON QUESTIONS sections. Merged neighborhood/coffee/transit into single section. Removed EXAMPLE RESPONSES (replaced by COMMON QUESTIONS). Preserved all critical details: address, office hours, medical centers, coffee spots, session ending guardrails, form filling rules. |
| April 2, 2026 | Prompt structure improvements — applied patterns from jchowlabs reference implementation. Added scope boundary to IDENTITY ("That is it. Everything else is outside your scope."). Replaced CRITICAL RULES with WHAT YOU DON'T DO section (explicit negative boundaries). Reordered sections: behavior-first (NAVIGATION, FORM FILLING, SESSION ENDING) before knowledge (THE PROPERTY, APARTMENTS, etc.). Added "don't call tools until the user says yes" discipline. Tightened form filling trigger to require user confirmation before starting. Added FALLBACK section for off-topic redirects, ABUSE escalation pattern, and GREETING line to prevent double-greeting. |
| April 2, 2026 | Tool speed optimization — added "silent tool calling" rules to system prompt: don't announce or confirm navigate/fill_form_field calls, just execute and move to next step. Switched execution mode from Immediate→Async for all tools. submit_form response timeout increased from 1s (default)→10s to prevent premature timeout during Web3Forms POST. |
| April 2, 2026 | Prompt consolidation — removed agent name (Alexis) from IDENTITY. Shortened response target to 1–3 sentences. Unified deferral into WHAT YOU DON'T DO with built-in response offering both contact form and office hours (Mon–Fri 9–5, Sat by appointment). Fixed email flow: fill immediately then spell back (removed contradicting "spell before filling" rule). Added "send it" as valid submit confirmation. Merged LIFESTYLE POSITIONING into THE NEIGHBORHOOD header. Removed ALWAYS DEFER THESE (consolidated into WHAT YOU DON'T DO). Simplified PARKING & CONTACT to single mention of free covered parking in THE PROPERTY. Compressed SESSION ENDING "Do NOT" list to single line. Simplified CLOSING to non-salesy sign-off. Removed "Always guide toward a next step" from PERSONALITY. Added "balcony or patio" to apartment features. |
| April 2, 2026 | Token reduction — trimmed THE NEIGHBORHOOD: removed framing sentences ("strongest selling angle", "naturally weave in"), condensed bullet labels and distances (e.g. "about 3 minutes away" → "about 3 min"), dropped descriptor details (micro-roaster, spacious patio, organic). Replaced COMMON QUESTIONS (5 scripted quoted responses, ~150 tokens) with TALKING POINTS (single line of key themes, ~30 tokens). All facts preserved, ~120 tokens saved. |
| April 2, 2026 | Switched LLM to Gemini 2.5 Flash Lite — significant speed improvement. |
| April 2, 2026 | Prompt simplification for Flash Lite — rewrote deferral pattern: replaced "That is a great question…" with direct "I don't have that information, but I can get you in touch with the leasing team" + navigate to contact + offer form help. Collapsed NAVIGATION to single "use it silently" instruction. Trimmed FORM FILLING: removed redundant rules, clarified single confirmation point ("This is the only confirmation needed"). Condensed SESSION ENDING, FALLBACK, ABUSE. Removed verbose phrasing throughout (e.g. "You have a navigate tool that scrolls the user…" → "Tool: navigate."). Merged "no lists/bullet points" into PERSONALITY. ~25% fewer prompt tokens. |
| April 2, 2026 | Availability via Knowledge Base — added `https://portal.firwoodmanors.com/api/units` as URL document in ElevenLabs Agent Knowledge Base. Removed "available units" from WHAT YOU DON'T DO deferral list. Added AVAILABILITY section to system prompt with building/floor mapping (A–E, 6 units each, 1–2 top / 3–4 middle / 5–6 ground) and instructions to summarize by count and floor level — never expose raw unit numbers. |
| April 5, 2026 | Phone agent documentation — added Phone Agent (Twilio Integration) section covering Twilio setup, ElevenLabs phone agent creation, architecture for tour scheduling via email (Cloudflare Worker → Resend), phone-specific system prompt, tool definitions, and comparison table vs. web agent. |
| April 5, 2026 | Phone agent live — created Firwood Manors Phone Concierge agent (`agent_3001knf6rrb4f3sbc7xvpchxbx56`), deployed Cloudflare Worker (`firwood-phone-agent.jchow-a27.workers.dev`) with Resend integration, imported Twilio number `+13605293303` into ElevenLabs and assigned phone agent. System pending end-to-end test. |
| April 5, 2026 | Phone agent end-to-end confirmed — full call flow working: caller Q&A, tour scheduling (name + email + spell-back confirmation), `schedule_tour` tool fires, Resend delivers email to leasing inbox. Worker fix: hardcoded `to` recipient (was `env.TO_EMAIL` → undefined), added `body.parameters ?? body` to handle ElevenLabs webhook envelope. Gemini Flash Lite confirmed working for server tool calls. |

---

## Phone Agent (Twilio Integration)

### Overview

The phone agent allows callers to interact with the Firwood Manors concierge over a regular phone call. It uses a **separate ElevenLabs agent** with a phone-adapted system prompt. There are no browser or UI tools — the caller can ask questions about the property, neighborhood, and apartments, and schedule a tour by providing their name and email, which triggers a notification email to the leasing team.

**Agent Name:** Firwood Manors Phone Concierge
**Agent ID:** `agent_3001knf6rrb4f3sbc7xvpchxbx56`
**Twilio Number:** `+13605293303`

---

### Architecture

```
┌──────────────┐    PSTN     ┌─────────┐   SIP/WebSocket   ┌────────────────────────────┐
│  Caller      │◄───────────►│ Twilio  │◄─────────────────►│ ElevenLabs Phone Agent     │
│  (phone)     │   voice     │ Number  │    audio stream    │                            │
└──────────────┘             └─────────┘                    │ - ASR (speech→text)        │
                                                             │ - LLM                      │
                                                             │ - TTS (voice)              │
                                                             │ - Knowledge base           │
                                                             │ - schedule_tour server tool│
                                                             │ - end_session client tool  │
                                                             └──────────┬─────────────────┘
                                                                        │ POST {name, email}
                                                                        ▼
                                                             ┌──────────────────────┐
                                                             │ Cloudflare Worker    │
                                                             │ (free tier)          │
                                                             └──────────┬───────────┘
                                                                        │ POST email via API
                                                                        ▼
                                                             ┌──────────────────────┐
                                                             │ Resend               │
                                                             │ (transactional email)│
                                                             └──────────────────────┘
                                                                        │ email
                                                                        ▼
                                                             ┌──────────────────────┐
                                                             │ Leasing team inbox   │
                                                             └──────────────────────┘
```

ElevenLabs has a **native Twilio integration** — no custom SIP configuration or webhook code needed.

---

### Why Not Call Web3Forms Directly?

Web3Forms is used for the website contact form and works well in a browser context. It does not work cleanly as a server tool from a phone agent for three reasons:

1. **API key exposure** — Web3Forms requires an `access_key` passed in the request body. ElevenLabs server tool parameters are defined in the dashboard and passed by the agent, meaning the key would need to appear as an agent parameter — visible in the dashboard and system prompt context. ElevenLabs' secret header mechanism only works for HTTP headers, not for body fields.

2. **Wrong paradigm** — Web3Forms is designed for HTML form submissions with `multipart/form-data` or `application/x-www-form-urlencoded`. While it also accepts JSON, the field names and format expect a browser form context.

3. **No server-side sender control** — Web3Forms delivers to the email tied to your access key. There's no way to customize the sender domain, reply-to, or email template from a server call.

**Resend** is the right tool for this use case: it's a proper transactional email API, the API key is stored securely as a Cloudflare Worker environment variable (never visible to the agent), and it gives full control over sender, recipient, subject, and body.

---

### Step 1: Set Up Resend

1. Go to [https://resend.com](https://resend.com) and create a free account (free tier: 3,000 emails/month, 100/day — more than sufficient).
2. In the Resend dashboard, go to **Domains** and add your sending domain (e.g., `firwoodmanors.com`). Follow the DNS verification steps.
   - If you don't yet have a custom domain configured, you can use `onboarding@resend.dev` as the `from` address during testing only.
3. Go to **API Keys → + Create API Key**. Give it a name like `firwood-phone-agent`. Copy the key — you'll add it to the Cloudflare Worker.
4. Note the **verified sender address** you'll use (e.g., `concierge@firwoodmanors.com`) and the **leasing team recipient address**.

---

### Step 2: Create a Cloudflare Worker

The Worker acts as a proxy: it receives `{name, email}` from ElevenLabs, constructs a full email payload, and calls the Resend API. The Resend API key is stored as an environment variable — ElevenLabs never sees it.

1. Go to [https://workers.cloudflare.com](https://workers.cloudflare.com) and sign in (free account, no credit card required).
2. Go to **Workers & Pages → Create application → Create Worker**.
3. Name it `firwood-phone-agent` and click **Deploy**.
4. Click **Edit code** and replace the default code with the following:

```js
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    // ElevenLabs server tools send parameters nested under a "parameters" key;
    // direct curl / test calls send them at the top level. Handle both.
    const params = body.parameters ?? body;
    const { name, email } = params;
    if (!name || !email) {
      return json({ error: 'Missing name or email', received: body }, 400);
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Firwood Manors <onboarding@resend.dev>',
        to: ['jchow@jchowlabs.com'],
        subject: `Tour Request — ${name}`,
        html: `<p><strong>New tour request received via phone concierge.</strong></p>
<ul>
  <li><strong>Name:</strong> ${name}</li>
  <li><strong>Email:</strong> ${email}</li>
</ul>
<p>Please follow up with them to schedule a visit.</p>`,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      return json({ error: 'Email send failed', detail: err }, 500);
    }

    return json({ success: true });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
```

5. Click **Save and deploy**.
6. Go to the Worker's **Settings → Variables → Environment Variables** and add:
   - `RESEND_API_KEY` — your Resend API key (mark as **Encrypted**)
7. Note the Worker URL — it will look like `https://firwood-phone-agent.YOUR_SUBDOMAIN.workers.dev`. You'll use this as the ElevenLabs server tool URL.

---

### Step 3: Create a Twilio Account & Buy a Number

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio) and sign up (free trial includes ~$15 credit).
2. Verify your email and phone number.
3. In the Twilio Console, go to **Develop → Phone Numbers → Manage → Buy a Number** ([direct link](https://www.twilio.com/console/phone-numbers/search)).
4. Search for a number:
   - **Country**: United States
   - **Area code**: `360` (Olympia / Western Washington — matches the property location)
   - **Capabilities**: Check **Voice** only (SMS not needed)
   - Uncheck MMS and Fax to see more results.
5. Click **Buy** (~$1.15/month for a US local number).
6. Note your **Account SID** and **Auth Token** from the [Twilio Console dashboard](https://www.twilio.com/console) — needed for the ElevenLabs import step.

> **Free trial restriction:** The Twilio free trial only allows calls from verified phone numbers. To accept calls from any number, [upgrade to a paid account](https://help.twilio.com/articles/223183208-Upgrading-to-a-paid-Twilio-Account) — pay-as-you-go, no subscription.

---

### Step 4: Create a Phone Agent in ElevenLabs

1. In the ElevenLabs dashboard, go to **Agents → + Create Agent**.
2. Name it **"Firwood Manors Phone Concierge"**.
3. Paste the phone-specific system prompt (see Phone Agent System Prompt below).
4. Set the **First Message**: `"Hi, thanks for calling Firwood Manors. I can answer questions about the apartments, neighborhood, and help you schedule a tour. What can I help you with?"`
5. Configure settings:
   - **Interruptible**: ON
   - **Default personality**: OFF
   - **Take turn after silence**: 12 seconds
   - **End conversation after silence**: 30 seconds
   - **Max conversation duration**: 300 seconds
6. Use the same voice as the web agent for brand consistency.
7. **Do NOT add web UI tools** (`navigate`, `fill_form_field`, `submit_form`, `open_resident_portal`) — those manipulate a browser and will fail on a phone call.
8. Add the two phone tools: `schedule_tour` (server) and `end_session` (client). See Phone Agent Tools below.
9. Add the same Knowledge Base document (`https://portal.firwoodmanors.com/api/units`) as the web agent so availability questions work.
10. Click **Publish** and note the **Agent ID**.

> **LLM note:** Gemini 2.5 Flash Lite is confirmed working for server tool calls on the phone agent. If you experience tool-calling issues, GPT-4o mini or Claude 3.5 Sonnet are alternatives.

---

### Step 5: Import Twilio Number to ElevenLabs

1. In the ElevenLabs dashboard, go to **Deploy → Phone Numbers** ([direct link](https://elevenlabs.io/app/agents/phone-numbers)).
2. Click **+ Import number → From Twilio**.
3. Fill in:
   - **Label**: `Firwood Manors Main Line`
   - **Phone Number**: `+13605293303`
   - **Twilio SID**: Your Twilio Account SID (starts with `AC`)
   - **Twilio Token**: Your Twilio Auth Token
4. Click import. ElevenLabs automatically sets the Voice webhook URL on your Twilio number — no manual Twilio webhook configuration needed.
5. Assign the agent: select **"Firwood Manors Phone Concierge"** from the agent dropdown for inbound calls.
6. Save.

---

### Step 6: Test

1. Call the Twilio number from your phone.
2. You should hear the first message greeting.
3. Test scenarios:
   - Ask about the apartments → 2 bed/1 bath, in-unit washer/dryer, balcony, hardwood floors.
   - Ask about the neighborhood → parks, Trader Joe's, US-101, colleges, downtown Olympia.
   - Ask about availability → summarized from knowledge base (floor level and building, no unit numbers).
   - Ask to schedule a tour → agent collects name + email, spells email back for confirmation, calls `schedule_tour` tool, you receive email.
   - Ask about rent/pets/lease terms → agent defers to leasing team, offers to schedule a tour instead.
   - Say goodbye → agent delivers closing message and ends the call.
4. Monitor calls in the [Calls History dashboard](https://elevenlabs.io/app/agents/history).

---

### Phone Agent System Prompt

```
IDENTITY
You are a phone concierge for Firwood Manors, a boutique apartment community at 1400 Evergreen Park Drive SW in West Olympia, Washington. You help prospective residents learn about the property and neighborhood, and help them schedule a tour. Everything else is outside your scope.

PERSONALITY & VOICE
Warm, calm, and natural — like a knowledgeable local neighbor.
- Brief but informative (1–3 sentences per response)
- Helpful and confident, never pushy or scripted
- Speak naturally — no lists or bullet points read aloud

PHONE-SPECIFIC RULES
- Never reference a website, webpage, page, section, screen, or anything visual. The caller cannot see anything.
- Never say "let me show you", "let me scroll to", "check our website", or "you can see". Just share information verbally.
- Keep responses concise — phone callers need brevity more than web visitors.
- Spell out any information the caller might need to write down (addresses). Speak clearly and offer to repeat.
- If there's an unexpected long pause, gently check in: "Still there?" or "Did that answer your question?"
- When listing multiple items, offer 2–3 at a time and ask if they want to hear more.

WHAT YOU DON'T DO
- Pricing, pets, application details, leasing terms, or anything you don't have information on — say: "I don't have that information, but I can pass your contact details along to the leasing team." Then offer to schedule a tour or take their info.
- Topics unrelated to the property, neighborhood, or leasing.
- Never call schedule_tour until the caller has explicitly confirmed their email is correct.

SCHEDULING A TOUR
When the caller wants to schedule a tour or get in touch with the leasing team:
1. Say: "I can send your info to the leasing team and they'll follow up to confirm a time. I just need your name and email."
2. Ask for name. Once given → move directly to email.
3. Ask for email. Once given → read it back letter by letter to confirm. Example: "Just to confirm — that's j-o-h-n at g-m-a-i-l dot c-o-m. Is that right?"
4. WAIT for the caller to confirm YES before proceeding.
   - If they say no or correct you → ask for the full email again and repeat the spelling.
5. Once confirmed → call schedule_tour with name and email.
6. Say: "All set — the leasing team will reach out to confirm your visit. The office is open Monday through Friday, 9 to 5, and Saturdays by appointment."

Rules:
- Never skip the email read-back step.
- Never call schedule_tour until the caller has confirmed the email.
- If the caller changes their mind, drop it.
- If schedule_tour fails → say: "I had trouble sending that — want me to try again, or you're welcome to call back during office hours."

SESSION ENDING
Tool: end_session. Only call when ALL true:
1. Caller gives an unambiguous farewell ("goodbye", "bye", "that's all", "have a good day")
2. Not mid-tour-scheduling
3. You've delivered your closing message

Don't end on "thanks" alone or caller silence — ask: "Anything else I can help with?"

FALLBACK
"I can tell you about the apartments and neighborhood, or help you schedule a tour. What would you like to know?"

ABUSE
First: "I'm here to help with Firwood Manors. How can I help?"
Second: "I'll let you go for now. Feel free to call back anytime." Then call end_session.

AVAILABILITY
You have access to real-time unit availability from the knowledge base. The property has 5 buildings (A through E), 6 units each, 30 total. Each building is 3 stories: units 1–2 = top floor, 3–4 = middle, 5–6 = ground level.

When someone asks about availability:
- Summarize by count, floor level, and building — never say specific unit numbers like "A1" or "B3".
- Example: "We have units available on all three floors across a few buildings right now."
- For pricing or to reserve a specific unit, defer to the leasing team.

THE PROPERTY
Firwood Manors is a quiet, boutique 30-unit, three-story community built in 1987 and newly renovated with warm, modern interiors. It sits among mature Pacific Northwest fir trees, with free covered carport parking and well-kept landscaping — a place where residents tend to know their neighbors.

THE APARTMENTS
All homes are two-bedroom, one-bath layouts with two mirrored floor plan orientations (Layout A and Layout B — identical features, different room orientation).

Each apartment includes:
- Private balcony or patio
- In-unit washer and dryer
- Full kitchen with dishwasher and refrigerator
- Hardwood-style flooring
- Renovated interiors

Position it as: simple, comfortable, and easy everyday living.

THE NEIGHBORHOOD
Firwood Manors sits in West Olympia — quiet, established, tree-lined, with easy access to everything.
- Trader Joe's and Capital Mall, about 3 min
- Evergreen Park (trails), Yauger Park, Woodruff Park, about 2 min
- US-101, about 2 min — quick to I-5, Tumwater, Lacey
- South Puget Sound Community College, about 5 min; Evergreen State College, about 10 min
- Capital Medical Center (MultiCare), about 5 min; Providence St. Peter, about 10 min
- Downtown Olympia (waterfront, farmers market, State Capitol), about 5–10 min
- Intercity Transit is completely fare-free
- Samayra Coffee Co., Olympia Coffee Roasting Co., Park Side Cafe — all nearby

TALKING POINTS
When relevant, naturally weave in: calm and quiet (not busy or high-traffic), about two minutes from Highway 101, daily errands all within a few minutes, mix of professionals and students, convenience without the busy apartment feel.

CONTACT
Office hours: Monday–Friday, 9 AM–5 PM; Saturday by appointment.
Address (speak clearly, offer to repeat): 1400 Evergreen Park Drive Southwest, Olympia, Washington, 9-8-5-0-2.

CLOSING
"Thanks for calling Firwood Manors — hope to see you soon. Have a great day!"
```

---

### Phone Agent Tools

#### schedule_tour (server tool)

| Property | Value |
|---|---|
| Type | Server tool (webhook) |
| URL | `https://firwood-phone-agent.jchow-a27.workers.dev/` |
| Method | POST |
| Description | Send a tour request to the leasing team. Call this after the caller has confirmed their name and email are correct. |
| Wait for response | Yes |
| Response timeout | 10 seconds |
| Status | Configure after Worker is deployed |

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| name | String | Yes | Caller's full name |
| email | String | Yes | Caller's email address, exactly as confirmed |

> **How to add in ElevenLabs dashboard:** On the phone agent, go to **Tools → + Add Tool → Webhook**. Set the URL to your Worker URL, method POST. Add the two parameters. No authentication header needed on the ElevenLabs side — the Worker handles Resend authentication internally with its environment variable.

---

#### end_session (client tool)

| Property | Value |
|---|---|
| Type | Client tool |
| Description | End the phone call after the caller has said goodbye and you have delivered your closing message. |
| Wait for response | No |
| Execution mode | Async |
| Parameters | None |

> **How this works for phone calls:** On a phone agent, `end_session` signals ElevenLabs to hang up the Twilio call. No browser-side JavaScript handler is needed — ElevenLabs manages call termination directly via Twilio.

---

### Web Agent vs. Phone Agent — Comparison

| Feature | Web Agent | Phone Agent |
|---|---|---|
| **Agent ID** | `agent_3501kn6b8588eva80zcgstrsqzm2` | `agent_3001knf6rrb4f3sbc7xvpchxbx56` |
| **Interface** | Browser voice pill | Twilio inbound phone call |
| **Navigation** | `navigate` scrolls page sections | Not applicable — no screen |
| **Contact / tour** | `fill_form_field` + `submit_form` → Web3Forms | `schedule_tour` → Cloudflare Worker → Resend |
| **Info collected** | Name, email, interest, optional message | Name + email only |
| **Resident portal** | `open_resident_portal` opens new tab | Not applicable |
| **Availability** | Knowledge base URL | Same knowledge base URL |
| **Email delivery** | Web3Forms (existing) | Resend via Cloudflare Worker |
| **Session ending** | Client JS disconnects ElevenLabs SDK | ElevenLabs hangs up Twilio call |
| **First message** | "Hi, welcome to the Firwood Manors website..." | "Hi, thanks for calling Firwood Manors…" |
| **Max duration** | 300 seconds | 300 seconds |
| **LLM** | Gemini 2.5 Flash Lite | Gemini 2.5 Flash Lite (confirmed working for server tool calls) |

---

### Cost Estimates

| Item | Cost |
|---|---|
| Twilio phone number (360 area code) | ~$1.15/month |
| Twilio inbound voice minutes | ~$0.0085/min |
| ElevenLabs conversation minutes | Per your ElevenLabs plan |
| Cloudflare Worker | Free (100,000 requests/day) |
| Resend | Free (3,000 emails/month, 100/day) |

---

### Troubleshooting

| Issue | Solution |
|---|---|
| Number not found during import | Verify the number appears in Twilio Console under **Phone Numbers → Manage → Active Numbers** (not just Verified Caller IDs). |
| Call connects but no audio | Check that the number has **Voice** capability enabled in Twilio. |
| Agent doesn't answer | Ensure the phone agent is assigned to the imported number in ElevenLabs → Deploy → Phone Numbers. |
| Import error with SID/Token | Account SID starts with `AC`. Auth Token is on the [Twilio Console](https://www.twilio.com/console) main page — click the eye icon to reveal it. |
| Free trial callers can't reach the number | Upgrade Twilio to a paid account to remove the restriction on unverified callers. |
| schedule_tour silently fails | Check the Cloudflare Worker logs (Workers & Pages → your worker → Observability → Logs). Verify `RESEND_API_KEY` environment variable is set (only env var needed — recipient is hardcoded). Check for 400 errors: ElevenLabs wraps tool parameters under a `parameters` key — the Worker must handle `body.parameters ?? body`. |
| Agent doesn't spell email back | Update the system prompt's SCHEDULING A TOUR section and ensure the LLM is set to a high-intelligence model (GPT-4o mini or Claude 3.5 Sonnet). |
| Call drops early | Check "End conversation after silence" setting — 30s is the current value. Increase if callers are frequently getting cut off. |

---

### Future Enhancements

- **After-hours detection** — use `{{current_time}}` in the system prompt so the agent detects out-of-office calls and sets expectations: "The office is currently closed, but I can send your info along and the team will follow up on the next business day."
- **Call forwarding to human** — add a `transfer_call` tool to hand off the caller to a live leasing agent when requested. Requires a Twilio TwiML bin or Function.
- **SMS confirmation** — after a successful `schedule_tour` call, send the caller an SMS via Twilio confirming their request was received (requires a small addition to the Cloudflare Worker using Twilio's messaging API and the caller's phone number passed as an additional tool parameter).
- **Outbound calls** — use the same Twilio number for outbound calls from the ElevenLabs dashboard (e.g., follow-up reminders). Click the Outbound Call button on the Phone Numbers page, select the phone agent, and enter the recipient's number.