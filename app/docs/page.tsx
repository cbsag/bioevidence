import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { docsPages } from "@/lib/docs-content";

export const metadata: Metadata = {
  title: "Docs",
  description: "BioEvidence AI product documentation.",
};

export default function DocsPage() {
  return (
    <main className="docs-page">
      <section className="docs-hero">
        <div className="shell">
          <span>BioEvidence docs</span>
          <h1>Understand the product workflow.</h1>
          <p>
            A concise guide to BioEvidence AI, citation-grounded answers,
            account workspaces, and the retrieval pipeline behind the product.
          </p>
        </div>
      </section>

      <section className="docs-index">
        <div className="shell docs-index-grid">
          {docsPages.map((page) => (
            <Link href={`/docs/${page.slug}`} key={page.slug}>
              <BookOpen size={18} aria-hidden="true" />
              <strong>{page.title}</strong>
              <span>{page.description}</span>
              <em>
                Read
                <ArrowRight size={13} aria-hidden="true" />
              </em>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
