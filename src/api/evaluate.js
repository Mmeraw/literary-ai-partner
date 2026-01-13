// src/api/evaluate.js
// MVP: Direct Edge Function call (no auth required)

/**
 * Evaluate manuscript using Supabase Edge Function
 * @param {string} manuscriptText - The manuscript content to evaluate
 * @returns {Promise<Object>} - Evaluation results with 13 criteria
 */
export async function evaluateManuscript(manuscriptText) {
  const url = import.meta.env.VITE_EVALUATE_URL;
  if (!url) {
    throw new Error('Missing VITE_EVALUATE_URL environment variable');
  }

  const token = import.meta.env.VITE_EVAL_TOKEN || '';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Eval-Token': token } : {}),
      },
      body: JSON.stringify({ text: manuscriptText }),
    });

    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) {
      throw new Error(data?.error || `Evaluate failed (${res.status})`);
    }

    return data;
  } catch (err) {
    console.error('Evaluation error:', err);
    throw err;
  }
}

/**
 * Get evaluation history (placeholder for future implementation)
 * @returns {Promise<Array>} - Array of past evaluations
 */
export async function getEvaluationHistory() {
  // TODO: Implement when user system is added
  return [];
}

/**
 * Get a specific evaluation (placeholder for future implementation)
 * @param {string} evaluationId - The evaluation ID
 * @returns {Promise<Object>} - Evaluation data
 */
export async function getEvaluation(evaluationId) {
  // TODO: Implement when user system is added
  throw new Error('Not implemented: getEvaluation');
}
