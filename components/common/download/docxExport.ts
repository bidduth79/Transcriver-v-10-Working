// Real Word (.docx) file for a transcript: one paragraph per line, speaker names bold, keywords highlighted
import { normalizeTimestamps } from './exportContent';
import { buildZip } from './zipStore';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Nirmala UI ships with Windows and covers Bengali; Word/Docs fall back when it is missing
const FONT = '<w:rFonts w:ascii="Nirmala UI" w:hAnsi="Nirmala UI" w:cs="Nirmala UI" w:eastAsia="Nirmala UI"/>';
const SIZE = '<w:sz w:val="24"/><w:szCs w:val="24"/>';

// Control characters other than tab/newline are not allowed in XML
const isXmlChar = (ch: string) => {
  const code = ch.charCodeAt(0);
  return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
};

const escapeXml = (text: string) => Array.from(text).filter(isXmlChar).join('')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const run = (text: string, style: 'plain' | 'speaker' | 'keyword') => {
  if (!text) return '';
  const look = style === 'speaker' ? '<w:b/><w:bCs/><w:color w:val="4338CA"/>'
    : style === 'keyword' ? '<w:b/><w:bCs/><w:color w:val="FFFFFF"/>' : '';
  const shade = style === 'keyword' ? '<w:shd w:val="clear" w:color="auto" w:fill="EF4444"/>' : '';
  return `<w:r><w:rPr>${FONT}${look}${SIZE}${shade}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
};

// Split on the capturing keyword regex: odd pieces are the matched keywords
const keywordRuns = (text: string, keywordRegex: RegExp | null, base: 'plain' | 'speaker') =>
  (keywordRegex ? text.split(keywordRegex) : [text])
    .map((piece, i) => run(piece, i % 2 === 1 ? 'keyword' : base)).join('');

const paragraph = (line: string, keywordRegex: RegExp | null) => {
  const runs = line.split(/\*\*(.*?)\*\*/g)
    .map((piece, i) => keywordRuns(piece, keywordRegex, i % 2 === 1 ? 'speaker' : 'plain')).join('');
  return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${runs}</w:p>`;
};

const documentXml = (body: string) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  body +
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
  '</w:body></w:document>';

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

export const buildDocxBlob = (transcript: unknown, keywordRegex: RegExp | null) => {
  const lines = normalizeTimestamps(transcript).split('\n');
  const body = lines.map(line => paragraph(line, keywordRegex)).join('');
  const zip = buildZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'word/document.xml', data: documentXml(body) },
  ]);
  return new Blob([zip], { type: DOCX_MIME });
};
