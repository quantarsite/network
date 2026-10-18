// Decifra o dataroom no navegador. A senha nunca sai do aparelho de quem digita.
(function () {
  const $ = (id) => document.getElementById(id);
  const payload = JSON.parse($('drPayload').textContent);
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const KEY_STORE = 'dr_key_v' + payload.v + '_' + payload.salt;

  async function deriveRaw(password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(payload.salt), iterations: payload.iter }, base, 256));
  }

  async function open(raw) {
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, key, unb64(payload.ct));
    const data = JSON.parse(new TextDecoder().decode(plain));
    const room = $('dataRoom');
    room.innerHTML = data.html;
    room.querySelectorAll('a[href$=".pdf"]').forEach((a) => {
      const name = a.getAttribute('href').split('/').pop();
      if (!data.pdfs[name]) return;
      const url = URL.createObjectURL(new Blob([unb64(data.pdfs[name])], { type: 'application/pdf' }));
      a.href = url;
      a.setAttribute('download', name);
      a.removeAttribute('onclick');
    });
    $('lockScreen').style.display = 'none';
    room.style.display = 'block';
  }

  async function unlock() {
    const input = $('passInput');
    const error = $('lockError');
    const btn = document.querySelector('.lock-btn');
    error.textContent = '';
    btn.disabled = true;
    btn.textContent = 'VERIFYING...';
    try {
      const raw = await deriveRaw(input.value.trim());
      await open(raw);
      try { sessionStorage.setItem(KEY_STORE, btoa(String.fromCharCode(...raw))); } catch (e) {}
    } catch (e) {
      error.textContent = 'Invalid access code. Contact contact@quantarnetwork.com';
      input.value = '';
      input.focus();
      const box = document.querySelector('.lock-box');
      box.style.animation = 'none';
      box.offsetHeight;
      box.style.animation = 'shake 0.4s ease';
    } finally {
      btn.disabled = false;
      btn.textContent = 'AUTHENTICATE';
    }
  }

  window.unlock = unlock;
  $('passInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });

  try {
    const saved = sessionStorage.getItem(KEY_STORE);
    if (saved) open(unb64(saved)).catch(() => { try { sessionStorage.removeItem(KEY_STORE); } catch (e) {} });
  } catch (e) {}

  const style = document.createElement('style');
  style.textContent = '@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }';
  document.head.appendChild(style);
})();
