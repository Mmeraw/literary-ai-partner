/**
 * POST /api/agent-readiness/download
 *
 * Assembles the full Agent Readiness submission package and returns it
 * as a downloadable .txt or .docx file.
 *
 * Accepts the generated section content and formats it into a
 * professional submission-ready document.
 */

import { NextResponse } from 'next/server';

interface DownloadRequest {
  manuscriptTitle: string;
  authorName?: string;
  format: 'txt' | 'docx';
  sections: {
    query_letter?: string;
    what_makes_unique?: string;
    synopsis?: string;
    query_pitch?: string;
    comparables?: string;
    author_bio?: string;
  };
}

function buildPlainText(data: DownloadRequest): string {
  const lines: string[] = [];
  const divider = '═'.repeat(72);
  const thinDivider = '─'.repeat(72);

  lines.push(divider);
  lines.push('');
  lines.push(`  AGENT READINESS SUBMISSION PACKAGE`);
  lines.push(`  ${data.manuscriptTitle.toUpperCase()}`);
  if (data.authorName) {
    lines.push(`  by ${data.authorName}`);
  }
  lines.push('');
  lines.push(divider);
  lines.push('');
  lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push('');

  const sectionOrder: { key: keyof DownloadRequest['sections']; label: string }[] = [
    { key: 'query_pitch', label: 'QUERY PITCH' },
    { key: 'query_letter', label: 'QUERY LETTER' },
    { key: 'what_makes_unique', label: 'WHAT MAKES THIS NOVEL UNIQUE' },
    { key: 'synopsis', label: 'SYNOPSIS' },
    { key: 'comparables', label: 'COMPARABLES' },
    { key: 'author_bio', label: 'AUTHOR BIO' },
  ];

  for (const { key, label } of sectionOrder) {
    const content = data.sections[key];
    if (!content) continue;

    lines.push(thinDivider);
    lines.push(`  ${label}`);
    lines.push(thinDivider);
    lines.push('');
    lines.push(content.trim());
    lines.push('');
    lines.push('');
  }

  lines.push(divider);
  lines.push('');
  lines.push('  END OF SUBMISSION PACKAGE');
  lines.push('');
  lines.push(divider);

  return lines.join('\n');
}

function buildDocxXml(data: DownloadRequest): string {
  // Build a simple DOCX-compatible XML (Word 2003 XML format)
  // This produces a .doc file that modern Word opens correctly
  const sections: { label: string; content: string }[] = [];

  const sectionOrder: { key: keyof DownloadRequest['sections']; label: string }[] = [
    { key: 'query_pitch', label: 'Query Pitch' },
    { key: 'query_letter', label: 'Query Letter' },
    { key: 'what_makes_unique', label: 'What Makes This Novel Unique' },
    { key: 'synopsis', label: 'Synopsis' },
    { key: 'comparables', label: 'Comparables' },
    { key: 'author_bio', label: 'Author Bio' },
  ];

  for (const { key, label } of sectionOrder) {
    const content = data.sections[key];
    if (content) sections.push({ label, content: content.trim() });
  }

  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let body = '';
  // Title
  body += `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Agent Readiness Submission Package</w:t></w:r></w:p>`;
  body += `<w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr><w:r><w:t>${escXml(data.manuscriptTitle)}${data.authorName ? ` by ${escXml(data.authorName)}` : ''}</w:t></w:r></w:p>`;
  body += `<w:p><w:r><w:t>Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</w:t></w:r></w:p>`;
  body += `<w:p/>`;

  for (const { label, content } of sections) {
    body += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escXml(label)}</w:t></w:r></w:p>`;
    // Split content into paragraphs
    const paragraphs = content.split(/\n\n+/);
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      body += `<w:p><w:r><w:t xml:space="preserve">${escXml(trimmed)}</w:t></w:r></w:p>`;
    }
    body += `<w:p/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>${body}</w:body>
</w:wordDocument>`;
}

export async function POST(request: Request) {
  try {
    const data: DownloadRequest = await request.json();

    if (!data.manuscriptTitle) {
      return NextResponse.json({ error: 'manuscriptTitle is required' }, { status: 400 });
    }

    if (!data.sections || Object.keys(data.sections).length === 0) {
      return NextResponse.json({ error: 'At least one section is required' }, { status: 400 });
    }

    const format = data.format || 'txt';
    const filename = `${data.manuscriptTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}-Submission-Package`;

    if (format === 'docx') {
      const xml = buildDocxXml(data);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="${filename}.doc"`,
        },
      });
    }

    // Default: plain text
    const text = buildPlainText(data);
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.txt"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate download' },
      { status: 500 }
    );
  }
}
