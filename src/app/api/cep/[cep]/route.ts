export async function GET(
  _request: Request,
  context: { params: Promise<{ cep: string }> | { cep: string } }
) {
  try {
    const params = await context.params;
    const cleanCep = String(params.cep ?? "").replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      return Response.json(
        { error: "CEP inválido. Deve conter 8 números." },
        { status: 400 }
      );
    }

    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      headers: { "User-Agent": "Ofertia/1.0" },
    });

    if (!response.ok) {
      return Response.json(
        { error: "Não foi possível consultar o CEP no ViaCEP." },
        { status: 502 }
      );
    }

    const data = await response.json();
    if (data.erro === true || data.erro === "true") {
      return Response.json({ error: "CEP não encontrado." }, { status: 404 });
    }

    return Response.json({ item: data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno ao buscar CEP.";
    return Response.json({ error: msg }, { status: 500 });
  }
}

