import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { docsPages, getDocPage } from "@/lib/docs-content";

type DocArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return docsPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: DocArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) {
    return {
      title: "Docs",
    };
  }

  return {
    title: page.title,
    description: page.description,
  };
}

export default async function DocArticlePage({ params }: DocArticlePageProps) {
  const { slug } = await params;
  const page = getDocPage(slug);

  if (!page) notFound();

  const currentIndex = docsPages.findIndex((candidate) => candidate.slug === slug);
  const nextPage = docsPages[currentIndex + 1] ?? docsPages[0];

  return (
    <main className="doc-article-page">
      <div className="shell doc-layout">
        <aside className="doc-sidebar">
          <Link href="/docs">
            <ArrowLeft size={13} aria-hidden="true" />
            Docs home
          </Link>
          <nav aria-label="BioEvidence docs">
            {docsPages.map((doc) => (
              <Link
                className={doc.slug === slug ? "active" : ""}
                href={`/docs/${doc.slug}`}
                key={doc.slug}
              >
                {doc.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="doc-article">
          <span>Documentation</span>
          <h1>{page.title}</h1>
          <p className="doc-description">{page.description}</p>

          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <Link className="doc-next-link" href={`/docs/${nextPage.slug}`}>
            Next: {nextPage.title}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </article>
      </div>
    </main>
  );
}
