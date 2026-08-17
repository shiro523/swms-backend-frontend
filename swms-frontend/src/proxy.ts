import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Next.js 16 renamed the `middleware` convention to `proxy`. This runs on the
// Node.js runtime and gates the role-specific route groups.
//
// It is a UX guard only — it keeps users out of areas they can't use and sends
// them to the right place. The real security boundary is the backend, which
// verifies the same cookie and scopes every query by role on each request.

const SECTIONS = ["admin", "purok-leader", "resident"] as const;
const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET ?? "");

function sectionOf(pathname: string): string | null {
  const seg = pathname.split("/")[1];
  return SECTIONS.includes(seg as (typeof SECTIONS)[number]) ? seg : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const section = sectionOf(pathname);
  if (!section) return NextResponse.next();

  const token = request.cookies.get("swms_token")?.value;
  const loginUrl = new URL("/login", request.url);

  if (!token) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = String(payload.role);
    // Signed in, but for a different section than the one requested.
    if (role !== section) {
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
    return NextResponse.next();
  } catch {
    // Missing/expired/tampered token — treat as logged out.
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("swms_token");
    return res;
  }
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/purok-leader",
    "/purok-leader/:path*",
    "/resident",
    "/resident/:path*",
  ],
};
