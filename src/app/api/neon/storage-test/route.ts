import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { HttpsProxyAgent } from "https-proxy-agent";
export const dynamic = "force-dynamic";

function client() {
  // The sandbox routes outbound traffic through an egress proxy that Node
  // fetch honors automatically (NODE_USE_ENV_PROXY) but the raw https module
  // does not — so hand the AWS SDK an explicit proxy agent when one is set.
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const requestHandler = proxy ? new NodeHttpHandler({ httpsAgent: new HttpsProxyAgent(proxy) }) : undefined;
  return new S3Client({
    requestHandler,
    endpoint: process.env.AWS_ENDPOINT_URL_S3,
    region: process.env.AWS_REGION || "us-east-2",
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || "", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "" },
  });
}
async function bodyText(body: any): Promise<string> {
  if (!body) return "";
  const chunks: Uint8Array[] = [];
  for await (const c of body) chunks.push(c as Uint8Array);
  return Buffer.concat(chunks).toString("utf-8");
}
export async function GET() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !process.env.AWS_ENDPOINT_URL_S3) return NextResponse.json({ ok: false, error: "storage env not configured" }, { status: 500 });
  const s3 = client();
  const results: Record<string, any> = {};
  let allOk = true;
  for (const app of ["reach", "studio", "ops"] as const) {
    const key = `${app}/health-${app}.txt`;
    const content = `universe56 ${app} storage health check`;
    try {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content, ContentType: "text/plain" }));
      const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const text = await bodyText(got.Body);
      const ok = text === content;
      if (!ok) allOk = false;
      results[app] = { ok, key, bytes: text.length };
    } catch (e: any) {
      allOk = false;
      results[app] = { ok: false, key, error: String(e?.name || e?.message || e).slice(0, 200) };
    }
  }
  return NextResponse.json({ ok: allOk, bucket, results }, { status: allOk ? 200 : 502 });
}
