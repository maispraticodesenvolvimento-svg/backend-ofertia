import { requireAdmin } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const snapshot = await realtimeDatabase.ref("settings").get();
    const data = snapshot.val() ?? {};
    return Response.json({ item: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = asRecord(await request.json());
    if (!body) return Response.json({ error: "Informe as configurações como objeto JSON." }, { status: 400 });

    const settings = {
      general: asRecord(body.general) ?? {},
      payments: asRecord(body.payments) ?? {},
      paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods : [],
      notifications: asRecord(body.notifications) ?? {},
      updatedAt: Date.now(),
      updatedBy: admin.uid,
    };
    await realtimeDatabase.ref("settings").set(settings);
    return Response.json({ item: settings });
  } catch (error) {
    return apiError(error);
  }
}
