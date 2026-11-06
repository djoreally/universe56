import { check as gmailCheck } from "./reach/gmail";
import { check as agentmailCheck } from "./reach/agentmail";
import { check as enginemailerCheck } from "./reach/enginemailer";
import { check as telnyxCheck } from "./reach/telnyx";
import { check as agentphoneCheck } from "./reach/agentphone";
import { check as screenmycalls_voiceCheck } from "./reach/screenmycalls-voice";
import { check as thanksioCheck } from "./reach/thanksio";
import { check as zernioCheck } from "./reach/zernio";
import { check as postformeCheck } from "./reach/postforme";
import { check as facebookCheck } from "./studio/facebook";
import { check as instagramCheck } from "./studio/instagram";
import { check as instagram_messagesCheck } from "./studio/instagram-messages";
import { check as figmaCheck } from "./studio/figma";
import { check as spotifyCheck } from "./studio/spotify";
import { check as mediavaultCheck } from "./studio/mediavault";
import { check as google_docsCheck } from "./ops/google-docs";
import { check as google_driveCheck } from "./ops/google-drive";
import { check as google_sheetsCheck } from "./ops/google-sheets";
import { check as githubCheck } from "./ops/github";
import { check as plaidCheck } from "./ops/plaid";
import { check as vercelCheck } from "./ops/vercel";
import { check as cloudflareCheck } from "./ops/cloudflare";
import { check as neonCheck } from "./ops/neon";
import { check as foursquareCheck } from "./ops/foursquare";
import { check as atlas_cloudCheck } from "./ops/atlas-cloud";
import { check as firecrawlCheck } from "./ops/firecrawl";

import type { CheckResult } from "./types";
export type { CheckResult };
export const CLIENT_CHECKS: Record<string, () => Promise<CheckResult>> = {
  "gmail": gmailCheck,
  "agentmail": agentmailCheck,
  "enginemailer": enginemailerCheck,
  "telnyx": telnyxCheck,
  "agentphone": agentphoneCheck,
  "screenmycalls-voice": screenmycalls_voiceCheck,
  "thanksio": thanksioCheck,
  "zernio": zernioCheck,
  "postforme": postformeCheck,
  "facebook": facebookCheck,
  "instagram": instagramCheck,
  "instagram-messages": instagram_messagesCheck,
  "figma": figmaCheck,
  "spotify": spotifyCheck,
  "mediavault": mediavaultCheck,
  "google-docs": google_docsCheck,
  "google-drive": google_driveCheck,
  "google-sheets": google_sheetsCheck,
  "github": githubCheck,
  "plaid": plaidCheck,
  "vercel": vercelCheck,
  "cloudflare": cloudflareCheck,
  "neon": neonCheck,
  "foursquare": foursquareCheck,
  "atlas-cloud": atlas_cloudCheck,
  "firecrawl": firecrawlCheck
};
