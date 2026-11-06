export default async function studio(): Promise<Response> {
  return Response.json({
    app: "studio",
    name: "Studio",
    ok: true,
    service: "universe56",
    note: "Independent app function for the Studio workspace. Business data lives in the studio Postgres schema.",
  });
}
