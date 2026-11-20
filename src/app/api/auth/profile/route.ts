import { requireUser } from "@/lib/require-user";
import { apiError, asRecord } from "@/lib/api-response";
import { realtimeDatabase } from "@/lib/firebase-admin";

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text || !text.trim()) return null;
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const token = await requireUser(request);
    const userRef = realtimeDatabase.ref(`users/${token.uid}`);
    const snap = await userRef.get();
    const profile = snap.val() ?? {};
    return Response.json({
      item: {
        uid: token.uid,
        email: token.email ?? profile.email ?? null,
        role: profile.role ?? "buyer",
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        document: profile.document ?? "",
        address: profile.address ?? {
          cep: "",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "",
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const token = await requireUser(request);
    const body = await parseJsonBody(request);
    if (!body) return Response.json({ error: "Informe os dados do perfil." }, { status: 400 });

    const userRef = realtimeDatabase.ref(`users/${token.uid}`);
    const existingSnap = await userRef.get();
    const existing = existingSnap.val() ?? {};

    const name = String(body.name ?? existing.name ?? "").trim();
    const phone = String(body.phone ?? existing.phone ?? "").trim();
    const document = String(body.document ?? existing.document ?? "").trim();

    const rawAddress = asRecord(body.address) ?? asRecord(existing.address) ?? {};
    const address = {
      cep: String(rawAddress.cep ?? "").trim(),
      street: String(rawAddress.street ?? "").trim(),
      number: String(rawAddress.number ?? "").trim(),
      complement: String(rawAddress.complement ?? "").trim(),
      neighborhood: String(rawAddress.neighborhood ?? "").trim(),
      city: String(rawAddress.city ?? "").trim(),
      state: String(rawAddress.state ?? "").trim().toUpperCase(),
    };

    const updatedData = {
      ...existing,
      email: token.email ?? existing.email ?? null,
      name,
      phone,
      document,
      address,
      updatedAt: Date.now(),
    };

    await userRef.set(updatedData);

    return Response.json({
      item: {
        uid: token.uid,
        ...updatedData,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = await requireUser(request);
    const userRef = realtimeDatabase.ref(`users/${token.uid}`);
    const snap = await userRef.get();
    const existing = snap.val() ?? {};

    const body = await parseJsonBody(request);

    if (snap.exists() && (!body || Object.keys(body).length === 0)) {
      return Response.json({
        item: {
          uid: token.uid,
          email: token.email ?? existing.email ?? null,
          role: existing.role ?? "buyer",
          name: existing.name ?? "",
          phone: existing.phone ?? "",
          document: existing.document ?? "",
          address: existing.address ?? {
            cep: "",
            street: "",
            number: "",
            complement: "",
            neighborhood: "",
            city: "",
            state: "",
          },
        },
      });
    }

    const name = body && typeof body.name === "string" ? body.name.trim() : (existing.name ?? "");
    const phone = body && typeof body.phone === "string" ? body.phone.trim() : (existing.phone ?? "");
    const document = body && typeof body.document === "string" ? body.document.trim() : (existing.document ?? "");

    const rawAddress = (body ? asRecord(body.address) : null) ?? asRecord(existing.address) ?? {};
    const address = {
      cep: String(rawAddress.cep ?? "").trim(),
      street: String(rawAddress.street ?? "").trim(),
      number: String(rawAddress.number ?? "").trim(),
      complement: String(rawAddress.complement ?? "").trim(),
      neighborhood: String(rawAddress.neighborhood ?? "").trim(),
      city: String(rawAddress.city ?? "").trim(),
      state: String(rawAddress.state ?? "").trim().toUpperCase(),
    };

    const updatedData = {
      ...existing,
      email: token.email ?? existing.email ?? null,
      role: existing.role ?? "buyer",
      name,
      phone,
      document,
      address,
      updatedAt: Date.now(),
      createdAt: existing.createdAt ?? Date.now(),
    };

    await userRef.set(updatedData);

    return Response.json({
      item: {
        uid: token.uid,
        ...updatedData,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
