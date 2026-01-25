-- Apply execute_query RPC
import { getSupabaseAdminClient } from '../lib/supabase.js';

const supabase = getSupabaseAdminClient();

const migration = `
CREATE OR REPLACE FUNCTION public.execute_query(query TEXT)
RETURNS TABLE(result JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY EXECUTE format('SELECT to_jsonb(t) FROM (%s) t', query);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_query(TEXT) TO service_role;

COMMENT ON FUNCTION public.execute_query(TEXT) IS
  'Execute introspection queries for testing and monitoring. Service role only.';
`;

async function apply() {
  console.log('Applying execute_query RPC migration...');
  
  const { data, error } = await supabase.rpc('execute_query', { 
    query: migration 
  }).catch(() => {
    // If execute_query doesn't exist yet, fall back to a different approach
    return { data: null, error: { message: 'RPC does not exist yet' } };
  });
  
  if (error) {
    console.log('RPC does not exist, cannot self-apply. Run via Supabase CLI or Dashboard SQL Editor.');
    console.log('\nSQL to execute:');
    console.log(migration);
  } else {
    console.log('Migration applied successfully');
  }
}

apply();
