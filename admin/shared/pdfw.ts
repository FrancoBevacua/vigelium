// @ts-nocheck
import jpeg from 'jpeg-js';
import pako from 'pako';
import { HELVETICA, HELVETICA_BOLD } from './pdfmetrics';
/* Generador de PDF sin dependencias: texto Helvetica con acentos e imágenes JPEG. */
/* ============================================================
   Generador de PDF (sin librerias). Texto Helvetica con acentos
   (WinAnsi) e imagenes JPEG embebidas sin recomprimir.
   ============================================================ */
const PDFW = (() => {
  const A4W = 595.28, A4H = 841.89;
  const enc = s => { const o = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; };

  function textWidth(s, size, bold) {
    const widths = bold ? HELVETICA_BOLD : HELVETICA;
    let t = 0; for (let i = 0; i < s.length; i++) t += widths[s.charCodeAt(i) & 255] || 556;
    return t / 1000 * size;
  }
  const MAPA = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', ' ': ' ', '•': '\x95', '€': 'EUR', '→': '->' };
  const latin = s => String(s == null ? '' : s).replace(/[–—‘’“”… •€→]/g, c => MAPA[c]);
  const escPdf = s => s.replace(/[\\()]/g, c => '\\' + c).replace(/[\r\n\t]/g, ' ')
    .replace(/[-￿]/g, ch => { const c = ch.charCodeAt(0); return c < 256 ? '\\' + c.toString(8) : '?'; });

  function create(opt) {
    opt = opt || {};
    const W = A4W, H = A4H, M = opt.margin || 48;
    const pages = [], images = [];
    let cur = null, y = 0;

    function newPage() { cur = { ops: [], imgs: [] }; pages.push(cur); y = H - M; if (opt.onPage) opt.onPage(api, pages.length); }
    function ensure(h) { if (!cur || y - h < M) newPage(); }
    function drawLine(line, size, bold, color, indent, align) {
      let x = M + indent;
      if (align === 'right') x = W - M - textWidth(line, size, bold);
      else if (align === 'center') x = (W - textWidth(line, size, bold)) / 2;
      cur.ops.push('BT ' + color + ' rg /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' +
        x.toFixed(2) + ' ' + (y - size).toFixed(2) + ' Td (' + escPdf(line) + ') Tj ET');
    }

    const api = {
      get pageCount() { return pages.length; },
      get cursorY() { return y; },
      keepTogether(h) { ensure(Math.min(h, H - M * 2)); },
      measureText(str, size=10.5, bold=false, lead=size*1.38) {
        let lines=0; const maxW=W-M*2;
        latin(str).split('\n').forEach(part=>{let w=0;lines++;for(const word of part.split(/\s+/)){let n=textWidth(word,size,bold);if(w && w+n+textWidth(' ',size,bold)>maxW){lines++;w=0;}while(n>maxW){lines++;n-=maxW;}w+=n+(w?textWidth(' ',size,bold):0);}});
        return lines*lead;
      },
      space(n) { n = n || 8; ensure(n); y -= n; },
      rule(color) {
        ensure(12); y -= 4;
        cur.ops.push((color || '0.82 0.82 0.82') + ' RG 0.6 w ' + M + ' ' + y.toFixed(2) + ' m ' + (W - M).toFixed(2) + ' ' + y.toFixed(2) + ' l S');
        y -= 8;
      },
      band(h, fill) {
        h = h || 3; ensure(h + 4);
        cur.ops.push((fill || '0 0 0') + ' rg ' + M + ' ' + (y - h).toFixed(2) + ' ' + (W - M * 2).toFixed(2) + ' ' + h + ' re f');
        y -= h + 6;
      },
      text(str, o) {
        o = o || {};
        const size = o.size || 10.5, bold = !!o.bold, lead = o.lead || size * 1.38;
        const indent = o.indent || 0, maxW = W - M * 2 - indent - (o.rightPad || 0);
        const color = o.color || '0 0 0';
        latin(str).split('\n').forEach(part => {
          if (part.trim() === '') { ensure(lead * 0.6); y -= lead * 0.6; return; }
          const words = part.split(/\s+/);
          let line = '';
          words.forEach(wd => {
            while (textWidth(wd, size, bold) > maxW && wd.length > 1) {
              let k = wd.length;
              while (k > 1 && textWidth(wd.slice(0, k), size, bold) > maxW) k--;
              if (line) { ensure(lead); drawLine(line, size, bold, color, indent, o.align); y -= lead; line = ''; }
              ensure(lead); drawLine(wd.slice(0, k), size, bold, color, indent, o.align); y -= lead;
              wd = wd.slice(k);
            }
            const test = line ? line + ' ' + wd : wd;
            if (line && textWidth(test, size, bold) > maxW) { ensure(lead); drawLine(line, size, bold, color, indent, o.align); y -= lead; line = wd; }
            else line = test;
          });
          if (line) { ensure(lead); drawLine(line, size, bold, color, indent, o.align); y -= lead; }
        });
      },
      richText(runs, o = {}) {
        const size = o.size || 11, lead = o.lead || size * 1.5;
        const indent = o.indent || 0, maxW = W - M * 2 - indent;
        let line = [], width = 0;
        const flush = () => {
          if (!line.length) return;
          ensure(lead);
          let x = M + indent;
          const merged = [];
          for (const run of line) {
            const last = merged[merged.length - 1];
            if (last && !!last.bold === !!run.bold && !!last.underline === !!run.underline) last.text += run.text;
            else merged.push({ ...run });
          }
          for (const run of merged) {
            const w = textWidth(run.text, size, run.bold);
            cur.ops.push('BT 0 0 0 rg /' + (run.bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + x.toFixed(2) + ' ' +
              (y - size).toFixed(2) + ' Td (' + escPdf(run.text) + ') Tj ET');
            if (run.underline) cur.ops.push('0 0 0 RG 0.5 w ' + x.toFixed(2) + ' ' + (y - size - 1.5).toFixed(2) +
              ' m ' + (x + w).toFixed(2) + ' ' + (y - size - 1.5).toFixed(2) + ' l S');
            x += w;
          }
          y -= lead; line = []; width = 0;
        };
        for (const run of runs) {
          const tokens = latin(run.text).match(/\S+|\s+/g) || [];
          for (let token of tokens) {
            if (/^\s+$/.test(token)) token = ' ';
            let w = textWidth(token, size, run.bold);
            if (width + w > maxW) flush();
            if (!line.length && token === ' ') continue;
            while (w > maxW && token.length > 1) {
              let k = 1;
              while (k < token.length && textWidth(token.slice(0, k + 1), size, run.bold) <= maxW) k++;
              line.push({ ...run, text: token.slice(0, k) }); flush();
              token = token.slice(k); w = textWidth(token, size, run.bold);
            }
            line.push({ ...run, text: token }); width += w;
          }
        }
        flush();
      },
      image(jpegBytes, iw, ih, o) {
        o = o || {};
        const maxW = o.width || (W - M * 2);
        const scale = Math.min(maxW / iw, (o.maxHeight || (H - M * 2)) / ih, 3);
        const dw = iw * scale, dh = ih * scale;
        ensure(dh + 8);
        const id = 'Im' + images.length;
        if (o.color) {
          images.push({ data: jpegBytes, w: iw, h: ih, id, color: true });
        } else {
        const decoded = jpeg.decode(jpegBytes, { useTArray: true, formatAsRGBA: false, maxMemoryUsageInMB: 160, maxResolutionInMP: 16 });
        const gris = new Uint8Array(decoded.width * decoded.height);
        for (let i = 0; i < gris.length; i++) gris[i] = Math.round(0.299 * decoded.data[i * 3] + 0.587 * decoded.data[i * 3 + 1] + 0.114 * decoded.data[i * 3 + 2]);
        images.push({ data: pako.deflate(gris), w: decoded.width, h: decoded.height, id: id });
        }
        cur.imgs.push(id);
        const x = o.align === 'left' ? M : (W - dw) / 2;
        cur.ops.push('q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + x.toFixed(2) + ' ' + (y - dh).toFixed(2) + ' cm /' + id + ' Do Q');
        y -= dh + 8;
      },
      newPage: newPage,
      build() {
        if (!pages.length) newPage();
        const chunks = []; let pos = 0;
        const push = u8 => { chunks.push(u8); pos += u8.length; };
        push(enc('%PDF-1.4\n%âãÏÓ\n'));
        const objs = [];
        const addObj = (body, stream) => { objs.push({ body: body, stream: stream }); return objs.length; };
        const fontR = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        const fontB = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        const imgRefs = {};
        images.forEach(im => {
          imgRefs[im.id] = addObj('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h +
            ' /ColorSpace /' + (im.color ? 'DeviceRGB' : 'DeviceGray') + ' /BitsPerComponent 8 /Filter /' + (im.color ? 'DCTDecode' : 'FlateDecode') + ' /Length ' + im.data.length + ' >>', im.data);
        });
        const pagesRef = objs.length + pages.length * 2 + 1;
        const pageRefs = [];
        pages.forEach((p, index) => {
          const footer=opt.footer ? '\nBT 0 0 0 rg /F1 7.5 Tf '+M+' 25 Td ('+escPdf(latin(opt.footer)) +') Tj ET\nBT 0 0 0 rg /F1 7.5 Tf '+(W-M-42)+' 25 Td ('+(index+1)+' / '+pages.length+') Tj ET' : '';
          const content = enc(p.ops.join('\n')+footer);
          const cRef = addObj('<< /Length ' + content.length + ' >>', content);
          const uniq = p.imgs.filter((v, i, a) => a.indexOf(v) === i);
          const xo = uniq.length ? ' /XObject << ' + uniq.map(id => '/' + id + ' ' + imgRefs[id] + ' 0 R').join(' ') + ' >>' : '';
          pageRefs.push(addObj('<< /Type /Page /Parent ' + pagesRef + ' 0 R /MediaBox [0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '] ' +
            '/Resources << /Font << /F1 ' + fontR + ' 0 R /F2 ' + fontB + ' 0 R >>' + xo + ' >> /Contents ' + cRef + ' 0 R >>'));
        });
        const pgs = addObj('<< /Type /Pages /Count ' + pageRefs.length + ' /Kids [' + pageRefs.map(r => r + ' 0 R').join(' ') + '] >>');
        const cat = addObj('<< /Type /Catalog /Pages ' + pgs + ' 0 R >>');
        const offsets = [];
        objs.forEach((o, i) => {
          offsets[i + 1] = pos;
          push(enc((i + 1) + ' 0 obj\n' + o.body + '\n'));
          if (o.stream) { push(enc('stream\n')); push(o.stream); push(enc('\nendstream\n')); }
          push(enc('endobj\n'));
        });
        const xref = pos;
        let x = 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
        for (let i = 1; i <= objs.length; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
        x += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
        push(enc(x));
        const total = chunks.reduce((a, c) => a + c.length, 0);
        const out = new Uint8Array(total);
        let k = 0; chunks.forEach(c => { out.set(c, k); k += c.length; });
        return out;
      }
    };
    newPage();
    return api;
  }

  function jpegSize(bytes) {
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let i = 2;
    while (i < bytes.length - 9) {
      if (bytes[i] !== 0xFF) { i++; continue; }
      const m = bytes[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC)
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  return { create: create, jpegSize: jpegSize };
})();

export default PDFW;
export const crearPDF: (opt?: any) => any = PDFW.create;
export const jpegSize: (bytes: Uint8Array) => { w: number; h: number } | null = PDFW.jpegSize;
