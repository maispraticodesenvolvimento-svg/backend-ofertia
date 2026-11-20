export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", "ofertia_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return response;
}
