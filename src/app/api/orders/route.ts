import { requireAdmin, requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const admin = url.searchParams.get("all") === "true";
    const user = admin ? await requireAdmin(request) : await requireUser(request);
    const snapshot = await realtimeDatabase.ref("orders").get();
    const values = snapshot.val() as Record<string, Record<string, unknown>> | null;
    const items = Object.entries(values ?? {})
      .map(([id, order]) => ({ id, ...order }))
      .filter((order) => admin || order.customerUid === user.uid)
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
    const quantity = Number(body?.quantity ?? 1);
    if (typeof productId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return Response.json({ error: "Produto e quantidade válida são obrigatórios." }, { status: 400 });
    }
    const productRef = realtimeDatabase.ref(`products/${productId}`);
    const now = Date.now();
    const reservation = await productRef.transaction((current) => {
      if (!current || current.status !== "active" || Number(current.stock) < quantity) return;
      return { ...current, stock: Number(current.stock) - quantity, updatedAt: now };
    });
    if (!reservation.committed) {
      const current = reservation.snapshot.val();
      if (!current || current.status !== "active") {
        return Response.json({ error: "Produto indisponível." }, { status: 404 });
      }
      return Response.json({ error: "Estoque insuficiente." }, { status: 409 });
    }

    const product = reservation.snapshot.val();
    const orderRef = realtimeDatabase.ref("orders").push();
    const order = {
      customerUid: user.uid,
      customerEmail: user.email ?? null,
      items: [{ productId, name: product.name, unitPrice: Number(product.price), quantity }],
      total: Number((Number(product.price) * quantity).toFixed(2)),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    try {
      await orderRef.set(order);
    } catch (error) {
      await productRef.transaction((current) => current
        ? { ...current, stock: Number(current.stock ?? 0) + quantity, updatedAt: Date.now() }
        : current,
      );
      throw error;
    }
    try {
      const notificationRef = realtimeDatabase.ref(`users/${user.uid}/notifications`).push();
      await notificationRef.set({
        title: "Pedido criado",
        body: `O pedido ${orderRef.key} foi registrado.`,
        read: false,
        createdAt: now,
      });
    } catch (notificationError) {
      console.error("Pedido criado, mas a notificação não foi gravada:", notificationError);
    }
    return Response.json({ item: { id: orderRef.key, ...order } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
