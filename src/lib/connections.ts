export type AppId = "reach" | "studio" | "ops";
export type ConnectionKind = "custom_api_key" | "oauth_connector";

export interface Connection {
  id: string;
  app: AppId;
  name: string;
  kind: ConnectionKind;
  host: string;
  purpose: string;
  step: string;
  s3Prefix: string;
}

export const APP_META: Record<AppId, { title: string; tagline: string; schema: string; apiBase: string }> = {
  reach: { title: "Reach", tagline: "Communications & Outreach OS", schema: "reach", apiBase: "/api/reach" },
  studio: { title: "Studio", tagline: "Content & Media OS", schema: "studio", apiBase: "/api/studio" },
  ops: { title: "Ops", tagline: "Business Operations & Money OS", schema: "ops", apiBase: "/api/ops" },
};

export const CONNECTIONS: Connection[] = [
  { id: "gmail", app: "reach", name: "Gmail", kind: "oauth_connector", host: "gmail.googleapis.com", purpose: "Read/search mail and check the connected Google profile for lead context", step: "email channel check", s3Prefix: "reach/" },
  { id: "agentmail", app: "reach", name: "AgentMail", kind: "custom_api_key", host: "api.agentmail.to", purpose: "Read the moms@agentmail.to inbox (threads/search) for inbound leads", step: "email channel check", s3Prefix: "reach/" },
  { id: "enginemailer", app: "reach", name: "EngineMailer", kind: "custom_api_key", host: "api.enginemailer.com", purpose: "Check campaign/subscriber account before a campaign draft is prepared", step: "email channel check", s3Prefix: "reach/" },
  { id: "telnyx", app: "reach", name: "Telnyx", kind: "custom_api_key", host: "api.telnyx.com", purpose: "Check balance and phone numbers before any SMS/voice step", step: "sms/voice channel check", s3Prefix: "reach/" },
  { id: "agentphone", app: "reach", name: "AgentPhone", kind: "custom_api_key", host: "api.agentphone.ai", purpose: "List provisioned numbers/agents for SMS intake", step: "sms/voice channel check", s3Prefix: "reach/" },
  { id: "screenmycalls-voice", app: "reach", name: "ScreenMyCalls Voice", kind: "custom_api_key", host: "voice.screenmycalls.app", purpose: "Health-check the outbound voice server (never places a call from here)", step: "sms/voice channel check", s3Prefix: "reach/" },
  { id: "thanksio", app: "reach", name: "Thanks.io", kind: "custom_api_key", host: "api.thanks.io", purpose: "Ping the direct-mail API before a postcard step is drafted", step: "direct-mail check", s3Prefix: "reach/" },
  { id: "zernio", app: "reach", name: "Zernio", kind: "custom_api_key", host: "zernio.com", purpose: "List connected social accounts for outreach posting drafts", step: "social channel check", s3Prefix: "reach/" },
  { id: "postforme", app: "reach", name: "Postforme (Post For Me)", kind: "custom_api_key", host: "api.postforme.dev", purpose: "List connected social accounts for outreach posting drafts", step: "social channel check", s3Prefix: "reach/" },
  { id: "facebook", app: "studio", name: "Facebook", kind: "oauth_connector", host: "graph.facebook.com", purpose: "Check the managed Page/feed for content publishing context", step: "social check", s3Prefix: "studio/" },
  { id: "instagram", app: "studio", name: "Instagram", kind: "oauth_connector", host: "graph.instagram.com", purpose: "Check the Instagram profile/media for content context", step: "social check", s3Prefix: "studio/" },
  { id: "instagram-messages", app: "studio", name: "Instagram Messages", kind: "oauth_connector", host: "graph.facebook.com", purpose: "Check Instagram message threads for audience follow-up", step: "inbox check", s3Prefix: "studio/" },
  { id: "figma", app: "studio", name: "Figma", kind: "oauth_connector", host: "api.figma.com", purpose: "Check design files before a content build starts", step: "design check", s3Prefix: "studio/" },
  { id: "spotify", app: "studio", name: "Spotify", kind: "oauth_connector", host: "api.spotify.com", purpose: "Check profile/playlists for audio used in content", step: "audio check", s3Prefix: "studio/" },
  { id: "mediavault", app: "studio", name: "MediaVault", kind: "custom_api_key", host: "qcghbgcqubxkvpfpldme.supabase.co", purpose: "List media-library stats/files available to productions", step: "media check", s3Prefix: "studio/" },
  { id: "google-docs", app: "ops", name: "Google Docs", kind: "oauth_connector", host: "docs.googleapis.com", purpose: "Check documents used as the knowledge store", step: "knowledge store check", s3Prefix: "ops/" },
  { id: "google-drive", app: "ops", name: "Google Drive", kind: "oauth_connector", host: "www.googleapis.com/drive/v3", purpose: "Check files in the knowledge store", step: "knowledge store check", s3Prefix: "ops/" },
  { id: "google-sheets", app: "ops", name: "Google Sheets", kind: "oauth_connector", host: "sheets.googleapis.com", purpose: "Check spreadsheets in the knowledge store", step: "knowledge store check", s3Prefix: "ops/" },
  { id: "github", app: "ops", name: "GitHub", kind: "oauth_connector", host: "api.github.com", purpose: "Check user/repos for the build pipeline", step: "build/deploy check", s3Prefix: "ops/" },
  { id: "plaid", app: "ops", name: "Plaid", kind: "oauth_connector", host: "production.plaid.com", purpose: "Check linked accounts/balances for the money picture", step: "money check", s3Prefix: "ops/" },
  { id: "vercel", app: "ops", name: "Vercel", kind: "oauth_connector", host: "api.vercel.com", purpose: "Check projects/deployments", step: "build/deploy check", s3Prefix: "ops/" },
  { id: "cloudflare", app: "ops", name: "Cloudflare", kind: "custom_api_key", host: "api.cloudflare.com", purpose: "List zones for infra status", step: "infra check", s3Prefix: "ops/" },
  { id: "neon", app: "ops", name: "Neon", kind: "custom_api_key", host: "console.neon.tech", purpose: "Check Neon projects (this app's own database platform)", step: "infra check", s3Prefix: "ops/" },
  { id: "foursquare", app: "ops", name: "Foursquare", kind: "custom_api_key", host: "places-api.foursquare.com", purpose: "Search places for prospect research", step: "prospect research", s3Prefix: "ops/" },
  { id: "atlas-cloud", app: "ops", name: "Atlas Cloud", kind: "custom_api_key", host: "api.atlascloud.ai", purpose: "List available models for AI enrichment", step: "ai enrichment", s3Prefix: "ops/" },
  { id: "firecrawl", app: "ops", name: "Firecrawl", kind: "custom_api_key", host: "api.firecrawl.dev", purpose: "Search the web for prospect research", step: "prospect research", s3Prefix: "ops/" },
];

export const EXPECTED_CONNECTION_COUNT = 26;

export function connectionsForApp(app: AppId): Connection[] {
  return CONNECTIONS.filter((c) => c.app === app);
}
