# RevisionGrade Migration Guide: Base44 to Supabase/Vercel

## Overview

This guide documents the migration process from Base44 to Supabase (backend) and Vercel (frontend hosting) for the RevisionGrade manuscript evaluation platform.

## Migration Status

### ✅ Completed Steps

1. **Base44 Export Review** - Analyzed Base44 export structure and data
2. **Database Schema Creation** - Created Supabase tables:
   - `manuscripts` - Stores uploaded manuscripts
   - `evaluations` - Stores manuscript evaluations
   - `access_log` - Tracks user access and actions
   - `analytics` - Stores analytics events
   - `story_criteria` - Stores evaluation criteria

3. **Row Level Security (RLS)** - Implemented security policies:
   - Users can only access their own manuscripts
   - Users can only view their own evaluations
   - Story criteria are readable by all authenticated users
4. **Edge Function Creation** - Created `/evaluate` endpoint with 13 RevisionGrade criteria

### Canonical 13 Story Criteria (Locked)

The Edge Function evaluates manuscripts using these **exact** 13 criteria:

1. **Opening Hook** — `opening_hook`
2. **Narrative Voice & Style** — `narrative_voice_style`
3. **Character Depth & Introduction** — `character_depth_introduction`
4. **Conflict, Tension & Escalation** — `conflict_tension_escalation`
5. **Thematic Resonance** — `thematic_resonance`
6. **Structure, Pacing & Flow** — `structure_pacing_flow`
7. **Dialogue & Subtext** — `dialogue_subtext`
8. **Worldbuilding & Immersion** — `worldbuilding_immersion`
9. **Stakes & Emotional Investment** — `stakes_emotional_investment`
10. **Line-Level Craft & Polish** — `line_level_craft_polish`
11. **Marketability & Genre Position** — `marketability_genre_position`
12. **Narrative Closure & Promises Kept** — `narrative_closure_promises_kept`
13. **Would They Keep Reading?** — `would_keep_reading_gate` (Hard gate, not averaged)

Each criterion scores 1-10. Criterion #13 acts as a gate criterion.
5. **Frontend API Wrapper** - Created `src/api/evaluate.js` for Supabase integration

### 🚧 Pending Steps

1. **Data Migration** - Migrate existing data from Base44
2. **Vercel Deployment** - Deploy frontend to Vercel
3. **Environment Configuration** - Set up API keys and connections
4. **Testing** - Comprehensive testing of migrated application

## Supabase Configuration

### Project Details
- **Project Name**: tsavobc@hotmail.com's Project
- **Database URL**: Available in Supabase Project Settings
- **API Keys**: Available in Supabase Project Settings > API

### Database Schema

#### manuscripts table
```sql
id BIGSERIAL PRIMARY KEY
user_id UUID NOT NULL
created_at TIMESTAMPTZ DEFAULT now()
title TEXT NOT NULL
file_url TEXT
file_size BIGINT
work_type TEXT
status TEXT DEFAULT 'uploaded'
updated_at TIMESTAMPTZ DEFAULT now()
```

#### evaluations table
```sql
id BIGSERIAL PRIMARY KEY
manuscript_id BIGINT REFERENCES manuscripts(id)
user_id UUID NOT NULL
evaluation_data JSONB
score DECIMAL(5,2)
status TEXT DEFAULT 'pending'
created_at TIMESTAMPTZ DEFAULT now()
updated_at TIMESTAMPTZ DEFAULT now()
```

## Next Steps

### 1. Frontend Migration to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. Navigate to your frontend directory
3. Run `vercel` to deploy
4. Configure environment variables in Vercel dashboard

### 2. Environment Variables

Add these to your Vercel project:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Frontend Code Changes

Install Supabase client:
```bash
npm install @supabase/supabase-js
```

Create Supabase client:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
```

### 4. Data Migration

Use the reorganization script to prepare Base44 exports:
```bash
node scripts/reorganize-base44-exports.js
```

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [GitHub Repository](https://github.com/Mmeraw/literary-ai-partner)

## Support

For questions or issues during migration, refer to:
- Supabase Discord: https://discord.supabase.com
- Vercel Support: https://vercel.com/support

## Migration Timeline

- **Phase 1 (Completed)**: Database setup and schema creation
- **Phase 2 (Next)**: Data migration and Vercel deployment  
- **Phase 3 (Future)**: Testing and production cutover


## Deployment Instructions

### Prerequisites

1. **Install Supabase CLI**:
```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Linux
brew install supabase/tap/supabase
```

2. **Login to Supabase**:
```bash
supabase login
```

### Deploy Edge Function

1. **Link your project** (if not already linked):
```bash
supabase link --project-ref xtumxjnzdswuumndcbwc
```

2. **Deploy the evaluate function**:
```bash
cd supabase/functions/evaluate
supabase functions deploy evaluate --no-verify-jwt
```

3. **Set environment variables** (if needed):
```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
```

4. **Verify deployment**:
```bash
supabase functions list
```

### Environment Variables

Add these to your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_supabase_dashboard
```

Get your anon key from: Supabase Dashboard > Project Settings > API

### Frontend Integration

Replace Base44 evaluation calls with:

```javascript
import { evaluateManuscript } from './api/evaluate';

// Instead of Base44 call
const result = await evaluateManuscript(manuscriptText, userId);
```

### Vercel Deployment

1. **Connect GitHub repo** to Vercel
2. **Add environment variables** in Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Deploy**: Vercel will auto-deploy on push to main

### Testing

Test the Edge Function:

```bash
curl -i --location --request POST 'https://xtumxjnzdswuumndcbwc.supabase.co/functions/v1/evaluate' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"text":"Sample manuscript text","user_id":"test-user-id"}'
```
