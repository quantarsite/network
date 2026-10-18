// Gera o dataroom.html com o conteudo criptografado.
//
// O conteudo confidencial (content.html e os PDFs) NAO fica neste repositorio,
// que e publico. Ele fica numa pasta privada sua. Para atualizar o dataroom:
//
//   DATAROOM_PASSWORD='sua-senha' node tools/dataroom/build.mjs /caminho/da/pasta-privada
//
// A pasta privada precisa ter content.html e, se quiser, PDFs. Cada link
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

const html = readFileSync(join(src, "content.html"), "utf8");
const pdfs = {};
for (const f of readdirSync(src)) {
  if (f.toLowerCase().endsWith(".pdf")) pdfs[f] = readFileSync(join(src, f)).toString("base64");
}
const plain = new TextEncoder().encode(JSON.stringify({ html, pdfs }));

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));

const b64 = (u) => Buffer.from(u).toString("base64");
const payload = JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) });

const runtime = readFileSync(join(here, "unlock.js"), "utf8");
const out = readFileSync(join(here, "template.html"), "utf8")
  .replace("<!--DATAROOM_PAYLOAD-->", "")
  .replace("<!--DATAROOM_SCRIPT-->",
    `<script id="drPayload" type="application/json">${payload}</script>\n<script>\n${runtime}</script>`);
writeFileSync(join(repo, "dataroom.html"), out);
console.log(`dataroom.html gerado: ${Object.keys(pdfs).length} PDF(s), ${ct.length} bytes cifrados`);
