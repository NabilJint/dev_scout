const { createClient } = require('@supabase/supabase-js');
const c = createClient('https://obffumoflzjqtjawbbje.supabase.co', 'sb_publishable_kWDN1LQcQ18VHWjxXu2YiQ_HhXIhu5N');

async function main() {
  const { data, error } = await c.from('tool_sources').select('*').eq('is_active', true);
  if (error) { console.error('Error:', error); process.exit(1); }
  console.log(`Active sources: ${data.length}\n`);
  for (const s of data) {
    console.log(`  ${s.name} (${s.parser_strategy})`);
    console.log(`    URL: ${s.listing_url}`);
    console.log(`    ID: ${s.id}`);
    console.log('');
  }
}
main().catch(console.error);
