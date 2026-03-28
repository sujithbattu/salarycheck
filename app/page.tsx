'use client';

import React, { useMemo, useState } from 'react';

const ROLE_DATA = {
  'software-engineer': { label: 'Software Engineer', min: 85000, mid: 115000, max: 145000 },
  'senior-software-engineer': { label: 'Senior Software Engineer', min: 130000, mid: 170000, max: 215000 },
  'backend-engineer': { label: 'Backend Engineer', min: 100000, mid: 135000, max: 175000 },
  'java-developer': { label: 'Java Developer', min: 95000, mid: 130000, max: 165000 },
  'full-stack-engineer': { label: 'Full Stack Engineer', min: 100000, mid: 135000, max: 175000 },
  'devops-engineer': { label: 'DevOps Engineer', min: 110000, mid: 145000, max: 185000 },
  'data-engineer': { label: 'Data Engineer', min: 110000, mid: 150000, max: 190000 },
  'qa-engineer': { label: 'QA Engineer', min: 75000, mid: 100000, max: 130000 },
  'product-manager': { label: 'Product Manager', min: 110000, mid: 150000, max: 190000 },
} as const;

const LOCATION_FACTORS = {
  'san-francisco-bay-area': { label: 'San Francisco Bay Area', factor: 1.22 },
  'new-york-city': { label: 'New York City', factor: 1.19 },
  'seattle': { label: 'Seattle', factor: 1.13 },
  'los-angeles': { label: 'Los Angeles', factor: 1.08 },
  'austin': { label: 'Austin', factor: 1.03 },
  'boston': { label: 'Boston', factor: 1.08 },
  'chicago': { label: 'Chicago', factor: 0.98 },
  'atlanta': { label: 'Atlanta', factor: 0.94 },
  'dallas': { label: 'Dallas', factor: 0.95 },
  'remote-us': { label: 'Remote (US)', factor: 1.0 },
} as const;

const INDUSTRY_FACTORS = {
  general: { label: 'General', factor: 1.0 },
  fintech: { label: 'FinTech', factor: 1.08 },
  bigtech: { label: 'Big Tech', factor: 1.14 },
  healthcare: { label: 'Healthcare', factor: 0.96 },
  retail: { label: 'Retail', factor: 0.95 },
  consulting: { label: 'Consulting', factor: 0.98 },
  startup: { label: 'Startup', factor: 1.02 },
} as const;

const COMPANY_SIZE_FACTORS = {
  small: { label: '1–50 employees', factor: 0.95 },
  midsize: { label: '51–500 employees', factor: 1.0 },
  large: { label: '500+ employees', factor: 1.05 },
} as const;

type RoleKey = keyof typeof ROLE_DATA;
type LocationKey = keyof typeof LOCATION_FACTORS;
type IndustryKey = keyof typeof INDUSTRY_FACTORS;
type CompanySizeKey = keyof typeof COMPANY_SIZE_FACTORS;

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v || 0);
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function getExperienceFactor(years: number) {
  if (years <= 0) return 0.7;
  if (years <= 1) return 0.8;
  if (years <= 2) return 0.88;
  if (years <= 3) return 0.95;
  if (years <= 5) return 1.0;
  if (years <= 8) return 1.1;
  if (years <= 12) return 1.22;
  return 1.3;
}

function getConfidence(years: number) {
  if (years <= 1) return 67;
  if (years <= 3) return 72;
  if (years <= 5) return 78;
  if (years <= 8) return 82;
  return 79;
}

