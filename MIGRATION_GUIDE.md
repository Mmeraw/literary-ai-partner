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
