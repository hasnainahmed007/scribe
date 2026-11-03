# BanglaScribe — Bengali Audio Transcription & Creator SaaS

BanglaScribe is an end-to-end Bengali voice-to-text transcription SaaS and YouTube creator suite. It is backed by a **Google Cloud SQL PostgreSQL** relational database in `asia-southeast1`, **Drizzle ORM**, **Sanctum-compatible Bearer token authentication**, and an **Express + TypeScript** server with **Gemini Multimodal Audio AI**.

---

### Core Architecture & Latest Enhancements

1. **Cloud SQL PostgreSQL Database**:
   - Provisioned Cloud SQL Developer instance (`ai-studio-6dc780b4`) in Google Cloud region `asia-southeast1`.
   - Relational schema defined with Drizzle ORM in `/src/db/schema.ts`:
     - `users`: ID, UID, email, hashed password, role (`superadmin` | `user`), plan ID, status, credits remaining/total/used.
     - `plans`: Pricing tiers (`Free Starter`, `Pro Creator`, `Agency Studio`), credits granted, BDT & USD pricing, features list.
     - `subscriptions`: Active subscriptions, billing interval, cycle start and end dates.
     - `payments`: Transaction ledger with payment method (bKash, Nagad, Rocket), unique transaction IDs (TrxID), and receipt amounts.
     - `usage_logs`: Real-time audit trail of transcribed audio minutes and credit deductions.

2. **History -> 1-Click YouTube SEO Auto-Generation**:
   - Clicking the YouTube action button on any past transcript in the Transcript History immediately switches to the YouTube SEO studio tab.
   - Automatically passes the historical transcript text directly into the generation pipeline, generating titles, chapters, SEO descriptions, tags, and hashtags without requiring an extra click on "Generate".

3. **Organized YouTube SEO Studio & Recent Generations Archive**:
   - Persistent Generations Archive stored in `localStorage` (`bs_recent_seo_packs`).
   - Non-blocking generation workflow: when generating a new metadata pack, the previous pack remains visible on screen with an animated progress banner above it.
   - Version switcher tabs (`Pack 1`, `Pack 2`, `Pack 3`, etc.) with timestamps and video titles, enabling creators to compare and switch between versions or clear the archive when done.
   - Added 1-click "Copy All (Titles + Desc + Tags)" button for rapid YouTube uploads.

4. **AI Thumbnail Generation & Full Custom Editing Suite**:
   - **AI Generate Thumbnail**: Endpoint `/api/generate-thumbnail-background` analyzes the video title to generate high-CTR Bengali/English headlines, subheads, viral badges, and complementary dark gradient palettes (with Imagen 3 studio background generation and high-contrast algorithmic fallbacks).
   - **Deep Custom Canvas Editing**:
     - Live 1280x720 HD Canvas preview.
     - Customizable headline text, font size slider (44px to 105px), and text stroke slider (0px to 16px).
     - Color pickers for headline, stroke, gradient start, and gradient end colors.
     - Subhead and badge text customizers.
     - Toggleable YouTube play button emblem and contrast vignette.
     - Custom background image upload/replace.
     - 1-click high-resolution PNG & JPEG export.

5. **Bangladeshi Mobile Wallet Payment System (bKash, Nagad, Rocket) with Idempotency**:
   - Removed credit card checkout entirely in favor of real Bangladeshi mobile financial services:
     - **bKash**: Dial `*247#` or app send money to `01876-543210`.
     - **Nagad**: Dial `*167#` or app send money to `01712-345678`.
     - **Rocket**: Dial `*322#` or app send money to `01912-3456789`.
   - **Idempotency Protection**: Client generates a unique UUID-based `idempotencyKey` per checkout session. The server maintains an in-memory cache with 24-hour cleanup that detects duplicate submissions and safely returns the existing confirmation without double charging or duplicate credit grants.
   - **TrxID & Phone Validation**: Enforces 11-digit Bangladeshi mobile numbers (`01XXXXXXXXX`) and verifies that TrxIDs are unique in the database to prevent duplicate receipt reuse.

6. **Strict Plan Downgrade Prevention**:
   - Enforced on both server and client:
     - **Server**: `/api/user/subscribe` checks `user.planId`. If the user is on an active paid plan (Pro Creator or Agency Studio) and attempts to select `plan-free`, the server returns HTTP 400 (`Downgrades to the Free Starter plan are not permitted for active paid subscriptions.`).
     - **Client**: `PricingModal.tsx` and `LandingPage.tsx` disable the Free Starter tier card with a locked indicator stating "Cannot Downgrade to Free" whenever an active paid subscription is detected.
