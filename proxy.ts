import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  // Examples are public, even though they share the /ask route with Live.
  if (
    request.nextUrl.pathname === "/ask" &&
    request.nextUrl.searchParams.get("mode") === "examples"
  ) {
    return response;
  }

  try {
    const { publishableKey, url } = getSupabaseConfig();
    const supabase = createServerClient<Database>(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    await supabase.auth.getUser();
  } catch {
    return response;
  }

  return response;
}

export const config = {
  // Only Server Component pages that read a user session need cookie refresh.
  // Public pages and worker/API requests must not wait for an auth round trip.
  matcher: ["/ask", "/account/:path*", "/request-access"],
};
