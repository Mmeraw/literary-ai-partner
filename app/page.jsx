export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-6xl font-bold text-indigo-600">
          RevisionGrade™
        </h1>
        <p className="text-xl text-gray-600">
          Next.js Migration Complete
        </p>
        <div className="mt-8 p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto">
          <p className="text-sm text-gray-500 font-mono">
            Governance Version: 1.0.0
          </p>
          <p className="text-sm text-gray-500 font-mono mt-2">
            Platform: Next.js + Base44 SDK
          </p>
          <p className="text-sm text-green-600 font-semibold mt-4">
            ✓ Ready for /api/health
          </p>
        </div>
      </div>
    </div>
  );
}
