import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET() {
  try {
    await realtimeDatabase.ref("settings").get();
    return Response.json({ status: "ok", database: "connected", service: "ofertia-backend" });
  } catch (error) {
    console.error("Falha no health check do Realtime Database:", error);
    return Response.json({ status: "error", database: "disconnected" }, { status: 503 });
  }
}
