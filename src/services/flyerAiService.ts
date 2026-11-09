import { supabase } from '../lib/supabase';
import { createFlyerAiGenerator } from './flyerAiClient';

/** Interface para futura tela; não invoca o conteúdo do website. */
export const generateFlyerAi = createFlyerAiGenerator((name, options) => supabase.functions.invoke(name, options));
export type { FlyerAiInput, FlyerAiSuggestion } from '../../supabase/functions/_shared/flyerAiContract';
export type { FlyerAiResult } from './flyerAiClient';
