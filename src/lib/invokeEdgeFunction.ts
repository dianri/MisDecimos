import type { FunctionInvokeOptions } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { ensureFreshSession } from './sessionManager'
import { createEdgeFunctionInvoker } from './edgeFunctionError'

export const invokeEdgeFunction = createEdgeFunctionInvoker({
  invoke: <T>(functionName: string, options?: FunctionInvokeOptions) =>
    supabase.functions.invoke<T>(functionName, options),
  ensureFreshSession,
  signOut: () => supabase.auth.signOut(),
})
