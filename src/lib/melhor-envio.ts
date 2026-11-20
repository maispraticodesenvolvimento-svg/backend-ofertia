import { realtimeDatabase } from "@/lib/firebase-admin";
import { asRecord } from "@/lib/api-response";

export class FreightError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "FreightError";
  }
}

export type FreightOption = {
  id: string;
  name: string;
  company: string;
  price: number;
  deliveryTime: number | null;
};

function postalCode(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function numeric(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

export async function quoteOfferFreight(args: {
  buyerUid: string;
  productId: string;
  offerId: string;
  destinationPostalCode?: string;
  quantity?: number;
}): Promise<{
  fromPostalCode: string;
  toPostalCode: string;
  options: FreightOption[];
}> {
  const [productSnap, offerSnap, buyerSnap] = await Promise.all([
    realtimeDatabase.ref(`products/${args.productId}`).get(),
    realtimeDatabase.ref(`productOffers/${args.productId}/${args.offerId}`).get(),
    realtimeDatabase.ref(`users/${args.buyerUid}`).get(),
  ]);

  const product = asRecord(productSnap.val());
  const offer = asRecord(offerSnap.val());
  const buyer = asRecord(buyerSnap.val());
  if (!product || product.status !== "active") {
    throw new FreightError("Produto indisponível para cotação.", 404);
  }
  if (!offer || offer.type !== "sell" || (offer.status != null && offer.status !== "active")) {
    throw new FreightError("Oferta de venda não encontrada ou indisponível.", 404);
  }
  if (typeof offer.userId !== "string" || offer.userId === args.buyerUid) {
    throw new FreightError("Não foi possível identificar o endereço do vendedor.", 422);
  }

  const sellerSnap = await realtimeDatabase.ref(`users/${offer.userId}`).get();
  const seller = asRecord(sellerSnap.val());
  const sellerAddress = asRecord(seller?.address);
  const buyerAddress = asRecord(buyer?.address);
  const fromPostalCode = postalCode(sellerAddress?.cep);
  const toPostalCode = postalCode(args.destinationPostalCode || buyerAddress?.cep);
  if (fromPostalCode.length !== 8) {
    throw new FreightError("O vendedor precisa cadastrar um CEP válido no perfil.", 422);
  }
  if (toPostalCode.length !== 8) {
    throw new FreightError("Informe um CEP de entrega válido.", 422);
  }

  const width = numeric(product.width);
  const height = numeric(product.height);
  const length = numeric(product.length);
  const weight = numeric(product.weight);
  if ([width, height, length, weight].some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new FreightError(
      "Este produto ainda não tem peso e dimensões de embalagem válidos. Peça ao administrador para atualizar o cadastro do produto.",
      422,
    );
  }

  const token = process.env.MELHORENVIO_API_TOKEN;
  if (!token) {
    throw new FreightError("A integração do Melhor Envio ainda não está configurada no servidor.", 503);
  }

  const baseUrl = (process.env.MELHORENVIO_BASE_URL || "https://sandbox.melhorenvio.com.br").replace(/\/$/, "");
  const userAgent = process.env.MELHORENVIO_USER_AGENT || "Ofertia (maispraticodesenvolvimento@gmail.com)";
  const quantity = args.quantity ?? 1;
  const response = await fetch(`${baseUrl}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      from: { postal_code: fromPostalCode },
      to: { postal_code: toPostalCode },
      products: [{
        id: args.productId,
        width,
        height,
        length,
        weight,
        insurance_value: Number(offer.price),
        quantity,
      }],
      options: { receipt: false, own_hand: false },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = asRecord(payload);
    const providerMessage = body?.message ?? body?.error;
    throw new FreightError(
      typeof providerMessage === "string"
        ? `O Melhor Envio não conseguiu calcular o frete: ${providerMessage}`
        : `O Melhor Envio não conseguiu calcular o frete (HTTP ${response.status}).`,
      502,
    );
  }

  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload)?.items)
      ? asRecord(payload)?.items as unknown[]
      : [];
  const options = records.flatMap((entry): FreightOption[] => {
    const record = asRecord(entry);
    if (!record) return [];
    const companyData = asRecord(record.company);
    const id = String(record.id ?? "");
    const price = numeric(record.custom_price ?? record.price);
    if (!id || !Number.isFinite(price) || price < 0 || record.error) return [];
    const delivery = numeric(record.custom_delivery_time ?? record.delivery_time);
    return [{
      id,
      name: String(record.name ?? record.service ?? "Serviço de entrega"),
      company: String(companyData?.name ?? record.company_name ?? "Transportadora"),
      price,
      deliveryTime: Number.isFinite(delivery) ? delivery : null,
    }];
  }).sort((a, b) => a.price - b.price);

  if (options.length === 0) {
    throw new FreightError("O Melhor Envio não retornou opções de frete para este endereço.", 422);
  }

  return { fromPostalCode, toPostalCode, options };
}
