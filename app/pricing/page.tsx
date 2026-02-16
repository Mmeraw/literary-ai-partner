import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Pricing</h1>
      <p className="text-slate-600 mb-6">Choose the plan that fits your needs.</p>
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold">Essentials</h3>
          <p className="text-2xl font-bold text-indigo-600 mt-2 mb-4">Free</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Single manuscript evaluation</li>
            <li>Basic WAVE scoring</li>
            <li>Summary feedback</li>
          </ul>
          <Link href="/evaluate" className="mt-6 block text-center rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700">Get Started</Link>
        </div>
        <div className="rounded-lg border-2 border-indigo-600 p-6">
          <h3 className="text-lg font-semibold">Professional</h3>
          <p className="text-2xl font-bold text-indigo-600 mt-2 mb-4">$29/mo</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Unlimited evaluations</li>
            <li>Full WAVE reports</li>
            <li>Revision tracking</li>
            <li>Content conversion</li>
          </ul>
          <Link href="/evaluate" className="mt-6 block text-center rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700">Get Started</Link>
        </div>
        <div className="rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold">Studio</h3>
          <p className="text-2xl font-bold text-indigo-600 mt-2 mb-4">$79/mo</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Everything in Professional</li>
            <li>Storygate Studio access</li>
            <li>Priority processing</li>
            <li>Admin dashboard</li>
          </ul>
          <Link href="/evaluate" className="mt-6 block text-center rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm font-medium hover:bg-indigo-700">Get Started</Link>
        </div>
      </div>
    </main>
  );
}
