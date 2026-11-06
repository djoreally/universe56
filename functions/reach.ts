export default async function reach(): Promise<Response> {
  return Response.json({
    app: "reach",
    name: "Reach",
    ok: true,
    service: "universe56",
    note: "Independent app function for the Reach workspace. Business data lives in the reach Postgres schema.",
  });
}
