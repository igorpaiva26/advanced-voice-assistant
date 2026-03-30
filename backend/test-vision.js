const fs = require('fs');

async function test() {
  try {
    // Usar uma imagem pública rica em detalhes para forçar o limite descritivo do Gemini
    const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/600px-FullMoon2010.jpg";
    const imgRes = await fetch(imageUrl);
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const body = {
      image: base64,
      mimeType: "image/jpeg",
      // Provocar a IA pedindo de propósito "todos os detalhes possíveis"
      message: "o que voce ve na minha tela em absolutamente todos os detalhes? liste tudo que voce viu",
      agentId: "default"
    };

    console.log("Enviando requisição (isso pode demorar uns 5 segundos)...");
    const res = await fetch("http://localhost:3001/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const json = await res.json();
    console.log("\n==== RESPOSTA DO GÊMINI ====\n");
    console.log(json.reply);
    console.log("\n============================\n");
  } catch(e) {
    console.error("Erro no teste:", e);
  }
}
test();
