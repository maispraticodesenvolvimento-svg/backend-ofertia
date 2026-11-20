export async function POST(request: Request) {
  const response = Response.json({ ok: true });
  const secure = new URL(request.url).protocol === "https:";
  const sameSite = secure ? "None; Secure" : "Lax";
  response.headers.append(
    "Set-Cookie",
    `ofertia_session=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  );
  return response;
}
