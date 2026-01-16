export default function EvaluateEntry() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Manuscript Evaluation</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <p className="text-gray-700 mb-4">
          Upload your manuscript for AI-powered evaluation based on our 
          13 Canonical Story Criteria and 60+ WAVE diagnostic checklist.
        </p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded">
          Start Evaluation
        </button>
      </div>
    </div>
  );
}
