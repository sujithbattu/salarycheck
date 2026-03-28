'use client';

import React, { useMemo, useState } from 'react';

// --- Simple, dependency-free MVP (no shadcn required) ---

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
};

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
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);
}

function getExperienceFactor(years: number) {
  if (years <= 1) return 0.78;
  if (years <= 3) return 0.9;
  if (years <= 5) return 1.0;
  if (years <= 8) return 1.13;
  if (years <= 12) return 1.25;
  return 1.32;
}

function calculate({ role, location, years, salary }: { role: string; location: string; years: number; salary: number }) {
  const r = ROLE_DATA[role as keyof typeof ROLE_DATA];
  const loc = LOCATION_FACTORS[location as keyof typeof LOCATION_FACTORS];
  const mult = (loc?.factor || 1) * getExperienceFactor(years);
  const min = Math.round(r.baseMin * mult);
  const max = Math.round(r.baseMax * mult);
  const mid = Math.round((min + max) / 2);

  let verdict = 'Fairly paid';
  if (salary < min * 0.93) verdict = 'Likely underpaid';
  if (salary > max * 1.05) verdict = 'Likely above market';

  return { min, max, mid, verdict };
}

export default function Page() {
  const [role, setRole] = useState('java-developer');
  const [location, setLocation] = useState('san-francisco-bay-area');
  const [years, setYears] = useState('5');
  const [salary, setSalary] = useState('145000');
  const [submitted, setSubmitted] = useState(false);

  const result = useMemo(() => calculate({ role, location, years: Number(years), salary: Number(salary) }), [role, location, years, salary]);

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'Arial' }}>
      <h1>SalaryCheck</h1>
      <p>Know your worth in 60 seconds</p>

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }} style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(ROLE_DATA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={location} onChange={(e) => setLocation(e.target.value)}>
          {Object.entries(LOCATION_FACTORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <input type="number" value={years} onChange={(e) => setYears(e.target.value)} placeholder="Years" />
        <input type="number" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Salary" />

        <button type="submit">Run SalaryCheck</button>
      </form>

      <div style={{ marginTop: 30 }}>
        <h2>{submitted ? 'Your Result' : 'Sample Result'}</h2>
        <p><b>Verdict:</b> {result.verdict}</p>
        <p><b>Range:</b> {formatCurrency(result.min)} - {formatCurrency(result.max)}</p>
        <p><b>Target:</b> {formatCurrency(result.mid)}</p>
      </div>
    </div>
  );
}
