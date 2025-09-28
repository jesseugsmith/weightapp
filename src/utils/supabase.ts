import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// This client is for use in the browser
export const supabase = createClientComponentClient();
