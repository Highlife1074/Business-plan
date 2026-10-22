import type { Params, Plan, Quote } from "./types";

// Moteur de calcul : projection mensuelle puis agrégats annuels.
// Hypothèses de modélisation (volontairement simples et lisibles) :
// - tous les montants sont HT ; la TVA n'impacte pas la trésorerie (reversée à l'État) ;
// - les investissements sont décaissés au mois 1 et amortis en linéaire ;
// - l'impôt sur les sociétés est calculé par exercice (avec report des déficits)
//   et décaissé le dernier mois de l'exercice ;
// - le BFR n'est pas modélisé mois par mois : prévoir une ligne "BFR / trésorerie de départ"
//   dans les investissements (non amortissable) si nécessaire.

export interface MonthRow {
  index: number; // 0-based
  label: string; // "2027-01"
  year: number; // 1-based
  revenue: number;
  variableCosts: number;
  grossMargin: number;
  fixedCosts: number;
  staffCosts: number;
  ebitda: number;
  depreciation: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  // Trésorerie
  cashIn: number;
  cashOut: number;
  equityIn: number;
  loansIn: number;
  subsidiesIn: number;
  investmentsOut: number;
  principalOut: number;
  netCashFlow: number;
  cashBalance: number;
}

export interface YearRow {
  year: number;
  revenue: number;
  variableCosts: number;
  grossMargin: number;
  grossMarginPct: number;
  fixedCosts: number;
  staffCosts: number;
  ebitda: number;
  ebitdaPct: number;
  depreciation: number;
  operatingIncome: number;
  interest: number;
  ebt: number;
  tax: number;
  netIncome: number;
  netMarginPct: number;
  cashFlowFromOps: number; // CAF = résultat net + dotations
  principal: number;
  endCash: number;
  breakEvenRevenue: number; // seuil de rentabilité
  breakEvenDays: number | null; // point mort en jours
  safetyMarginPct: number; // marge de sécurité
  revenuePerOpenDay: number;
  breakEvenPerOpenDay: number;
}

export interface Indicators {
  totalInvestment: number;
  totalFinancing: number;
  financingGap: number; // > 0 : excédent de financement ; < 0 : besoin non couvert
  totalLoans: number;
  minCash: number;
  minCashMonth: string;
  firstProfitableMonth: string | null; // premier mois avec résultat net > 0
  paybackMonth: string | null; // retour sur investissement (cumul EBE - IS ≥ investissement)
  npv: number;
  irr: number | null;
  avgDscr: number | null; // couverture du service de la dette, moyenne
}

