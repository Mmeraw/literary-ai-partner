import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as Sentry from 'npm:@sentry/deno@8.43.0';

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('BASE44_ENV') ?? 'production',
  tracesSampleRate: 1.0,
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { manuscript_id } = await req.json();

    if (!manuscript_id) {
      return Response.json({ error: 'Manuscript ID required' }, { status: 400 });
    }

    // Get manuscript
    const manuscripts = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscript_id });
    const manuscript = manuscripts[0];

    if (!manuscript) {
      return Response.json({ error: 'Manuscript not found' }, { status: 404 });
    }

    const text = manuscript.full_text;
    
    // Split logic: Look for chapter markers
    const chapterRegex = /(?:^|\n)(?:Chapter|CHAPTER|Ch\.|ch\.)[\s]*(\d+|[IVXLCDM]+)[:\s]*([^\n]*)/gm;
    const matches = [...text.matchAll(chapterRegex)];
    
    const chapters = [];
    
    if (matches.length > 0) {
      // Split by chapter markers
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const startIndex = match.index;
        const endIndex = i < matches.length - 1 ? matches[i + 1].index : text.length;
        
        const chapterText = text.slice(startIndex, endIndex).trim();
        const chapterTitle = match[2]?.trim() || `Chapter ${i + 1}`;
        const wordCount = chapterText.split(/\s+/).length;
        
        chapters.push({
          manuscript_id,
          order: i + 1,
          title: chapterTitle,
          text: chapterText,
          word_count: wordCount,
          status: 'pending'
        });
      }
    } else {
      // No markers found - split into ~2000 word chunks
      const words = text.split(/\s+/);
      const chunkSize = 2000;
      let chapterNum = 1;
      
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkWords = words.slice(i, i + chunkSize);
        const chapterText = chunkWords.join(' ');
        
        chapters.push({
          manuscript_id,
          order: chapterNum,
          title: `Section ${chapterNum}`,
          text: chapterText,
          word_count: chunkWords.length,
          status: 'pending'
        });
        
        chapterNum++;
      }
    }

    // Create chapter records
    await base44.asServiceRole.entities.Chapter.bulkCreate(chapters);

    // Update manuscript status
    await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
      status: 'ready'
    });

    return Response.json({ 
      success: true,
      chapter_count: chapters.length
    });

  } catch (error) {
    console.error('Split error:', error);
    
    // Capture to Sentry with context
    Sentry.captureException(error, {
      extra: {
        function: 'splitManuscript',
        operation: 'text_parsing',
        manuscript_id,
        manuscript_title: manuscript?.title,
        word_count: manuscript?.word_count,
        chapter_count: chapters?.length,
        user_email: user?.email,
        error_message: error.message,
        timestamp: new Date().toISOString()
      }
    });
    await Sentry.flush(2000);
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});