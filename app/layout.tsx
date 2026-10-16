import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BioEvidence AI",
    template: "%s · BioEvidence AI",
  },
  description:
    "Explore biomedical answers with inspectable retrieval, reranking, evidence selection, and source-linked citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="paper" data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div className="shell footer-inner">
            <div>
              <strong>BioEvidence AI</strong>
              <span>Evidence-grounded biomedical question answering</span>
            </div>
            <nav aria-label="Footer navigation">
              <Link href="/ask?mode=examples">Examples</Link>
              <Link href="/docs">Docs</Link>
              <Link href="/results">Results</Link>
              <Link href="/about">About</Link>
              <a href="https://cbsag.me/">Ganesh Chandrasekar</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
