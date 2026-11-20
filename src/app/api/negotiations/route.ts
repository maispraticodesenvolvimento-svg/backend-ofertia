import { requireAdmin, requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const admin = new URL(request.url).searchParams.get("all") === "true";
    const user = admin ? await requireAdmin(request) : await requireUser(request);
    const snapshot = await realtimeDatabase.ref("negotiations").get();
    const values = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const items = Object.entries(values ?? {})
      .map(([id, item]) => ({ id, ...item }))
      .filter((item) => admin || item.customerUid === user.uid)
      .sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = asRecord(await request.json());
    const productId = body?.productId;
    const offerPrice = Number(body?.offerPrice);
    if (typeof productId !== "string" || !Number.isFinite(offerPrice) || offerPrice <= 0) {
      return Response.json({ error: "Informe o produto e um valor de oferta válido." }, { status: 400 });
    }
    const product = (await realtimeDatabase.ref(`products/${productId}`).get()).val();
    if (!product || product.status !== "active") {
      return Response.json({ error: "Produto indisponível." }, { status: 404 });
    }
    const ref = realtimeDatabase.ref("negotiations").push();
    const now = Date.now();
    const negotiation = {
      customerUid: user.uid,
      customerEmail: user.email ?? null,
      productId,
      productName: product.name,
      listPrice: Number(product.price),
      offerPrice,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(negotiation);
    try {
      const notificationRef = realtimeDatabase.ref(`users/${user.uid}/notifications`).push();
      await notificationRef.set({
        title: "Oferta enviada",
        body: `Sua oferta para ${product.name} foi registrada.`,
        read: false,
        createdAt: now,
      });
    } catch (notificationError) {
      console.error("Negociação criada, mas a notificação não foi gravada:", notificationError);
    }
    return Response.json({ item: { id: ref.key, ...negotiation } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