export interface Projection {
  months: MonthRow[];
  years: YearRow[];
  indicators: Indicators;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function monthLabel(startDate: string, offset: number): string {
  const [y, m] = startDate.split("-").map(Number);
  const total = (y || 2027) * 12 + ((m || 1) - 1) + offset;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function startMonthIndex(startDate: string): number {
  const m = Number(startDate.split("-")[1]);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : 0;
}

interface LoanSchedule {
  interest: number[];
  principal: number[];
}

export function loanSchedule(
  amount: number,
  ratePct: number,
  years: number,
  deferralMonths: number,
  horizon: number,
): LoanSchedule {
  const interest = new Array(horizon).fill(0);
  const principal = new Array(horizon).fill(0);
  const total = Math.max(1, Math.round(years * 12));
  const deferral = Math.min(Math.max(0, Math.round(deferralMonths)), total - 1);
  const n = total - deferral;
  const r = ratePct / 100 / 12;
  const payment = r === 0 ? amount / n : (amount * r) / (1 - Math.pow(1 + r, -n));
  let remaining = amount;
  for (let m = 0; m < Math.min(total, horizon); m++) {
    const i = remaining * r;
    interest[m] = i;
    if (m >= deferral) {
      const p = Math.min(remaining, payment - i);
      principal[m] = p;
      remaining -= p;
    }
  }
  return { interest, principal };
}

export function irr(flows: number[]): number | null {
  const npvAt = (rate: number) => flows.reduce((acc, f, t) => acc + f / Math.pow(1 + rate, t), 0);
  let lo = -0.99;
  let hi = 10;
  let fLo = npvAt(lo);
  const fHi = npvAt(hi);
  if (fLo * fHi > 0) return null;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-7) return mid;
    if (fLo * fMid < 0) hi = mid;
    else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

// Applique les devis "retenus" : ils remplacent le montant des lignes auxquelles ils sont liés.
export function applyQuotes(params: Params, quotes: Quote[]): Params {
  const retained = quotes.filter((q) => q.status === "retenu" && q.linkedId);
  if (retained.length === 0) return params;
  const totals = new Map<string, number>();
  for (const q of retained) totals.set(q.linkedId!, (totals.get(q.linkedId!) ?? 0) + q.amount);
  return {
    ...params,
    investments: params.investments.map((i) =>
      totals.has(i.id) ? { ...i, amount: totals.get(i.id)! } : i,
    ),
    fixedCosts: params.fixedCosts.map((c) =>
      totals.has(c.id) ? { ...c, monthly: totals.get(c.id)! } : c,
    ),
  };
}

export function project(params: Params): Projection {
  const horizonYears = Math.min(Math.max(1, Math.round(params.horizonYears || 5)), 10);
  const H = horizonYears * 12;
  const sc = params.scenario ?? { volumePct: 100, pricePct: 100, costPct: 100 };
  const volumeF = sc.volumePct / 100;
  const priceF = sc.pricePct / 100;
  const costF = sc.costPct / 100;
  const infl = params.inflationPct / 100;
  const season =
    params.seasonality?.length === 12 ? params.seasonality : new Array(12).fill(1);
  const startIdx = startMonthIndex(params.startDate);
  const rampMonths = Math.max(0, Math.round(params.rampUpMonths));
  const rampStart = Math.min(Math.max(params.rampUpStartPct, 0), 100) / 100;

  const totalInvestment = sum(params.investments.map((i) => i.amount));
  const totalLoans = sum(params.financing.loans.map((l) => l.amount));
  const schedules = params.financing.loans.map((l) =>
    loanSchedule(l.amount, l.ratePct, l.years, l.deferralMonths, H),
  );

  const months: MonthRow[] = [];
  let cash = 0;
  let lossCarry = 0;
  let yearEbt = 0;

  for (let m = 0; m < H; m++) {
    const y = Math.floor(m / 12);
    const idx = (y + 1) as number;
    const cal = (startIdx + m) % 12;
    const ramp = m < rampMonths ? rampStart + (1 - rampStart) * (m / rampMonths) : 1;
    const priceIndex = Math.pow(1 + infl, y);

    let revenue = 0;
    let variableCosts = 0;
    for (const s of params.revenueStreams) {
      const units =
        s.unitsPerDay * s.openDaysPerMonth * season[cal] * ramp * Math.pow(1 + s.growthPct / 100, y) * volumeF;
      const rev = units * s.unitPrice * priceIndex * priceF;
      revenue += rev;
      variableCosts += units * s.unitPrice * priceIndex * (s.variableCostPct / 100) * costF;
    }
    const fixedCosts = sum(params.fixedCosts.map((c) => c.monthly)) * priceIndex * costF;
    const staffCosts =
      sum(
        params.staff
          .filter((s) => m + 1 >= (s.startMonth || 1))
          .map((s) => s.count * s.grossMonthly * (1 + params.employerChargesPct / 100)),
      ) * priceIndex;
    const ebitda = revenue - variableCosts - fixedCosts - staffCosts;
    const depreciation = sum(
      params.investments
        .filter((i) => i.depreciationYears > 0 && m < i.depreciationYears * 12)
        .map((i) => i.amount / (i.depreciationYears * 12)),
    );
    const interest = sum(schedules.map((s) => s.interest[m]));
    const principalOut = sum(schedules.map((s) => s.principal[m]));
    const ebt = ebitda - depreciation - interest;

    yearEbt += ebt;
    let tax = 0;
    if (m % 12 === 11 || m === H - 1) {
      // Clôture de l'exercice : IS avec report des déficits antérieurs
      const taxable = yearEbt - lossCarry;
      if (taxable > 0) {
        tax = (taxable * params.corporateTaxPct) / 100;
        lossCarry = 0;
      } else {
        lossCarry = -taxable;
      }
      yearEbt = 0;
    }

    const equityIn = m === 0 ? params.financing.equity : 0;
    const loansIn = m === 0 ? totalLoans : 0;
    const subsidiesIn = m === 0 ? params.financing.subsidies : 0;
    const investmentsOut = m === 0 ? totalInvestment : 0;

    const cashIn = revenue + equityIn + loansIn + subsidiesIn;
    const cashOut =
      variableCosts + fixedCosts + staffCosts + interest + principalOut + tax + investmentsOut;
    const netCashFlow = cashIn - cashOut;
    cash += netCashFlow;

    months.push({
      index: m,
      label: monthLabel(params.startDate, m),
      year: idx,
      revenue,
      variableCosts,
      grossMargin: revenue - variableCosts,
      fixedCosts,
      staffCosts,
      ebitda,
      depreciation,
      interest,
      ebt,
      tax,
      netIncome: 0, // complété ci-dessous (l'IS est porté au mois de clôture)
      cashIn,
      cashOut,
      equityIn,
      loansIn,
      subsidiesIn,
      investmentsOut,
      principalOut,
      netCashFlow,
      cashBalance: cash,
    });
  }
  for (const row of months) row.netIncome = row.ebt - row.tax;

  const openDaysPerYear =
    params.revenueStreams.length > 0
      ? (12 * sum(params.revenueStreams.map((s) => s.openDaysPerMonth))) / params.revenueStreams.length
      : 0;

  const years: YearRow[] = [];
  for (let y = 1; y <= horizonYears; y++) {
    const rows = months.filter((r) => r.year === y);
    const f = (k: keyof MonthRow) => sum(rows.map((r) => r[k] as number));
    const revenue = f("revenue");
    const variableCosts = f("variableCosts");
    const grossMargin = revenue - variableCosts;
    const fixedCosts = f("fixedCosts");
    const staffCosts = f("staffCosts");
    const ebitda = f("ebitda");
    const depreciation = f("depreciation");
    const interest = f("interest");
    const ebt = f("ebt");
    const tax = f("tax");
    const netIncome = ebt - tax;
    const marginRate = revenue > 0 ? grossMargin / revenue : 0;
    const structuralCosts = fixedCosts + staffCosts + depreciation + interest;
    const breakEvenRevenue = marginRate > 0 ? structuralCosts / marginRate : Infinity;
    const breakEvenDays =
      revenue > 0 && Number.isFinite(breakEvenRevenue) ? (breakEvenRevenue / revenue) * 365 : null;
    years.push({
      year: y,
      revenue,
      variableCosts,
      grossMargin,
      grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
      fixedCosts,
      staffCosts,
      ebitda,
      ebitdaPct: revenue > 0 ? (ebitda / revenue) * 100 : 0,
      depreciation,
      operatingIncome: ebitda - depreciation,
      interest,
      ebt,
      tax,
      netIncome,
      netMarginPct: revenue > 0 ? (netIncome / revenue) * 100 : 0,
      cashFlowFromOps: netIncome + depreciation,
      principal: f("principalOut"),
      endCash: rows[rows.length - 1].cashBalance,
      breakEvenRevenue,
      breakEvenDays,
      safetyMarginPct:
        revenue > 0 && Number.isFinite(breakEvenRevenue)
          ? ((revenue - breakEvenRevenue) / revenue) * 100
          : -100,
      revenuePerOpenDay: openDaysPerYear > 0 ? revenue / openDaysPerYear : 0,
      breakEvenPerOpenDay:
        openDaysPerYear > 0 && Number.isFinite(breakEvenRevenue) ? breakEvenRevenue / openDaysPerYear : 0,
    });
  }

  // Indicateurs
  let minCash = Infinity;
  let minCashMonth = months[0].label;
  for (const r of months) {
    if (r.cashBalance < minCash) {
      minCash = r.cashBalance;
      minCashMonth = r.label;
    }
  }
  const firstProfitable = months.find((r) => r.ebt > 0);
  let cumul = -totalInvestment;
  let paybackMonth: string | null = null;
  for (const r of months) {
    cumul += r.ebitda - r.tax;
    if (cumul >= 0 && totalInvestment > 0) {
      paybackMonth = r.label;
      break;
    }
  }
  const rate = params.discountRatePct / 100;
  const flows = [-totalInvestment, ...years.map((y) => y.ebitda - y.tax)];
  const npv = flows.reduce((acc, f, t) => acc + f / Math.pow(1 + rate, t), 0);
  const dscrs = years
    .filter((y) => y.interest + y.principal > 0)
    .map((y) => (y.ebitda - y.tax) / (y.interest + y.principal));

  const totalFinancing = params.financing.equity + params.financing.subsidies + totalLoans;

  return {
    months,
    years,
    indicators: {
      totalInvestment,
      totalFinancing,
      financingGap: totalFinancing - totalInvestment,
      totalLoans,
      minCash,
      minCashMonth,
      firstProfitableMonth: firstProfitable?.label ?? null,
      paybackMonth,
      npv,
      irr: totalInvestment > 0 ? irr(flows) : null,
      avgDscr: dscrs.length ? sum(dscrs) / dscrs.length : null,
    },
  };
}

export function projectPlan(plan: Plan): Projection {
  return project(applyQuotes(plan.params, plan.quotes));
}
