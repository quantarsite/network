// Gera dataroom.html e cashbook/index.html com o conteudo criptografado.
//
// O conteudo confidencial (content.html e os PDFs) NAO fica neste repositorio,
// que e publico. Ele fica numa pasta privada sua. Para atualizar o dataroom:
//
//   DATAROOM_PASSWORD='sua-senha' node tools/dataroom/build.mjs /caminho/da/pasta-privada
//
// A pasta privada precisa ter content.html (Data Room), cashbook.html
// (Cash Book) e, se quiser, PDFs. Cada link
// href="/nome.pdf" dentro do content.html vira um download do PDF de mesmo
// nome, que tambem vai criptografado.
//
// Criptografia: PBKDF2-SHA256 (600.000 iteracoes) deriva a chave da senha,
// AES-256-GCM cifra o conteudo. A senha nao aparece em lugar nenhum da pagina.
// Sem a senha, o que esta publicado e so texto cifrado.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";

const ITER = 600_000;
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const src = process.argv[2];
const password = process.env.DATAROOM_PASSWORD;
if (!src || !password) {
  console.error("uso: DATAROOM_PASSWORD='...' node tools/dataroom/build.mjs <pasta-privada>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("use uma senha com pelo menos 12 caracteres");
  process.exit(1);
}

// Both protected pages use the same password and the same salt, so an
// investor who unlocks one also has the other open in the same tab session.
const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const b64 = (u) => Buffer.from(u).toString("base64");
const runtime = readFileSync(join(here, "unlock.js"), "utf8");

async function build({ content, withPdfs, template, out }) {
  const html = readFileSync(join(src, content), "utf8");
  const pdfs = {};
  if (withPdfs) for (const f of readdirSync(src)) {
    if (f.toLowerCase().endsWith(".pdf")) pdfs[f] = readFileSync(join(src, f)).toString("base64");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify({ html, pdfs }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const payload = JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
  const page = readFileSync(join(here, template), "utf8")
    .replace("<!--DATAROOM_PAYLOAD-->", "")
    .replace("<!--DATAROOM_SCRIPT-->",
      `<script id="drPayload" type="application/json">${payload}</script>\n<script>\n${runtime}</script>`);
  writeFileSync(join(repo, out), page);
  console.log(`${out} gerado: ${Object.keys(pdfs).length} PDF(s), ${ct.length} bytes cifrados`);
}

await build({ content: "content.html", withPdfs: true, template: "template.html", out: "dataroom.html" });
await build({ content: "cashbook.html", withPdfs: false, template: "cashbook.template.html", out: "cashbook/index.html" });
