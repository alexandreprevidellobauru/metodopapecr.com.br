// Worker do site metodopapecr: serve os arquivos estáticos de ./dist e
// recebe as inscrições do curso, enviando todos os campos por e-mail.

const CURSO = "Curso IA a Favor do Seu Tempo e Propósito";
const DATA_CURSO = "09/01/2027";

const PAGAMENTOS = ["Pix", "Cartão de Crédito - em até 8x"];
const VALORES = {
  Pix: "R$ 350 (Pix)",
  "Cartão de Crédito - em até 8x": "R$ 400 (cartão, em até 8x)",
};
const COMO_SOUBE = [
  "Instagram",
  "WhatsApp",
  "Indicação de alguém",
  "Palestra “Falta de tempo ou prioridade?”",
  "Mentoria PAPEC+R",
  "Outro",
];
const USO_IA = [
  "Nunca utilizei",
  "Já utilizei, mas tenho dificuldades",
  "Utilizo ocasionalmente",
  "Utilizo frequentemente",
];
const DIFICULDADES = [
  "Tenho dificuldade para definir prioridades",
  "Procrastino tarefas importantes",
  "Minha rotina é muito corrida",
  "Tenho dificuldade para manter o foco",
  "Começo projetos, mas não consigo terminá-los",
  "Não consigo equilibrar vida pessoal e profissional",
  "Outro",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/inscricao-curso") {
      if (request.method !== "POST") {
        return json({ success: false, message: "Método não permitido." }, 405);
      }
      return receberInscricao(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

async function receberInscricao(request, env) {
  let dados;
  try {
    dados = await request.json();
  } catch {
    return json({ success: false, message: "Dados inválidos." }, 400);
  }

  // Campo invisível: robôs costumam preenchê-lo. Finge sucesso e descarta.
  if (texto(dados.site, 200)) {
    return json({ success: true });
  }

  const inscricao = {
    nome: texto(dados.nome, 120),
    whatsapp: texto(dados.whatsapp, 20),
    email: texto(dados.email, 160),
    instagram: texto(dados.instagram, 80),
    pagamento: texto(dados.pagamento, 60),
    comoSoube: texto(dados.comoSoube, 80),
    comoSoubeOutro: texto(dados.comoSoubeOutro, 160),
    usoIA: texto(dados.usoIA, 80),
    dificuldades: (Array.isArray(dados.dificuldades) ? dados.dificuldades : [])
      .map((d) => texto(d, 80))
      .filter((d) => DIFICULDADES.includes(d)),
    dificuldadesOutro: texto(dados.dificuldadesOutro, 200),
    expectativa: texto(dados.expectativa, 1500),
    acessibilidade: texto(dados.acessibilidade, 1000),
    autorizacao: dados.autorizacao === true,
  };

  const erro = validar(inscricao);
  if (erro) {
    return json({ success: false, message: erro }, 400);
  }

  if (!env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY não configurada.");
    return json({ success: false, message: "O serviço de inscrição ainda não está configurado." }, 500);
  }

  const enviadoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const campos = montarCampos(inscricao, enviadoEm);

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_REMETENTE || "PAPEC+R <material@mentoriapapecr.com.br>",
      to: [env.ADMIN_EMAIL || "alexandreprevidello@gmail.com"],
      reply_to: inscricao.email,
      subject: `Nova inscrição - ${CURSO} · ${DATA_CURSO} · ${inscricao.nome}`,
      html: gerarEmailHtml(inscricao, campos),
      text: gerarEmailTexto(inscricao, campos, enviadoEm),
    }),
  });

  if (!resposta.ok) {
    console.error("Erro Resend inscrição:", await resposta.text());
    return json({ success: false, message: "Não foi possível enviar sua inscrição." }, 502);
  }

  return json({ success: true });
}

function validar(i) {
  const digitos = i.whatsapp.replace(/\D/g, "");
  if (i.nome.length < 3) return "Informe seu nome completo.";
  if (digitos.length !== 10 && digitos.length !== 11) return "Informe um WhatsApp válido, com DDD.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.email)) return "Informe um e-mail válido.";
  if (!PAGAMENTOS.includes(i.pagamento)) return "Escolha a forma de pagamento.";
  if (!COMO_SOUBE.includes(i.comoSoube)) return "Conte como soube do curso.";
  if (i.comoSoube === "Outro" && !i.comoSoubeOutro) return "Conte como soube do curso.";
  if (!USO_IA.includes(i.usoIA)) return "Responda se você já usa IA no dia a dia.";
  if (!i.dificuldades.length) return "Marque ao menos uma dificuldade com a gestão do tempo.";
  if (i.dificuldades.includes("Outro") && !i.dificuldadesOutro) return "Descreva a outra dificuldade.";
  if (!i.expectativa) return "Conte sua principal expectativa com o curso.";
  if (!i.autorizacao) return "É necessário autorizar o tratamento dos dados.";
  return "";
}

