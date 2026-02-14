import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function fix() {
  const cutoff = new Date(Date.now() - 10*60*1000).toISOString();
  const { data } = await supabase.from('jobs').select('*').eq('status','running').lt('updated_at', cutoff);
  console.log('Found', data?.length || 0, 'stuck jobs');
  for (const j of data || []) {
    await supabase.from('jobs').update({status:'queued',lease_expires_at:null,lease_owner:null}).eq('id',j.id);
    console.log('Reset job', j.id);
  }
}
fix();
