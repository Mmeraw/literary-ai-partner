import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Evaluate manuscript using Supabase Edge Function
 * @param {string} manuscriptText - The manuscript content to evaluate
 * @param {string} userId - The user ID from authentication
 * @returns {Promise<Object>} - Evaluation results with scores and feedback
 */
export async function evaluateManuscript(manuscriptText, userId) {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('User must be authenticated to evaluate manuscripts');
    }

    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('evaluate', {
      body: {
        text: manuscriptText,
        user_id: userId
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(`Evaluation failed: ${error.message}`);
    }

    return data;
  } catch (err) {
    console.error('Evaluation error:', err);
    throw err;
  }
}

/**
 * Get evaluation history for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} - Array of past evaluations
 */
export async function getEvaluationHistory(userId) {
  try {
    const { data, error } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching evaluation history:', err);
    throw err;
  }
}

/**
 * Get a specific evaluation by ID
 * @param {string} evaluationId - The evaluation ID
 * @returns {Promise<Object>} - Evaluation data
 */
export async function getEvaluation(evaluationId) {
  try {
    const { data, error } = await supabase
      .from('manuscripts')
      .select('*')
      .eq('id', evaluationId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching evaluation:', err);
    throw err;
  }
}
