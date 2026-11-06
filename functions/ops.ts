export default async function ops(): Promise<Response> {
  return Response.json({
    app: "ops",
    name: "Ops",
    ok: true,
    service: "universe56",
    note: "Independent app function for the Ops workspace. Business data lives in the ops Postgres schema.",
  });
}
