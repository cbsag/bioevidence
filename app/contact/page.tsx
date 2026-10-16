import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Globe2,
  MessagesSquare,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Ganesh Chandrasekar about BioEvidence AI.",
};

const contactLinks = [
  {
    href: "https://cbsag.me",
    label: "Portfolio",
    detail: "cbsag.me",
    icon: Globe2,
  },
  {
    href: "https://github.com/cbsag",
    label: "GitHub",
    detail: "github.com/cbsag",
    icon: Code2,
  },
  {
    href: "https://www.linkedin.com/in/cbsag/",
    label: "LinkedIn",
    detail: "Ganesh Chandrasekar",
    icon: UsersRound,
  },
];

export default function ContactPage() {
  return (
    <main className="contact-page">
      <section className="shell contact-hero">
        <div>
          <span>Contact</span>
          <h1>Talk about BioEvidence AI.</h1>
          <p>
            For product feedback, research collaboration, early access, or a
            walkthrough of the BioEvidence workflow, use the links below or
            start from the access request page.
          </p>
          <div className="contact-actions">
            <Link href="/request-access">
              Request access
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/docs">
              Read docs
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside>
          <MessagesSquare size={24} aria-hidden="true" />
          <strong>Useful context to share</strong>
          <p>
            Mention whether you want to evaluate retrieval behavior, review
            citation grounding, discuss product access, or connect around
            biomedical AI work.
          </p>
        </aside>
      </section>

      <section className="shell contact-link-section">
        <div>
          <span>Links</span>
          <h2>Find Ganesh online.</h2>
        </div>
        <div className="contact-link-grid">
          {contactLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a href={item.href} key={item.href} target="_blank" rel="noreferrer">
                <Icon size={18} aria-hidden="true" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}
