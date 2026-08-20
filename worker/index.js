const SYSTEM = `Tu es Justine, directrice opérationnelle IA de Vital Services. Tu réponds en français, de façon concise, opérationnelle et factuelle. Tu aides à piloter la téléassistance, les alertes, opportunités, actions et briefings. Tu ne prétends jamais avoir effectué une action externe si ce n'est pas vérifié. Tu distingues clairement les données réelles des données de démonstration.`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function handleJustine(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({
      answer:
        "Le moteur OpenAI n'est pas encore configuré dans Cloudflare. Ajoutez OPENAI_API_KEY comme secret serveur pour activer Justine.",
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ answer: "Requête invalide." }, 400);
  }

  const question = String(body.question || "").slice(0, 4000);
  const context = body.context ? JSON.stringify(body.context).slice(0, 14000) : "{}";

  if (!question) return json({ answer: "Commande vide." }, 400);

  const payload = {
    model: env.OPENAI_MODEL || "gpt-5.6-luna",
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: SYSTEM }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Contexte cockpit:\n${context}\n\nDemande utilisateur:\n${question}`,
          },
        ],
      },
    ],
    max_output_tokens: 900,
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    return json({
      answer: `Erreur du moteur IA (${response.status}). Vérifiez la clé API et le modèle configuré.`,
      detail: detail.slice(0, 300),
    });
  }

  const result = await response.json();
  const answer =
    result.output_text ||
    result.output
      ?.flatMap((item) => item.content || [])
      .map((item) => item.text || "")
      .join("") ||
    "Réponse indisponible.";

  return json({ answer });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "justine-command-center" });
    }

    if (url.pathname === "/api/justine" && request.method === "POST") {
      return handleJustine(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
