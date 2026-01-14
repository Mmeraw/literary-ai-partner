import React from 'react';

// Simple Button component
const Button = ({ children, className = "", ...props }) => (
  <button 
    className={`inline-flex items-center justify-center rounded-md px-6 py-3 font-medium transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);

// Simple Badge component
const Badge = ({ children, className = "" }) => (
  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${className}`}>
    {children}
  </span>
);

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="font-bold text-lg text-slate-900">RevisionGrade™</div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-slate-600 hover:text-indigo-600 font-medium transition-colors">Features</a>
              <a href="#wave" className="text-sm text-slate-600 hover:text-indigo-600 font-medium transition-colors">WAVE System</a>
              <a href="#packages" className="text-sm text-slate-600 hover:text-indigo-600 font-medium transition-colors">Packages</a>
              <a href="/resources" className="text-sm text-slate-600 hover:text-indigo-600 font-medium transition-colors">Resources</a>
              <a href="/pricing" className="text-sm text-slate-600 hover:text-indigo-600 font-medium transition-colors">Pricing</a>
              <Button className="ml-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 text-sm">
                Get Started →
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2 border-t border-slate-200">
              <a href="#features" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">Features</a>
              <a href="#wave" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">WAVE System</a>
              <a href="#packages" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">Packages</a>
              <a href="/resources" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">Resources</a>
              <a href="/pricing" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded">Pricing</a>
              <Button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
                Get Started →
              </Button>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-white">
        <div className="max-w-5xl mx-auto px-6 pt-6 pb-6">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-indigo-600 tracking-tight leading-tight mb-3">
              RevisionGrade™ — A Professional Revision Framework
            </h1>
            <p className="text-lg sm:text-xl text-slate-700 max-w-2xl mx-auto mb-3 font-medium">
              Built to meet the standards gatekeepers expect.
            </p>
            <p className="text-base sm:text-lg text-slate-700 max-w-2xl mx-auto mb-8 font-medium">
              See the <a href="/resources" className="font-bold text-indigo-600 hover:text-indigo-700 underline">Resources</a> page for proof.
            </p>
            <div>
              <Button className="h-16 px-12 text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                Start a Free Evaluation →
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* WAVE IP Callout */}
      <div id="wave" className="max-w-4xl mx-auto px-6 py-5">
        <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 border-2 border-indigo-200 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-indigo-600 text-white text-2xl">🌊</div>
            <h2 className="text-2xl font-bold text-slate-900">The WAVE Revision System (Core IP)</h2>
          </div>
          <div className="space-y-4 text-slate-700">
            <p className="leading-relaxed">
              WAVE is a late-stage revision system for manuscripts and screenplays that already have a working story spine but still need disciplined editing to read as professional and submission-ready.
            </p>
            <p className="leading-relaxed">
              It is diagnostic and multi-pass: each evaluation isolates a specific failure pattern, explains why it weakens the story, and shows how to fix it.
            </p>
            <p className="leading-relaxed">
              RevisionGrade applies WAVE across your work automatically, tracking issues along the story spine—not just chapter by chapter—so you can see the standards and stay in control of every change.
            </p>
            <p className="leading-relaxed font-semibold text-indigo-900">
              Revision Framework-AI executes the analysis. WAVE defines the standard.
            </p>
            <p className="leading-relaxed font-semibold text-indigo-900">
              The intellectual property—the standard itself—is human-crafted.
            </p>
          </div>
        </div>
      </div>

      {/* Reality Check Section */}
      <div className="bg-slate-900 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="space-y-6 text-slate-200">
            <h2 className="text-3xl font-bold text-white mb-6">The Agent Reality Check</h2>
            <p className="leading-relaxed">
              Despite the myths, commercial literature is highly patterned. Agents are trained to gauge—fast—whether your pages are likely to sell, not to canonize you as an artist.
            </p>
            <p className="leading-relaxed">
              In practice, trained and untrained eyes give your manuscript seconds at each gate. Does it intrigue, captivate, and hold attention? If not, you don't get a reply.
            </p>
            <div className="p-8 rounded-xl bg-indigo-900/60 border-2 border-indigo-600">
              <p className="leading-relaxed text-white text-lg">
                <strong className="text-indigo-200">Elevate Your Game™</strong> by running your work through the RevisionGrade framework: a PhD-calibrated scoring engine built on the 13 Story Evaluation Criteria and the proprietary WAVE Revision System.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="packages" className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-slate-900">End-to-End IP Standards Engine</h2>
          <p className="mt-3 text-lg text-slate-700 max-w-3xl mx-auto font-medium">
            What once required months of back-and-forth, multiple tools, and subjective review is now unified into a single, standards-driven system.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: "📚",
              title: "Agent Package",
              description: "Query, logline, and short/medium/long synopsis drafted from your manuscript or screenplay and calibrated to professional submission standards."
            },
            {
              icon: "🎬",
              title: "Film Adaptation Package",
              description: "Screen-focused pitch materials delivered as text files: logline, one-page overview, beat-level summary, and notes on structure, tone, and audience."
            },
            {
              icon: "✅",
              title: "Complete Submission Package",
              description: "Author bio, 5–10 market comps, targeted agent list, query draft, and synopsis options—organized so you can assemble a professional submission."
            }
          ].map((feature, idx) => (
            <div key={idx} className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-700 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Creator Attribution */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">About RevisionGrade™</h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            Created by <strong>Michael J. Meraw (Major, Retired), CD, SCPM (Stanford), BComm, AGDM, MBA</strong>. 
            RevisionGrade™ was designed by a former military pilot and corporate aerospace leader with deep expertise in root-cause corrective action and metrics-driven continuous improvement.{' '}
            <a 
              href="https://michaeljmeraw.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 font-medium underline"
            >
              Learn more about the creator →
            </a>
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-white py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-8">
            Ready to Transform Your Writing?
          </h2>
          <Button className="h-16 px-12 text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
            Start a Free Evaluation →
          </Button>
        </div>
      </div>
    </div>
  );
}
