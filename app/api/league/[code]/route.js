const BASE_URL = "https://api.football-data.org/v4";

export async function GET(request, { params }) {
  const { code } = params;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "FOOTBALL_DATA_API_KEY não configurada. Veja o README." },
      { status: 500 }
    );
  }

  const headers = { "X-Auth-Token": apiKey };

  try {
    const [matchesRes, standingsRes] = await Promise.all([
      fetch(`${BASE_URL}/competitions/${code}/matches`, {
        headers,
        next: { revalidate: 300 },
      }),
      fetch(`${BASE_URL}/competitions/${code}/standings`, {
        headers,
        next: { revalidate: 300 },
      }),
    ]);

    if (matchesRes.status === 429 || standingsRes.status === 429) {
      return Response.json(
        { error: "Limite de requisições da football-data.org atingido. Aguarde um minuto." },
        { status: 429 }
      );
    }

    if (!matchesRes.ok || !standingsRes.ok) {
      return Response.json({ error: "Erro ao consultar a football-data.org." }, { status: 502 });
    }

    const matchesData = await matchesRes.json();
    const standingsData = await standingsRes.json();

    return Response.json({
      matches: matchesData.matches ?? [],
      standings: standingsData.standings?.[0]?.table ?? [],
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
