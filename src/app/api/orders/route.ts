import { requireAdmin, requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";
import { FreightError, quoteOfferFreight } from "@/lib/melhor-envio";

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

    const offerId = body?.offerId;
    const shippingServiceId = body?.shippingServiceId;
    let selectedOffer: Record<string, unknown> | null = null;
    let shipment: Record<string, unknown> | null = null;
    if (offerId != null) {
      if (typeof offerId !== "string" || typeof shippingServiceId !== "string") {
        return Response.json({ error: "Selecione uma opção de frete para continuar." }, { status: 400 });
      }
      const offerSnap = await realtimeDatabase.ref(`productOffers/${productId}/${offerId}`).get();
      selectedOffer = asRecord(offerSnap.val());
      if (!selectedOffer || selectedOffer.type !== "sell" ||
          (selectedOffer.status != null && selectedOffer.status !== "active")) {
        return Response.json({ error: "A oferta selecionada não está mais disponível." }, { status: 409 });
      }

      const quote = await quoteOfferFreight({
        buyerUid: user.uid,
        productId,
        offerId,
        quantity,
      });
      const selectedShipping = quote.options.find((option) => option.id === shippingServiceId);
      if (!selectedShipping) {
        return Response.json({ error: "A opção de frete mudou. Recalcule e selecione novamente." }, { status: 409 });
      }
      const freeShipping = selectedOffer.freeShipping === true;
      shipment = {
        serviceId: selectedShipping.id,
        serviceName: selectedShipping.name,
        company: selectedShipping.company,
        carrierPrice: selectedShipping.price,
        shippingPrice: freeShipping ? 0 : selectedShipping.price,
        deliveryTime: selectedShipping.deliveryTime,
        fromPostalCode: quote.fromPostalCode,
        toPostalCode: quote.toPostalCode,
        freeShipping,
      };
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
    const unitPrice = selectedOffer ? Number(selectedOffer.price) : Number(product.price);
    const shippingPrice = Number(shipment?.shippingPrice ?? 0);
    const orderRef = realtimeDatabase.ref("orders").push();
    const order = {
      customerUid: user.uid,
      customerEmail: user.email ?? null,
      items: [{ productId, name: selectedOffer?.productName ?? product.name, unitPrice, quantity }],
      offerId: typeof offerId === "string" ? offerId : null,
      sellerUid: selectedOffer?.userId ?? null,
      shipping: shipment,
      total: Number((unitPrice * quantity + shippingPrice).toFixed(2)),
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
    if (error instanceof FreightError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
