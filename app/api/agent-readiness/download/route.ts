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
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import {
  AGENT_READINESS_REQUIRED_SECTION_TYPES,
  buildAgentReadinessPackageV1,
  buildPackageExportV1,
  type AgentReadinessRequiredSectionType,
} from '@/lib/agent-readiness/packagePersistence';

interface DownloadRequest {
  manuscriptId?: number | string;
  evaluationJobId?: string;
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

  function sectionsFromPackage(packageRecord: { sections: Record<AgentReadinessRequiredSectionType, string> }): DownloadRequest['sections'] {
    return {
      query_letter: packageRecord.sections.query_letter,
      what_makes_unique: packageRecord.sections.what_makes_unique,
      synopsis: packageRecord.sections.synopsis,
      query_pitch: packageRecord.sections.query_pitch,
      comparables: packageRecord.sections.comparables,
      author_bio: packageRecord.sections.author_bio,
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
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!data.manuscriptTitle) {
      return NextResponse.json({ error: 'manuscriptTitle is required' }, { status: 400 });
    }

    if (!data.manuscriptId || !data.evaluationJobId) {
      return NextResponse.json({ error: 'manuscriptId and evaluationJobId are required for governed package export' }, { status: 400 });
    }

    const format = data.format || 'txt';
    if (format !== 'txt' && format !== 'docx') {
      return NextResponse.json({ error: 'format must be txt or docx' }, { status: 400 });
    }

    const manuscriptId = Number(data.manuscriptId);
    if (!Number.isFinite(manuscriptId)) {
      return NextResponse.json({ error: 'manuscriptId must be numeric' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: approvedSections, error: sectionError } = await admin
      .from('agent_readiness_sections')
      .select('section_type, content, updated_at')
      .eq('user_id', user.id)
      .eq('manuscript_id', manuscriptId)
      .eq('evaluation_job_id', data.evaluationJobId)
      .eq('status', 'approved');

    if (sectionError) {
      console.error('[AgentReadiness] Failed to load approved sections for export:', sectionError.message);
      return NextResponse.json({ error: 'Failed to load approved sections' }, { status: 500 });
    }

    const { count, error: countError } = await admin
      .from('agent_readiness_packages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('manuscript_id', manuscriptId)
      .eq('evaluation_job_id', data.evaluationJobId);

    if (countError) {
      console.error('[AgentReadiness] Failed to count package versions:', countError.message);
      return NextResponse.json({ error: 'Failed to allocate package version' }, { status: 500 });
    }

    const assembly = buildAgentReadinessPackageV1({
      manuscriptId,
      evaluationJobId: data.evaluationJobId,
      userId: user.id,
      manuscriptTitle: data.manuscriptTitle,
      approvedSections: (approvedSections ?? []) as Array<{ section_type: string; content: string; updated_at?: string | null }>,
      packageVersion: (count ?? 0) + 1,
    });

    if (!assembly.ok) {
      return NextResponse.json({
        error: 'All six Agent Readiness sections must be approved before export',
        missingSections: assembly.completeness.missingSections,
      }, { status: 422 });
    }

    const { data: packageRow, error: packageError } = await admin
      .from('agent_readiness_packages')
      .insert({
        user_id: user.id,
        manuscript_id: manuscriptId,
        evaluation_job_id: data.evaluationJobId,
        manuscript_title: data.manuscriptTitle,
        package_version: assembly.package.package_version,
        package_hash: assembly.package.package_hash,
        artifact_type: assembly.package.artifact_type,
        artifact_version: assembly.package.artifact_version,
        sections: assembly.package.sections,
        section_hashes: assembly.package.section_hashes,
      })
      .select('id')
      .single();

    if (packageError || !packageRow) {
      console.error('[AgentReadiness] Failed to persist package:', packageError?.message);
      return NextResponse.json({ error: 'Failed to persist package record' }, { status: 500 });
    }

    const missingClientSections = AGENT_READINESS_REQUIRED_SECTION_TYPES.filter((sectionType) => !assembly.package.sections[sectionType]);
    if (missingClientSections.length > 0) {
      return NextResponse.json({ error: 'Persisted package is incomplete', missingSections: missingClientSections }, { status: 500 });
    }

    const filename = `${data.manuscriptTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-')}-Submission-Package`;
    const exportArtifact = buildPackageExportV1({
      packageHash: assembly.package.package_hash,
      format,
      filename: `${filename}.${format === 'docx' ? 'doc' : 'txt'}`,
    });

    const { error: exportError } = await admin
      .from('agent_readiness_package_exports')
      .insert({
        package_id: packageRow.id,
        user_id: user.id,
        manuscript_id: manuscriptId,
        evaluation_job_id: data.evaluationJobId,
        package_hash: exportArtifact.package_hash,
        format: exportArtifact.format,
        filename: exportArtifact.filename,
      });

    if (exportError) {
      console.error('[AgentReadiness] Failed to persist package export:', exportError.message);
      return NextResponse.json({ error: 'Failed to persist package export' }, { status: 500 });
    }

    const responseData: DownloadRequest = {
      ...data,
      sections: sectionsFromPackage(assembly.package),
    };

    if (format === 'docx') {
      const xml = buildDocxXml(responseData);
      return new NextResponse(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/msword',
          'Content-Disposition': `attachment; filename="${filename}.doc"`,
          'X-Agent-Readiness-Package-Hash': assembly.package.package_hash,
        },
      });
    }

    // Default: plain text
    const text = buildPlainText(responseData);
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.txt"`,
        'X-Agent-Readiness-Package-Hash': assembly.package.package_hash,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate download' },
      { status: 500 }
    );
  }
}