function calculate({
  role,
  location,
  industry,
  companySize,
  years,
  salary,
}: {
  role: RoleKey;
  location: LocationKey;
  industry: IndustryKey;
  companySize: CompanySizeKey;
  years: number;
  salary: number;
}) {
  const roleData = ROLE_DATA[role];
  const locationFactor = LOCATION_FACTORS[location].factor;
  const industryFactor = INDUSTRY_FACTORS[industry].factor;
  const companyFactor = COMPANY_SIZE_FACTORS[companySize].factor;
  const experienceFactor = getExperienceFactor(years);

  const multiplier = locationFactor * industryFactor * companyFactor * experienceFactor;

  const min = Math.round(roleData.min * multiplier);
  const midpoint = Math.round(roleData.mid * multiplier);
  const max = Math.round(roleData.max * multiplier);

  const lowerFair = Math.round(min * 0.97);
  const upperFair = Math.round(max * 1.03);
  const strongLow = Math.round(min * 0.85);
  const strongHigh = Math.round(max * 1.15);

  let verdict = 'Fairly paid';
  let tone = 'neutral';
  let explanation = 'You appear to be within a reasonable modeled market band for this role profile.';

  if (salary < strongLow) {
    verdict = 'Likely underpaid';
    tone = 'low';
    explanation = 'Your pay appears materially below the modeled market band for this role, location, experience, industry, and company size.';
  } else if (salary < lowerFair) {
    verdict = 'Slightly below market';
    tone = 'low';
    explanation = 'You appear somewhat below the modeled market range. A compensation conversation may be reasonable.';
  } else if (salary > strongHigh) {
    verdict = 'Likely above market';
    tone = 'high';
    explanation = 'Your pay appears materially above the modeled market band for this profile.';
  } else if (salary > upperFair) {
    verdict = 'Slightly above market';
    tone = 'high';
    explanation = 'You appear somewhat above the modeled market range for this profile.';
  }

  const target = tone === 'low' ? Math.round(midpoint * 1.03) : Math.round(midpoint);
  const stretch = Math.round(max * 1.04);
  const confidence = getConfidence(years);
  const position = clamp(((salary - min) / Math.max(max - min, 1)) * 100, 0, 100);
  const gapToTarget = Math.max(target - salary, 0);

  const negotiationLine =
    tone === 'low'
      ? `A reasonable next ask could start near ${formatCurrency(target)}, with a stretch ask around ${formatCurrency(stretch)} if your responsibilities support it.`
      : tone === 'high'
        ? `Your current pay already looks strong for this modeled profile, so further negotiation should be based on impact, retention, or expanded scope.`
        : `You appear near market. You may still have room to push toward ${formatCurrency(stretch)} if your scope, performance, or company band supports it.`;

  return {
    min,
    midpoint,
    max,
    target,
    stretch,
    verdict,
    explanation,
    confidence,
    position,
    gapToTarget,
    negotiationLine,
  };
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {subtitle ? <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm shadow-slate-200/50">
      {children}
    </div>
  );
}

