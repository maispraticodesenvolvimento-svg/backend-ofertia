import { requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const snap = await realtimeDatabase.ref(`userOffers/${user.uid}`).get();
    const values = snap.val() as Record<string, Record<string, unknown>> | null;

    const items = Object.entries(values ?? {}).map(([id, off]) => ({
      id,
      ...off,
    }));

    // Ordena do mais recente para o mais antigo
    items.sort((a: any, b: any) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));

    const sellOffers = items.filter((o: any) => o.type === "sell");
    const buyOffers = items.filter((o: any) => o.type === "buy");

    return Response.json({ items, sellOffers, buyOffers });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const offerId = url.searchParams.get("offerId");
    const productId = url.searchParams.get("productId");

    if (!offerId) {
      return Response.json({ error: "Informe o ID da oferta." }, { status: 400 });
    }

    // Remove do índice do usuário
    await realtimeDatabase.ref(`userOffers/${user.uid}/${offerId}`).remove();

    // Se tiver productId, remove também do produto
    if (productId) {
      await realtimeDatabase.ref(`productOffers/${productId}/${offerId}`).remove();
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