// Lista única de [rótulo, valor] usada no HTML e no texto do e-mail,
// para que as duas versões tragam sempre os mesmos campos.
function montarCampos(i, enviadoEm) {
  const dificuldades = i.dificuldades.map((d) =>
    d === "Outro" ? `Outro: ${i.dificuldadesOutro}` : d
  );

  return [
    ["Curso", `${CURSO} · ${DATA_CURSO}`],
    ["Enviado em", enviadoEm],
    ["1. Nome completo", i.nome],
    ["2. WhatsApp", i.whatsapp],
    ["3. E-mail", i.email],
    ["4. Instagram", i.instagram || "Não informado"],
    ["5. Forma de pagamento", `${i.pagamento} · ${VALORES[i.pagamento]}`],
    ["6. Como soube do curso", i.comoSoube === "Outro" ? `Outro: ${i.comoSoubeOutro}` : i.comoSoube],
    ["7. Usa IA no dia a dia", i.usoIA],
    ["8. Maior dificuldade com a gestão do tempo", dificuldades],
    ["9. Principal expectativa com o curso", i.expectativa],
    ["10. Necessidade de acessibilidade", i.acessibilidade || "Nenhuma informada"],
    ["Autorização LGPD", "Sim, autorizou o tratamento dos dados conforme a Política de Privacidade"],
  ];
}

function gerarEmailHtml(i, campos) {
  const linhas = campos
    .map(([rotulo, valor]) => {
      const conteudo = Array.isArray(valor)
        ? `<ul style="margin:0;padding-left:18px">${valor.map((v) => `<li>${esc(v)}</li>`).join("")}</ul>`
        : esc(valor).replace(/\n/g, "<br>");
      return `<tr>
<td style="padding:10px 12px;border-bottom:1px solid #E7E2D6;font-weight:bold;color:#1E4A2C;vertical-align:top;width:38%">${esc(rotulo)}</td>
<td style="padding:10px 12px;border-bottom:1px solid #E7E2D6;color:#1B241D;vertical-align:top">${conteudo}</td>
</tr>`;
    })
    .join("");

  const whatsLink = `https://wa.me/55${i.whatsapp.replace(/\D/g, "")}`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1B241D;max-width:640px">
<h2 style="color:#1E4A2C;margin:0 0 6px">Nova inscrição recebida</h2>
<p style="margin:0 0 18px;color:#5A6359">${esc(CURSO)} · ${DATA_CURSO}</p>
<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5">${linhas}</table>
<p style="margin:22px 0 0"><a href="${whatsLink}" style="display:inline-block;background:#1E4A2C;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Chamar ${esc(i.nome.split(" ")[0])} no WhatsApp</a></p>
</div>`;
}

// Versão em texto puro, com um bloco JSON no final, pensada para leitura automática.
function gerarEmailTexto(i, campos, enviadoEm) {
  const linhas = campos.map(([rotulo, valor]) =>
    Array.isArray(valor)
      ? `${rotulo}:\n${valor.map((v) => `  - ${v}`).join("\n")}`
      : `${rotulo}: ${valor}`
  );

  const estruturado = {
    curso: CURSO,
    data_curso: DATA_CURSO,
    enviado_em: enviadoEm,
    nome: i.nome,
    whatsapp: i.whatsapp,
    email: i.email,
    instagram: i.instagram || null,
    forma_pagamento: i.pagamento,
    valor: VALORES[i.pagamento],
    como_soube: i.comoSoube,
    como_soube_outro: i.comoSoubeOutro || null,
    uso_ia: i.usoIA,
    dificuldades: i.dificuldades,
    dificuldades_outro: i.dificuldadesOutro || null,
    expectativa: i.expectativa,
    acessibilidade: i.acessibilidade || null,
    autorizacao_lgpd: true,
  };

  return `NOVA INSCRIÇÃO\n\n${linhas.join("\n\n")}\n\n--- DADOS ESTRUTURADOS (JSON) ---\n${JSON.stringify(estruturado, null, 2)}\n`;
}

function texto(valor, max) {
  return String(valor ?? "").trim().slice(0, max);
}

function esc(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function json(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json;charset=UTF-8" },
  });
}
