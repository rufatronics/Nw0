import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const createOfflineSupabaseClient = () => {
  const offlineError = { message: 'Supabase credentials are not configured.' };

  return {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: null, error: offlineError }),
        }),
        limit: async () => ({ data: null, error: offlineError }),
        then: (resolve: (value: { data: null; error: typeof offlineError }) => unknown) =>
          Promise.resolve({ data: null, error: offlineError }).then(resolve),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: () => undefined }),
      }),
    }),
    removeChannel: () => undefined,
    functions: {
      invoke: async () => ({ data: null, error: offlineError }),
    },
  } as unknown as SupabaseClient;
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Running with the local intelligence cache only.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createOfflineSupabaseClient();
