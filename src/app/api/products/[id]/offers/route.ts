import { requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

type Context = { params: Promise<{ id: string }> };

async function resolveProductId(request: Request, context?: Context): Promise<string> {
  try {
    if (context?.params) {
      const resolved = await context.params;
      if (resolved?.id) return decodeURIComponent(resolved.id);
    }
  } catch (_) {}

  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const prodIdx = segments.indexOf("products");
  if (prodIdx !== -1 && segments[prodIdx + 1] && segments[prodIdx + 1] !== "offers") {
    return decodeURIComponent(segments[prodIdx + 1]);
  }
  return "";
}

function isProfileComplete(profile: Record<string, unknown> | null): boolean {
  if (!profile) return false;
  const name = String(profile.name ?? "").trim();
  const phone = String(profile.phone ?? "").trim();
  const document = String(profile.document ?? "").trim();
  const address = asRecord(profile.address);
  if (!name || !phone || !document || !address) return false;

  const street = String(address.street ?? "").trim();
  const number = String(address.number ?? "").trim();
  const city = String(address.city ?? "").trim();
  const state = String(address.state ?? "").trim();
  const cep = String(address.cep ?? "").trim();

  return Boolean(street && number && city && state && cep);
}

export async function GET(request: Request, context: Context) {
  try {
    const productId = await resolveProductId(request, context);
    if (!productId) return Response.json({ error: "ID do produto inválido." }, { status: 400 });

    const snapshot = await realtimeDatabase.ref(`productOffers/${productId}`).get();
    const values = snapshot.val() as Record<string, Record<string, unknown>> | null;

    const all = Object.entries(values ?? {}).map(([id, off]) => ({
      id,
      ...off,
    }));

    // Separa ofertas de venda e ofertas de compra (apenas ativas)
    const sellOffers = all
      .filter((o: any) => o.type === "sell" && (o.status === "active" || o.status == null))
      .sort((a: any, b: any) => Number(a.price ?? 0) - Number(b.price ?? 0)); // Menor preço primeiro

    const buyOffers = all
      .filter((o: any) => o.type === "buy" && (o.status === "active" || o.status == null))
      .sort((a: any, b: any) => Number(b.price ?? 0) - Number(a.price ?? 0)); // Maior oferta primeiro

    return Response.json({ sellOffers, buyOffers });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const productId = await resolveProductId(request, context);
    if (!productId) return Response.json({ error: "ID do produto inválido." }, { status: 400 });

    // ── VALIDAÇÃO OBRIGATÓRIA DE CADASTRO COMPLETO ─────────────────────────
    const userSnap = await realtimeDatabase.ref(`users/${user.uid}`).get();
    const userProfile = userSnap.val() as Record<string, unknown> | null;

    if (!isProfileComplete(userProfile)) {
      return Response.json(
        {
          code: "PROFILE_INCOMPLETE",
          error: "Para criar ofertas de compra ou venda, você precisa completar seus dados pessoais e endereço de entrega.",
        },
        { status: 403 }
      );
    }

    const body = asRecord(await request.json());
    if (!body) return Response.json({ error: "Informe os dados da oferta." }, { status: 400 });

    const type = body.type === "buy" ? "buy" : "sell";
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return Response.json({ error: "Informe um valor válido maior que zero." }, { status: 400 });
    }

    const freeShipping = Boolean(body.freeShipping);
    const shippingPrice = freeShipping ? 0 : Number(body.shippingPrice ?? 0);
    const condition = String(body.condition ?? "Novo").trim();
    const paymentMethods = Array.isArray(body.paymentMethods)
      ? body.paymentMethods.map(String)
      : ["Pix", "Cartão de Crédito"];
    const notes = String(body.notes ?? "").trim();

    // Obtém nome do produto para manter histórico legível
    const prodSnap = await realtimeDatabase.ref(`products/${productId}/name`).get();
    const productName = prodSnap.val() ?? "Produto";

    const userName = String(userProfile?.name ?? user.email?.split("@")[0] ?? "Vendedor");

    const offerData = {
      productId,
      productName,
      type,
      userId: user.uid,
      userName,
      userEmail: user.email ?? null,
      price,
      freeShipping,
      shippingPrice,
      paymentMethods,
      condition,
      notes,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Salva na coleção do produto
    const ref = realtimeDatabase.ref(`productOffers/${productId}`).push();
    const offerId = ref.key;
    await ref.set(offerData);

    // Salva também no índice do usuário
    await realtimeDatabase.ref(`userOffers/${user.uid}/${offerId}`).set({
      ...offerData,
      id: offerId,
    });

    return Response.json({ item: { id: offerId, ...offerData } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

