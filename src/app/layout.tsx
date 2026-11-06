import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = { title: "Universe56", description: "Three independent apps in one shell: Reach, Studio, Ops." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Universe56</Link>
          <nav>
            <Link href="/reach">Reach</Link>
            <Link href="/studio">Studio</Link>
            <Link href="/ops">Ops</Link>
            <Link href="/login">Login</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
