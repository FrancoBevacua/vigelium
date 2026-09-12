// @ts-nocheck
/* Lector de texto de PDF sin dependencias nativas. */
import pako from 'pako';
/* ============================================================
   Lector de texto de PDF (sin librerías externas).
   Soporta streams FlateDecode vía DecompressionStream, fuentes
   simples con WinAnsi/Standard y fuentes compuestas con ToUnicode.
   No lee PDF escaneados (imágenes sin capa de texto).
   ============================================================ */
const PDFR = (() => {
  // Los offsets de PDF son bytes. Expo sólo admite TextDecoder UTF-8;
  // además, Windows-1252 cambiaría códigos binarios dentro de los streams.
  const dec = { decode(bytes) {
    const partes = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      partes.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return partes.join('');
  } };

  async function inflate(bytes) {
    try { return pako.inflate(bytes); } catch (e) { }
    try { return pako.inflateRaw(bytes); } catch (e) { }
    return null;
  }

  function a85(bytes) {
    const out = [];
    let tuple = 0, count = 0, i = 0;
    if (bytes[0] === 60 && bytes[1] === 126) i = 2;
    for (; i < bytes.length; i++) {
      const c = bytes[i];
      if (c === 126) break;
      if (c === 122 && count === 0) { out.push(0, 0, 0, 0); continue; }
      if (c < 33 || c > 117) continue;
      tuple = tuple * 85 + (c - 33); count++;
      if (count === 5) { out.push((tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255); tuple = 0; count = 0; }
    }
    if (count > 0) {
      for (let k = count; k < 5; k++) tuple = tuple * 85 + 84;
      const b = [(tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255];
      for (let k = 0; k < count - 1; k++) out.push(b[k]);
    }
    return new Uint8Array(out);
  }
  function ahx(bytes) {
    const out = []; let hi = -1;
    for (let i = 0; i < bytes.length; i++) {
      const c = String.fromCharCode(bytes[i]);
      if (c === '>') break;
      if (!/[0-9A-Fa-f]/.test(c)) continue;
      const v = parseInt(c, 16);
      if (hi < 0) hi = v; else { out.push(hi * 16 + v); hi = -1; }
    }
    if (hi >= 0) out.push(hi * 16);
    return new Uint8Array(out);
  }

  function indexOfSeq(buf, seq, from) {
    outer: for (let i = from; i <= buf.length - seq.length; i++) {
      for (let j = 0; j < seq.length; j++) if (buf[i + j] !== seq[j]) continue outer;
      return i;
    }
    return -1;
  }
  const S = s => Array.from(s, c => c.charCodeAt(0));

  /* --- 1. objetos indirectos --- */
  function parseObjects(bytes) {
    const txt = dec.decode(bytes);
    const objs = new Map();
    const re = /(\d+)\s+(\d+)\s+obj\b/g;
    let m;
    while ((m = re.exec(txt))) {
      const num = +m[1], start = m.index + m[0].length;
      const endObj = txt.indexOf('endobj', start);
      const sIdx = txt.indexOf('stream', start);
      let dict, stream = null;
      if (sIdx >= 0 && (endObj < 0 || sIdx < endObj)) {
        dict = txt.slice(start, sIdx);
        let p = sIdx + 6;
        if (bytes[p] === 13) p++;
        if (bytes[p] === 10) p++;
        let len = null;
        const lm = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
        if (lm) len = +lm[1];
        let end;
        if (len != null && p + len <= bytes.length) {
          end = p + len;
          const tail = dec.decode(bytes.subarray(end, end + 20));
          if (!/^\s*endstream/.test(tail)) end = null;
        }
        if (end == null) {
          end = indexOfSeq(bytes, S('endstream'), p);
          if (end < 0) end = bytes.length;
          while (end > p && (bytes[end - 1] === 10 || bytes[end - 1] === 13)) end--;
        }
        stream = bytes.subarray(p, end);
      } else {
        dict = txt.slice(start, endObj < 0 ? start + 4000 : endObj);
      }
      objs.set(num, { dict, stream });
      re.lastIndex = Math.max(re.lastIndex, start);
    }
    return objs;
  }

  const refOf = s => { const m = /^\s*(\d+)\s+\d+\s+R/.exec(s || ''); return m ? +m[1] : null; };
  function dictValue(dict, key) {
    const i = dict.indexOf(key);
    if (i < 0) return null;
    let j = i + key.length, depth = 0, out = '';
    for (; j < dict.length; j++) {
      const c = dict[j];
      if (c === '<' && dict[j + 1] === '<') { depth++; out += '<<'; j++; continue; }
      if (c === '>' && dict[j + 1] === '>') { depth--; out += '>>'; j++; if (depth <= 0) break; continue; }
      if (c === '[') depth++;
      if (c === ']') { depth--; out += c; if (depth <= 0) break; continue; }
      if (depth === 0 && (c === '/' && out.trim())) break;
      out += c;
      if (depth === 0 && /R\s*$/.test(out) && /\d+\s+\d+\s+R\s*$/.test(out)) break;
    }
    return out.trim();
  }

  /* --- 2. ToUnicode --- */
  function parseCMap(txt) {
    const map = new Map();
    const hex = h => parseInt(h, 16);
    const uni = h => { let s = ''; for (let i = 0; i < h.length; i += 4) s += String.fromCharCode(hex(h.substr(i, 4))); return s; };
    let m;
    const rc = /beginbfchar([\s\S]*?)endbfchar/g;
    while ((m = rc.exec(txt))) {
      const pr = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g; let p;
      while ((p = pr.exec(m[1]))) map.set(hex(p[1]), uni(p[2]));
    }
    const rr = /beginbfrange([\s\S]*?)endbfrange/g;
    while ((m = rr.exec(txt))) {
      const pr = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g; let p;
      while ((p = pr.exec(m[1]))) {
        const a = hex(p[1]), b = hex(p[2]);
        if (p[3]) { const base = hex(p[3]); for (let c = a; c <= b && c - a < 65536; c++) map.set(c, String.fromCharCode(base + (c - a))); }
        else if (p[4]) { const items = p[4].match(/<([0-9A-Fa-f]+)>/g) || []; items.forEach((it, k) => map.set(a + k, uni(it.slice(1, -1)))); }
      }
    }
    return map;
  }

  const WIN = { 128: '€', 130: '‚', 131: 'ƒ', 132: '„', 133: '…', 138: 'Š', 139: '‹', 140: 'Œ', 145: '‘', 146: '’', 147: '“', 148: '”', 149: '•', 150: '–', 151: '—', 153: '™', 156: 'œ', 160: ' ' };

  /* --- 3. extracción --- */
  function decodeString(raw, font) {
    let out = '';
    if (font && font.two) {
      for (let i = 0; i + 1 < raw.length; i += 2) {
        const code = (raw[i] << 8) | raw[i + 1];
        out += font.map && font.map.has(code) ? font.map.get(code) : (code > 31 && code < 65534 ? String.fromCharCode(code) : '');
      }
    } else {
      for (let i = 0; i < raw.length; i++) {
        const code = raw[i];
        if (font && font.map && font.map.has(code)) { out += font.map.get(code); continue; }
        out += WIN[code] || String.fromCharCode(code);
      }
    }
    return out;
  }

  function tokenizeStrings(txt) { return txt; }

  function extractFromContent(txt, fonts) {
    const lines = [];
    let cur = '', lastY = null, lastX = null, font = null, size = 12;
    const push = () => { if (cur.trim()) lines.push(cur.replace(/\s+/g, ' ').trim()); cur = ''; };
    let i = 0;
    const ops = [];
    // tokenizador simple
    while (i < txt.length) {
      const c = txt[i];
      if (c === '(') {
        let j = i + 1, depth = 1, bytes = [];
        while (j < txt.length && depth > 0) {
          const ch = txt[j];
          if (ch === '\\') {
            const n = txt[j + 1];
            const oct = /^[0-7]{1,3}/.exec(txt.slice(j + 1, j + 4));
            if (oct) { bytes.push(parseInt(oct[0], 8)); j += 1 + oct[0].length; continue; }
            const esc = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 }[n];
            if (esc != null) bytes.push(esc);
            else if (n === '\n') { }
            else bytes.push(n.charCodeAt(0));
            j += 2; continue;
          }
          if (ch === '(') depth++;
          if (ch === ')') { depth--; if (!depth) { j++; break; } }
          bytes.push(ch.charCodeAt(0) & 255); j++;
        }
        ops.push({ t: 'str', v: bytes }); i = j; continue;
      }
      if (c === '<' && txt[i + 1] !== '<') {
        const j = txt.indexOf('>', i);
        const h = txt.slice(i + 1, j).replace(/[^0-9A-Fa-f]/g, '');
        const bytes = []; for (let k = 0; k + 1 < h.length + 1; k += 2) bytes.push(parseInt((h.substr(k, 2) + '0').slice(0, 2), 16));
        ops.push({ t: 'str', v: bytes }); i = j + 1; continue;
      }
      if (/[\s]/.test(c)) { i++; continue; }
      let j = i;
      while (j < txt.length && !/[\s()<>\[\]]/.test(txt[j])) j++;
      if (j === i) { ops.push({ t: 'tok', v: c }); i++; continue; }
      ops.push({ t: 'tok', v: txt.slice(i, j) }); i = j;
    }
    const stack = [];
    for (let k = 0; k < ops.length; k++) {
      const o = ops[k];
      if (o.t === 'str') { stack.push(o); continue; }
      const v = o.v;
      if (v === 'Tf') { const nm = stack.slice(-2)[0]; const nameTok = [...stack].reverse().find(s => s.t === 'tok' && s.v[0] === '/'); if (nameTok) font = fonts[nameTok.v.slice(1)] || null; size = parseFloat(stack[stack.length - 1] && stack[stack.length - 1].v) || size; stack.length = 0; continue; }
      if (v === 'Tj' || v === "'" || v === '"') {
        const s = [...stack].reverse().find(x => x.t === 'str');
        if (v !== 'Tj') push();
        if (s) cur += decodeString(s.v, font);
        stack.length = 0; continue;
      }
      if (v === 'TJ') {
        for (const it of stack) {
          if (it.t === 'str') cur += decodeString(it.v, font);
          else { const n = parseFloat(it.v); if (!isNaN(n) && n < -120) cur += ' '; }
        }
        stack.length = 0; continue;
      }
      if (v === 'Td' || v === 'TD') {
        const ty = parseFloat(stack[stack.length - 1] && stack[stack.length - 1].v);
        if (!isNaN(ty) && Math.abs(ty) > 0.6) push();
        stack.length = 0; continue;
      }
      if (v === 'Tm') {
        const nums = stack.filter(s => s.t === 'tok').map(s => parseFloat(s.v)).filter(n => !isNaN(n));
        const y = nums[nums.length - 1], x = nums[nums.length - 2];
        if (lastY != null && Math.abs(y - lastY) > 0.6) push();
        else if (lastX != null && x - lastX > 8) cur += ' ';
        lastY = y; lastX = x;
        stack.length = 0; continue;
      }
      if (v === 'T*' || v === 'ET' || v === 'BT') { push(); stack.length = 0; continue; }
      stack.push(o);
      if (stack.length > 24) stack.splice(0, stack.length - 24);
    }
    push();
    return lines;
  }

  async function extract(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (dec.decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('no-pdf');
    const objs = parseObjects(bytes);
    const streamText = new Map();
    for (const [num, o] of objs) {
      if (!o.stream) continue;
      // Las imágenes no contienen instrucciones de texto. No inflarlas evita
      // agotar la memoria al abrir documentos escaneados en el teléfono.
      if (/\/Subtype\s*\/Image\b/.test(o.dict)) continue;
      let data = o.stream;
      const fm = /\/Filter\s*(\[[^\]]*\]|\/[A-Za-z0-9]+)/.exec(o.dict);
      const filtros = fm ? (fm[1].match(/\/[A-Za-z0-9]+/g) || []) : [];
      let ok = true;
      for (const f of filtros) {
        if (f === '/ASCII85Decode') data = a85(data);
        else if (f === '/ASCIIHexDecode') data = ahx(data);
        else if (f === '/FlateDecode') { const inf = await inflate(data); if (!inf) { ok = false; break; } data = inf; }
        else { ok = false; break; }
      }
      if (!ok) continue;
      streamText.set(num, dec.decode(data));
    }
    // fuentes
    const fontCache = new Map();
    function buildFont(num) {
      if (fontCache.has(num)) return fontCache.get(num);
      const o = objs.get(num); if (!o) return null;
      const f = { two: /\/Type0|\/Identity-H/.test(o.dict), map: null };
      const su = refOf(dictValue(o.dict, '/ToUnicode'));
      if (su != null && streamText.has(su)) f.map = parseCMap(streamText.get(su));
      fontCache.set(num, f); return f;
    }
    const pages = [];
    for (const [num, o] of objs) {
      if (!/\/Type\s*\/Page[^s]/.test(o.dict + ' ')) continue;
      const fonts = {};
      let res = dictValue(o.dict, '/Resources');
      const rr = refOf(res);
      if (rr != null && objs.get(rr)) res = objs.get(rr).dict;
      const fd = dictValue(res || '', '/Font');
      let fdict = fd;
      const fr = refOf(fd);
      if (fr != null && objs.get(fr)) fdict = objs.get(fr).dict;
      if (fdict) { const re = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+\d+\s+R/g; let m; while ((m = re.exec(fdict))) fonts[m[1]] = buildFont(+m[2]); }
      let cts = dictValue(o.dict, '/Contents') || '';
      const nums = (cts.match(/(\d+)\s+\d+\s+R/g) || []).map(s => +s.split(/\s+/)[0]);
      let txt = '';
      nums.forEach(n => { if (streamText.has(n)) txt += streamText.get(n) + '\n'; });
      if (txt) pages.push(extractFromContent(txt, fonts));
    }
    if (!pages.length) {
      for (const [num, t] of streamText) if (/BT[\s\S]*?(Tj|TJ)/.test(t)) pages.push(extractFromContent(t, {}));
    }
    return pages.map(p => p.join('\n')).join('\n');
  }
  return { extract };
})();

export default PDFR;
export const extraerTextoPDF: (buf: ArrayBuffer) => Promise<string> = PDFR.extract;
