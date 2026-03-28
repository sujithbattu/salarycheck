'use client';

import React, { useMemo, useState } from 'react';

const ROLE_DATA = {
  'software-engineer': { label: 'Software Engineer', baseMin: 95000, baseMax: 145000 },
  'senior-software-engineer': { label: 'Senior Software Engineer', baseMin: 140000, baseMax: 210000 },
  'backend-engineer': { label: 'Backend Engineer', baseMin: 110000, baseMax: 170000 },
  'java-developer': { label: 'Java Developer', baseMin: 105000, baseMax: 160000 },
  'full-stack-engineer': { label: 'Full Stack Engineer', baseMin: 110000, baseMax: 175000 },
  'devops-engineer': { label: 'DevOps Engineer', baseMin: 120000, baseMax: 185000 },
  'data-engineer': { label: 'Data Engineer', baseMin: 120000, baseMax: 190000 },
  'qa-engineer': { label: 'QA Engineer', baseMin: 85000, baseMax: 130000 },
  'product-manager': { label: 'Product Manager', baseMin: 120000, baseMax: 190000 },
} as const;

const LOCATION_FACTORS = {
  'san-francisco-bay-area': { label: 'San Francisco Bay Area', factor: 1.28 },
  'new-york-city': { label: 'New York City', factor: 1.24 },
  'seattle': { label: 'Seattle', factor: 1.18 },
  'los-angeles': { label: 'Los Angeles', factor: 1.12 },
  'austin': { label: 'Austin', factor: 1.07 },
  'boston': { label: 'Boston', factor: 1.12 },
  'chicago': { label: 'Chicago', factor: 1.02 },
  'atlanta': { label: 'Atlanta', factor: 0.98 },
  'dallas': { label: 'Dallas', factor: 1.0 },
  'remote-us': { label: 'Remote (US)', factor: 1.05 },
} as const;

type RoleKey = keyof typeof ROLE_DATA;
type LocationKey = keyof typeof LOCATION_FACTORS;

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v || 0);
}

function getExperienceFactor(years: number) {
  if (years <= 1) return 0.78;
  if (years <= 3) return 0.9;
  if (years <= 5) return 1.0;
  if (years <= 8) return 1.13;
  if (years <= 12) return 1.25;
  return 1.32;
}

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

