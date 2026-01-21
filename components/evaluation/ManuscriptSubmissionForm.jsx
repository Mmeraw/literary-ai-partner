"use client";

import { useState } from "react";

/**
 * Track A: Evaluation Entry
 * Single UI entry point to create evaluate_full jobs via POST /api/jobs
 */
export default function ManuscriptSubmissionForm({ onSubmitSuccess }) {
  const [manuscriptText, setManuscriptText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!manuscriptText.trim()) {
      setError("Please enter manuscript text");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create evaluate_full job via POST /api/jobs
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          manuscript_id: `ms_${Date.now()}`, // Generate temporary ID
          job_type: "evaluate_full",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create evaluation job");
      }

      const data = await response.json();
      
      // Clear form
      setManuscriptText("");
      
      // Notify parent of success
      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Submit Manuscript for Evaluation
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label 
              htmlFor="manuscript-text" 
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Manuscript Text
            </label>
            <textarea
              id="manuscript-text"
              value={manuscriptText}
              onChange={(e) => setManuscriptText(e.target.value)}
              placeholder="Paste your manuscript text here..."
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !manuscriptText.trim()}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Starting Evaluation..." : "Start Evaluation"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500">
          Your manuscript will be evaluated in two phases. This usually takes 2–3 minutes.
        </p>
      </div>
    </div>
  );
}
