import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Answer Workspace",
  description:
    "Ask BioEvidence AI and inspect PubMed-linked evidence-grounded answers.",
};

type PreviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const params = (await searchParams) ?? {};
  const nextParams = new URLSearchParams({ mode: "examples" });
  const topic = firstValue(params.topic);
  const system = firstValue(params.system);
  const question = firstValue(params.question);

  if (topic) nextParams.set("topic", topic);
  if (system) nextParams.set("system", system);
  if (question) nextParams.set("question", question);

  redirect(`/ask?${nextParams.toString()}`);
}