export default function Page() {
  const [role, setRole] = useState<RoleKey>('java-developer');
  const [location, setLocation] = useState<LocationKey>('san-francisco-bay-area');
  const [industry, setIndustry] = useState<IndustryKey>('consulting');
  const [companySize, setCompanySize] = useState<CompanySizeKey>('midsize');
  const [years, setYears] = useState('3');
  const [salary, setSalary] = useState('145000');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  const numericYears = Math.max(Number(years || 0), 0);
  const numericSalary = Math.max(Number(salary || 0), 0);

  const result = useMemo(
    () => calculate({ role, location, industry, companySize, years: numericYears, salary: numericSalary }),
    [role, location, industry, companySize, numericYears, numericSalary]
  );

  async function handleLeadCapture() {
    if (!email.trim()) return;

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, location, industry, companySize, years: numericYears, salary: numericSalary }),
      });

      if (res.ok) {
        setLeadSaved(true);
        setEmail('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.08),_transparent_22%),linear-gradient(to_bottom,_#f8fafc,_#ffffff,_#f1f5f9)] text-slate-900">
      <section className="border-b border-slate-200/70 bg-white/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-slate-950">SalaryCheck</p>
            <p className="mt-1 text-sm text-slate-500">Know your worth in 60 seconds</p>
          </div>
          <div className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm text-white md:block">Beta</div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-16">
        <div>
          <Pill>Market estimate + negotiation guidance</Pill>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl md:leading-[1.02]">
            See if you’re underpaid and what to ask for next.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            Enter your role, location, experience, industry, company size, and current salary. SalaryCheck estimates a modeled market band, gives you a clear verdict, and suggests a smarter target.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard title="Fast answer" value="60 sec" subtitle="Simple workflow" />
            <StatCard title="Useful output" value="Raise target" subtitle="Not just one number" />
            <StatCard title="Smarter logic" value="Role + market" subtitle="Multiple factors, softer verdicts" />
          </div>

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
            <h2 className="text-2xl font-semibold tracking-tight">Why this version is better</h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
              <p>Instead of one hard cutoff, this model uses softer bands: slightly below market, fairly paid, slightly above market, and likely above market.</p>
              <p>It also adjusts using role, years of experience, location, industry, and company size, so edge cases feel more realistic.</p>
              <p className="text-slate-500">Still an estimate, not guaranteed compensation advice.</p>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Run SalaryCheck</h2>
          <p className="mt-2 text-sm text-slate-500">The result updates from your inputs and gives a cleaner verdict.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="mt-6 grid gap-4"
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Job title</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleKey)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
              >
                {Object.entries(ROLE_DATA).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as LocationKey)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {Object.entries(LOCATION_FACTORS).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value as IndustryKey)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {Object.entries(INDUSTRY_FACTORS).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Years of experience</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  placeholder="3"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Current salary</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  placeholder="145000"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Company size</label>
                <select
                  value={companySize}
                  onChange={(e) => setCompanySize(e.target.value as CompanySizeKey)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {Object.entries(COMPANY_SIZE_FACTORS).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 rounded-2xl bg-slate-950 px-4 py-4 text-base font-medium text-white transition hover:opacity-95"
            >
              Run SalaryCheck
            </button>

            <p className="text-xs leading-5 text-slate-500">This MVP uses a modeled benchmark, not a licensed compensation database.</p>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 lg:px-8 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{submitted ? 'Your result' : 'Sample result'}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{result.verdict}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatCard title="Estimated range" value={`${formatCurrency(result.min)} – ${formatCurrency(result.max)}`} subtitle={`Midpoint ${formatCurrency(result.midpoint)}`} />
              <StatCard title="Suggested target" value={formatCurrency(result.target)} subtitle={result.gapToTarget > 0 ? `${formatCurrency(result.gapToTarget)} above current pay` : 'Already at or above target'} />
              <StatCard title="Confidence" value={`${result.confidence}%`} subtitle={`${ROLE_DATA[role].label} · ${LOCATION_FACTORS[location].label}`} />
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Position inside modeled range</p>
                <p className="text-sm font-medium text-slate-900">{Math.round(result.position)}%</p>
              </div>
              <div className="mt-3 h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-slate-950 transition-all" style={{ width: `${result.position}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{formatCurrency(result.min)}</span>
                <span>{formatCurrency(result.max)}</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900">What this means</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{result.explanation}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900">Negotiation note</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{result.negotiationLine}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Get the better report later</h2>
              <p className="mt-2 text-sm text-slate-500">Collect real interest first. Save the premium build for after that.</p>

              <div className="mt-4 rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-sm text-slate-300">Early access</p>
                <p className="mt-2 text-3xl font-semibold">Free beta</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Get notified when stronger salary data, email reports, and templates are ready.</p>
              </div>

              <div className="mt-4 grid gap-3">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">Email address</label>
                <div className="flex gap-2">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleLeadCapture}
                    className="rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:opacity-95"
                  >
                    Join
                  </button>
                </div>
                {leadSaved ? (
                  <p className="text-sm text-emerald-600">Thanks — you’re on the list.</p>
                ) : (
                  <p className="text-sm text-slate-500">Tomorrow we can wire this to a real database and email service.</p>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">What changed</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>• Added industry and company size inputs</li>
                <li>• Softer verdict bands to reduce unrealistic “above market” jumps</li>
                <li>• Better range and target logic</li>
                <li>• Cleaner UI spacing, hierarchy, and polish</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} SalaryCheck. Informational estimates only.</p>
          <p>Built by Sujith</p>
        </div>
      </footer>
    </main>
  );
}
