export function safeNextPath(value: FormDataEntryValue | string | null): string {
  if (typeof value !== "string") return "/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";

  return value;
}

export function encodeStatus(value: string): string {
  return encodeURIComponent(value);
}
