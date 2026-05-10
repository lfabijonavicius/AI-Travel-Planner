import { NextResponse, type NextRequest } from "next/server"

// Session refresh is handled client-side via AuthContext / onAuthStateChange.
// This middleware just passes requests through.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
