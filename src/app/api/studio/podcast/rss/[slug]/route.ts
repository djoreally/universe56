import {
  getShowBySlug,
  listPublishedEpisodesWithTracks,
  seedPodcastShow,
} from "@/lib/studio-podcast";
export const dynamic = "force-dynamic";

function escapeXml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// GET /api/studio/podcast/rss/[slug] — podcast RSS 2.0 + iTunes feed built
// from the show's PUBLISHED episodes. Enclosures point at the Studio
// audio-stream route for the episode's audio track.
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  await seedPodcastShow();
  const { slug } = await context.params;
  const cleanSlug = slug.replace(/\.xml$/i, "");

  const show = await getShowBySlug(cleanSlug);
  if (!show) {
    return new Response("Podcast show not found", { status: 404 });
  }

  const published = await listPublishedEpisodesWithTracks(show.id);
  const origin = new URL(request.url).origin;

  const itemsXml = published
    .map((ep: any) => {
      const pubDate = new Date(ep.published_at ?? ep.created_at).toUTCString();
      const enclosure = ep.audio_track_id
        ? `\n      <enclosure url="${escapeXml(`${origin}/api/studio/podcast/audio-stream/${ep.audio_track_id}`)}" length="${Number(ep.track_file_size_bytes ?? ep.duration_seconds * 44100)}" type="audio/wav" />`
        : "";
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <itunes:title>${escapeXml(ep.title)}</itunes:title>
      <itunes:subtitle>${escapeXml(ep.subtitle)}</itunes:subtitle>
      <description>${escapeXml(ep.description)}</description>
      <itunes:summary>${escapeXml(ep.description)}</itunes:summary>${enclosure}
      <guid isPermaLink="false">universe56-ep-${ep.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <itunes:duration>${ep.duration_seconds}</itunes:duration>
      <itunes:episode>${ep.episode_number}</itunes:episode>
      <itunes:explicit>no</itunes:explicit>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(show.title)}</title>
    <link>${escapeXml(origin)}</link>
    <language>en-us</language>
    <description>${escapeXml(show.description)}</description>
    <itunes:author>${escapeXml(show.author)}</itunes:author>
    <itunes:summary>${escapeXml(show.description)}</itunes:summary>
    <itunes:explicit>no</itunes:explicit>
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