function calculate({
  role,
  location,
  years,
  salary,
}: {
  role: RoleKey;
  location: LocationKey;
  years: number;
  salary: number;
}) {
  const roleData = ROLE_DATA[role];
  const locationData = LOCATION_FACTORS[location];
  const multiplier = locationData.factor * getExperienceFactor(years);

  const min = Math.round(roleData.baseMin * multiplier);
  const max = Math.round(roleData.baseMax * multiplier);
  const midpoint = Math.round((min + max) / 2);
  const target = Math.round(midpoint * 1.06);

  let verdict = 'Fairly paid';
  let explanation =
    'You appear to be within the estimated market range for this role and location.';

  if (salary < min * 0.93) {
    verdict = 'Likely underpaid';
    explanation =
      'Your current salary appears meaningfully below the modeled market range for this profile.';
  } else if (salary > max * 1.05) {
    verdict = 'Likely above market';
    explanation =
      'Your current salary appears above the modeled market range for this profile.';
  }

  const position = clamp(((salary - min) / Math.max(max - min, 1)) * 100, 0, 100);

  const negotiationLine =
    verdict === 'Likely underpaid'
      ? `A reasonable conversation could start around ${formatCurrency(target)} based on this estimate.`
      : verdict === 'Fairly paid'
        ? `You may have room to negotiate toward ${formatCurrency(target)} if your scope or impact is increasing.`
        : `If you negotiate further, anchor around impact, retention, and expanded responsibilities.`;

  return {
    min,
    max,
    midpoint,
    target,
    verdict,
    explanation,
    position,
    negotiationLine,
  };
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export default function Page() {
  const [role, setRole] = useState<RoleKey>('java-developer');
  const [location, setLocation] = useState<LocationKey>('san-francisco-bay-area');
  const [years, setYears] = useState('5');
  const [salary, setSalary] = useState('145000');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  const numericYears = Number(years || 0);
  const numericSalary = Number(salary || 0);

  const result = useMemo(
    () =>
      calculate({
        role,
        location,
        years: numericYears,
        salary: numericSalary,
      }),
    [role, location, numericYears, numericSalary]
  );

  async function handleLeadCapture() {
    if (!email.trim()) return;

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, location, years: numericYears, salary: numericSalary }),
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
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-2xl font-semibold tracking-tight">SalaryCheck</p>
            <p className="text-sm text-slate-500">Know your worth in 60 seconds</p>
          </div>
          <div className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm text-white md:block">
            Beta
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
        <div>
          <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
            Market estimate + negotiation guidance
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            See if you’re underpaid and what to ask for next.
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Enter your role, location, experience, and current salary. SalaryCheck estimates a
            market range, gives you a clear verdict, and suggests a negotiation target.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard title="Fast answer" value="60 sec" subtitle="Simple workflow" />
            <StatCard title="Useful output" value="Raise target" subtitle="Not just one number" />
            <StatCard title="Clear framing" value="Estimate" subtitle="No fake precision" />
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">Why this exists</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Most salary tools dump a number on you. SalaryCheck is meant to do one more useful
              thing: help you understand whether you’re underpaid and give you a better starting
              point for the next conversation.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Estimates are directional only and should not be treated as guaranteed compensation
              advice.
            </p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50">
          <h2 className="text-2xl font-semibold tracking-tight">Run SalaryCheck</h2>
          <p className="mt-1 text-sm text-slate-500">
            Start with a few details. You can refine the logic later.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="mt-6 grid gap-4"
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium">Job title</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleKey)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0"
              >
                {Object.entries(ROLE_DATA).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as LocationKey)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-0"
              >
                {Object.entries(LOCATION_FACTORS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Years of experience</label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={years}
                  onChange={(e) => setYears(e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  placeholder="5"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Current salary</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  placeholder="145000"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 rounded-2xl bg-slate-900 px-4 py-4 text-base font-medium text-white transition hover:opacity-90"
            >
              Run SalaryCheck
            </button>

            <p className="text-xs leading-5 text-slate-500">
              This MVP uses modeled assumptions based on role, location, and experience.
            </p>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 lg:px-8 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">
                {submitted ? 'Your result' : 'Sample result'}
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {result.verdict}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatCard
                title="Estimated range"
                value={`${formatCurrency(result.min)} – ${formatCurrency(result.max)}`}
                subtitle={`Midpoint ${formatCurrency(result.midpoint)}`}
              />
              <StatCard
                title="Suggested target"
                value={formatCurrency(result.target)}
                subtitle="Use as a negotiation anchor"
              />
              <StatCard
                title="Current salary"
                value={formatCurrency(numericSalary)}
                subtitle={`${LOCATION_FACTORS[location].label}`}
              />
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Position in estimated range</p>
                <p className="text-sm font-medium text-slate-900">
                  {Math.round(result.position)}%
                </p>
              </div>
              <div className="mt-3 h-3 rounded-full bg-slate-200">
                <div
                  className="h-3 rounded-full bg-slate-900 transition-all"
                  style={{ width: `${result.position}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{formatCurrency(result.min)}</span>
                <span>{formatCurrency(result.max)}</span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold">What this means</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{result.explanation}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold">Negotiation note</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{result.negotiationLine}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight">Get the full report later</h2>
              <p className="mt-1 text-sm text-slate-500">
                Start collecting emails before building payments.
              </p>

              <div className="mt-4 rounded-3xl bg-slate-900 p-5 text-white">
                <p className="text-sm text-slate-300">Early Access</p>
                <p className="mt-2 text-3xl font-semibold">Free beta</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Get notified when full reports, better data, and negotiation templates go live.
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                <label htmlFor="email" className="text-sm font-medium">
                  Email address
                </label>
                <div className="flex gap-2">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLeadCapture}
                    className="rounded-2xl bg-slate-900 px-4 py-3 font-medium text-white transition hover:opacity-90"
                  >
                    Join
                  </button>
                </div>

                {leadSaved ? (
                  <p className="text-sm text-emerald-600">Thanks — you’re on the list.</p>
                ) : (
                  <p className="text-sm text-slate-500">
                    This is the best first validation step before charging users.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight">What’s next</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>• Save leads in a database</li>
                <li>• Add privacy and terms pages</li>
                <li>• Improve salary logic with better data</li>
                <li>• Offer premium PDF reports later</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} SalaryCheck. Informational estimates only.</p>
          <p>Built by Sujith</p>
        </div>
      </footer>
    </main>
  );
}