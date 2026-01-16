'use client';

import { useState } from 'react';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: input }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6">RevisionGrade™ minimal app is running.</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-md bg-gray-100 p-6 rounded">
        <label className="block text-sm font-medium mb-2">Test Input:</label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter test data..."
          className="w-full px-3 py-2 border rounded mb-4 text-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded font-medium disabled:bg-gray-400"
        >
          {loading ? 'Sending...' : 'Test Endpoint'}
        </button>
      </form>

      {error && <p className="mt-4 text-red-600">Error: {error}</p>}

    {response && (
        <pre className="mt-4 bg-gray-200 p-4 rounded text-black text-sm overflow-auto max-w-md">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </main>
  );
}
