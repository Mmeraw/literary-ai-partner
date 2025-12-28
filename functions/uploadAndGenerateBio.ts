import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        // Upload the file
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Extract data from CV/Resume
        const extractedData = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url,
            json_schema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    education: { type: "array", items: { type: "string" } },
                    work_experience: { type: "array", items: { type: "string" } },
                    publications: { type: "array", items: { type: "string" } },
                    awards: { type: "array", items: { type: "string" } },
                    skills: { type: "array", items: { type: "string" } }
                }
            }
        });

        if (extractedData.status !== 'success') {
            return Response.json({ 
                success: false, 
                error: 'Failed to extract CV data' 
            }, { status: 400 });
        }

        const cvData = extractedData.output;

        // Generate author bio
        const bio = await base44.integrations.Core.InvokeLLM({
            prompt: `Generate a professional author bio (150-200 words) for literary agent submissions based on this CV/resume data:

Name: ${cvData.name || 'Author'}
Education: ${cvData.education?.join(', ') || 'N/A'}
Work Experience: ${cvData.work_experience?.join(', ') || 'N/A'}
Publications: ${cvData.publications?.join(', ') || 'None listed'}
Awards: ${cvData.awards?.join(', ') || 'None listed'}
Skills: ${cvData.skills?.join(', ') || 'N/A'}

Create a concise, agent-ready bio that:
- Highlights relevant credentials (degrees, professional experience, writing awards)
- Mentions any published work or writing credentials
- Focuses on elements that establish writing authority
- Is written in third person
- Is professional but engaging

Return only the bio text, no additional commentary.`
        });

        return Response.json({
            success: true,
            bio: bio,
            authorName: cvData.name || null
        });

    } catch (error) {
        console.error('CV bio generation error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});