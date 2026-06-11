import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhampodWJyaHlib2RnZ2JxYXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzM3MDUsImV4cCI6MjA4MDM0OTcwNX0.Te4JGaR7DnSiejugyZHV0_uQSWsG_TS_xTmRgxgM5-4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const sql = `ALTER TABLE records ADD COLUMN IF NOT EXISTS "workCompletedDate" DATE;`;
  
  // Try common exec sql rpc names
  for (const rpcName of ['exec_sql', 'run_sql', 'sql', 'execute_sql']) {
    try {
      const { data, error } = await supabase.rpc(rpcName, { sql: sql, query: sql });
      if (!error) {
        console.log(`Success using rpc "${rpcName}"!`, data);
        return;
      } else {
        console.log(`RPC "${rpcName}" returned error:`, error.message);
      }
    } catch (e: any) {
      console.log(`RPC "${rpcName}" threw exception:`, e.message || e);
    }
  }
}

test();
