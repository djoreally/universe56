import Link from "next/link";
import { APP_META, CONNECTIONS, connectionsForApp, type AppId } from "@/lib/connections";

export default function Home() {
  const apps: AppId[] = ["reach", "studio", "ops"];
  return (
    <div>
      <h1>Universe56</h1>
      <p className="lede">Three independent applications in one shell. Each app has its own routes, its own Postgres schema, its own API namespace and its own storage prefix. The only shared layer is Neon infrastructure and the registry of all {CONNECTIONS.length} of your API connections — every connection belongs to exactly one app and is used by that app's workflow.</p>
      <div className="grid">
        {apps.map((a) => (
          <div className="card" key={a}>
            <h3>{APP_META[a].title}</h3>
            <p>{APP_META[a].tagline}</p>
            <p><strong>{connectionsForApp(a).length} connections</strong> · schema <strong>{APP_META[a].schema}</strong> · {APP_META[a].apiBase}</p>
            <Link className="bigbtn" href={`/${a}`}>Open {APP_META[a].title}</Link>
          </div>
        ))}
      </div>
      {apps.map((a) => (
        <section key={a}>
          <h2>{APP_META[a].title} — {connectionsForApp(a).length} connections</h2>
          <div className="card"><table>
            <thead><tr><th>Connection</th><th>Type</th><th>Host</th><th>Workflow step</th></tr></thead>
            <tbody>{connectionsForApp(a).map((c) => (<tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.kind}</td><td>{c.host}</td><td>{c.step}</td></tr>))}</tbody>
          </table></div>
        </section>
      ))}
    </div>
  );
}
