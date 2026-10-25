import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface DecodedToken {
  sub: string;
  role: "patient" | "doctor";
  exp: number;
}

function parseJwtCookie(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(jsonPayload);
    // Check expiration
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      return null;
    }
    return parsed as DecodedToken;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass static files and API requests
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get("meddrag_token")?.value;
  const decoded = tokenCookie ? parseJwtCookie(tokenCookie) : null;
  const isAuthenticated = Boolean(decoded && decoded.sub);
  const userRole = decoded?.role;

  // 1. Login page routing
  if (pathname === "/login") {
    if (isAuthenticated) {
      const target = userRole === "doctor" ? "/doctor" : "/patient";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 2. Root path redirect
  if (pathname === "/") {
    if (isAuthenticated) {
      const target = userRole === "doctor" ? "/doctor" : "/patient";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Doctor routes guard
  if (pathname.startsWith("/doctor")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (userRole !== "doctor") {
      return NextResponse.redirect(new URL("/patient", request.url));
    }
    return NextResponse.next();
  }

  // 4. Patient routes guard
  if (pathname.startsWith("/patient")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Doctors may view approved summaries if needed, but patients cannot view /doctor
    return NextResponse.next();
  }

  // 5. Developer routes guard (accessible to all authenticated users)
  if (pathname.startsWith("/developer")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 6. Legacy routes compatibility redirects
  if (pathname === "/new-analysis") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(userRole === "doctor" ? "/doctor" : "/patient", request.url));
  }
  if (pathname === "/history") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(userRole === "doctor" ? "/doctor" : "/patient/history", request.url));
  }
  if (pathname === "/doctor-review") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL("/doctor", request.url));
  }
  if (pathname === "/settings") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL("/developer/settings", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
