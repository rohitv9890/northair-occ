/**
 * NorthAir Ops — Agent Engine
 *
 * Architecture mirrors OTAIP's Agent<TInput, TOutput> interface:
 *   interface Agent { initialize(), execute(input), health() }
 *
 * Three agents:
 *   DisruptionPredictionAgent  — weather + ATC + crew → risk score
 *   RotationOptimizerAgent     — tail swap / rotation recommendations
 *   ReaccommodationAgent       — KaibanJS-style multi-step pax reaccommodation
 */

import { fetchWeather, fetchAtcFlow, fetchCrewStatus, fetchTurnaroundPrediction, generatePassengerSample, SCHEDULE, FLEET } from './data.js';

// ─── AGENT 1: Disruption Prediction ─────────────────────────────────────────
export class DisruptionPredictionAgent {
  constructor() { this._initialized = false; }

  async initialize() { this._initialized = true; }

  async execute(flight) {
    const [weather, atc, crew, turnaround] = await Promise.all([
      fetchWeather(flight.dep),
      fetchAtcFlow(flight.dep),
      fetchCrewStatus(flight.flt),
      fetchTurnaroundPrediction(flight.tail, flight.dep),
    ]);

    const scores = {
      weather: this._weatherScore(weather.data),
      atc:     this._atcScore(atc.data),
      crew:    crew.data.atRisk ? 35 : 0,
      turnaround: this._turnaroundScore(turnaround.data),
    };

    const composite = Math.min(100, scores.weather + scores.atc + scores.crew + scores.turnaround);
    const level = composite >= 75 ? "CRITICAL" : composite >= 50 ? "HIGH" : composite >= 25 ? "MEDIUM" : "LOW";

    const factors = [];
    if (scores.weather > 0)     factors.push({ type: "WEATHER",     score: scores.weather,     detail: `${weather.data.label} — wind ${weather.data.windKt}kt, vis ${weather.data.visibility}nm` });
    if (scores.atc > 0)         factors.push({ type: "ATC",         score: scores.atc,         detail: atc.data.reason });
    if (scores.crew > 0)        factors.push({ type: "CREW",        score: scores.crew,         detail: crew.data.issue });
    if (scores.turnaround > 0)  factors.push({ type: "TURNAROUND",  score: scores.turnaround,  detail: turnaround.data.bottleneck });

    const estDelayMin = Math.round(
      (atc.data.avgDelayMin || 0) +
      (turnaround.data.predictedTurnaround - turnaround.data.stdTurnaround) +
      (crew.data.atRisk ? 25 : 0)
    );

    const tailInfo = FLEET.find(f => f.tail === flight.tail);
    const histAvgDelayMin = tailInfo ? tailInfo.histAvgDelayMin : null;

    return {
      flight: flight.flt,
      tail:   flight.tail,
      tailType: tailInfo ? tailInfo.type : '—',
      tailName: tailInfo ? tailInfo.name : '—',
      dep:    flight.dep,
      arr:    flight.arr,
      std:    flight.std,
      sta:    flight.sta,
      pax:    flight.pax,
      crew:   flight.crew,
      risk: { level, composite, scores },
      factors,
      estDelayMin,
      histAvgDelayMin,
      sources: { weather: weather.source, atc: atc.source, crew: crew.source, turnaround: turnaround.source },
    };
  }

  _weatherScore(w) {
    const codeMap = { THUNDER_STORM: 40, HEAVY_RAIN: 25, LOW_CLOUD: 25, ISOLATED_SHOWERS: 10, CLEAR: 0 };
    let s = codeMap[w.code] || 0;
    if (w.windKt > 30) s += 15;
    if (w.ceilingFt && w.ceilingFt < 1000) s += 15;
    if (w.visibility < 2) s += 10;
    return Math.min(s, 60);
  }

  _atcScore(a) {
    if (a.gdp) return 30;
    if (a.severity === "high")   return 25;
    if (a.severity === "medium") return 15;
    if (a.severity === "low")    return 5;
    return 0;
  }

  _turnaroundScore(t) {
    const delta = t.predictedTurnaround - t.stdTurnaround;
    if (delta > 60) return 20;
    if (delta > 30) return 12;
    if (delta > 10) return 5;
    return 0;
  }

  async health() { return { status: "healthy", agent: "DisruptionPredictionAgent" }; }
}

// ─── AGENT 2: Rotation Optimizer ────────────────────────────────────────────
export class RotationOptimizerAgent {
  constructor() { this._initialized = false; }

  async initialize() { this._initialized = true; }

  // Input: array of disruption assessments from Agent 1
  async execute(assessments) {
    const recommendations = [];

    for (const a of assessments) {
      if (a.risk.level === "CRITICAL" || a.risk.level === "HIGH") {
        const rec = this._buildRotationRec(a, assessments);
        if (rec) recommendations.push(rec);
      }
    }

    return { recommendations, generatedAt: new Date().toISOString() };
  }

  _buildRotationRec(assessment, allAssessments) {
    // Find available spare aircraft at the departure hub
    const usedTails = new Set(SCHEDULE.map(f => f.tail));
    const spareTails = FLEET.filter(ac =>
      ac.hub === assessment.dep &&
      ac.status === "active" &&
      ac.tail !== assessment.tail &&
      !this._tailBusyAroundTime(ac.tail, assessment.std, allAssessments)
    );

    // Also check tails currently inbound to dep airport with enough buffer
    const inboundWithBuffer = allAssessments.filter(a =>
      a.arr === assessment.dep &&
      a.tail !== assessment.tail &&
      this._minutesBetween(a.sta, assessment.std) > 90 &&
      a.risk.level !== "CRITICAL"
    );

    const swapOptions = [
      ...spareTails.map(ac => ({ tail: ac.tail, type: ac.type, rationale: `Spare at ${assessment.dep}`, bufferMin: 180 })),
      ...inboundWithBuffer.map(a => ({ tail: a.tail, type: FLEET.find(f=>f.tail===a.tail)?.type, rationale: `Inbound on ${a.flight} — arrives ${this._fmtTime(a.sta)} (+${this._minutesBetween(a.sta, assessment.std)}min buffer)`, bufferMin: this._minutesBetween(a.sta, assessment.std) }))
    ].slice(0, 2);

    if (swapOptions.length === 0) {
      return {
        flight: assessment.flight,
        dep: assessment.dep,
        risk: assessment.risk.level,
        action: "DELAY_REQUIRED",
        reason: "No suitable swap available. Recommend holding for weather improvement or crew relief.",
        swapOptions: [],
        estimatedDelaySaved: 0,
      };
    }

    const best = swapOptions[0];
    return {
      flight:    assessment.flight,
      dep:       assessment.dep,
      risk:      assessment.risk.level,
      action:    "TAIL_SWAP",
      currentTail: assessment.tail,
      recommendedTail: best.tail,
      rationale: best.rationale,
      bufferMin: best.bufferMin,
      swapOptions,
      estimatedDelaySaved: Math.max(0, assessment.estDelayMin - 15),
    };
  }

  _tailBusyAroundTime(tail, timeStr, assessments) {
    const t = new Date(timeStr).getTime();
    return assessments.some(a => a.tail === tail && Math.abs(new Date(a.std).getTime() - t) < 4*3600000);
  }

  _minutesBetween(t1, t2) {
    return Math.round((new Date(t2) - new Date(t1)) / 60000);
  }

  _fmtTime(iso) {
    return new Date(iso).toUTCString().slice(17, 22) + "Z";
  }

  async health() { return { status: "healthy", agent: "RotationOptimizerAgent" }; }
}

// ─── AGENT 3: Reaccommodation Agent (KaibanJS-style multi-step) ──────────────
// KaibanJS pattern: sequential task pipeline with LLM reasoning at decision nodes
// SWAP: replace callLLM() with real KaibanJS team + OpenAI/Anthropic SDK calls
export class ReaccommodationAgent {
  constructor() { this._initialized = false; }

  async initialize() { this._initialized = true; }

  async execute(disruption) {
    const passengers = generatePassengerSample(disruption.flight);

    // Step 1: Triage passengers by priority rules (deterministic)
    const triaged = this._triagePassengers(passengers, disruption);

    // Step 2: LLM reasoning for edge cases and final action
    const actions = await this._llmReasoningPass(triaged, disruption);

    return {
      flight: disruption.flight,
      disruption: { level: disruption.risk.level, delayMin: disruption.estDelayMin },
      agentSteps: ["triage", "llm_reasoning", "action_generation"],
      passengers: actions,
      summary: this._buildSummary(actions, disruption),
    };
  }

  _triagePassengers(passengers, disruption) {
    return passengers.map(p => {
      let priority = 3;
      const flags = [];

      if (p.ffStatus === "Platinum") { priority = 1; flags.push("Platinum FFP"); }
      else if (p.ffStatus === "Gold") { priority = Math.min(priority, 2); flags.push("Gold FFP"); }

      if (p.specialNeed) { priority = 1; flags.push(p.specialNeed); }
      if (p.connection)  { priority = Math.min(priority, 2); flags.push(`Cnx: ${p.connection}`); }

      // Flag misconnects — if delay > 90min, connection at risk
      const connectionAtRisk = p.connection && disruption.estDelayMin > 90;
      if (connectionAtRisk) { priority = 1; flags.push("CONNECTION AT RISK"); }

      return { ...p, priority, flags, connectionAtRisk };
    }).sort((a, b) => a.priority - b.priority);
  }

  async _llmReasoningPass(passengers, disruption) {
    // In production: KaibanJS AgentTeam with Manager → ReaccommodationAgent → CommunicationsAgent
    // Here we simulate the reasoning output deterministically for the MVP
    return passengers.map(p => {
      const action = this._determineAction(p, disruption);
      return { ...p, ...action };
    });
  }

  _determineAction(p, disruption) {
    const delayMin = disruption.estDelayMin;

    if (p.specialNeed === "Medical — wheelchair" || p.specialNeed === "Unaccompanied Minor") {
      return {
        recommendedAction: "PRIORITY_REBOOK",
        detail: `Immediate rebook to next available + notify ground handler. ${p.specialNeed} requires escort coordination.`,
        channel: "Phone + Email",
        llmReasoning: "Special needs passenger. Deterministic rule: rebook regardless of delay length, coordinate with ground services.",
        approved: false,
      };
    }

    if (p.connectionAtRisk && p.ffStatus === "Platinum") {
      return {
        recommendedAction: "PROTECT_ON_PARTNER",
        detail: `Protect on partner metal — preserve connection ${p.connection}. Authorize upgrades if needed.`,
        channel: "App Push + Lounge Call",
        llmReasoning: "Platinum pax with misconnect. Agent reasoning: protect on any available routing, partner metal acceptable, upgrades authorized.",
        approved: false,
      };
    }

    if (p.connectionAtRisk) {
      return {
        recommendedAction: "REBOOK_NEXT_AVAIL",
        detail: `Rebook to next same-carrier service protecting connection ${p.connection}. If unavailable, offer hotel + meal voucher.`,
        channel: "App Push + Email",
        llmReasoning: `Connection ${p.connection} at risk with ${delayMin}min delay. Next flight has seats. Rebook recommended.`,
        approved: false,
      };
    }

    if (delayMin < 45) {
      return {
        recommendedAction: "NOTIFY_DELAY",
        detail: `Inform of ${delayMin}min delay. No rebooking required. Offer compensation voucher if > 30min.`,
        channel: "App Push",
        llmReasoning: `Delay under 45min and no connection at risk. Notification only.`,
        approved: false,
      };
    }

    if (delayMin >= 45 && delayMin < 120) {
      return {
        recommendedAction: "OFFER_REBOOK",
        detail: `Offer voluntary rebook with no change fee. Provide meal voucher. Keep original booking option open.`,
        channel: "App Push + Email",
        llmReasoning: `${delayMin}min delay triggers voluntary rebook offer per NA policy. No forced rebook.`,
        approved: false,
      };
    }

    return {
      recommendedAction: "PROACTIVE_REBOOK",
      detail: `Delay exceeds 2h — proactively rebook on next available + provide hotel if overnight required.`,
      channel: "Phone + App + Email",
      llmReasoning: `${delayMin}min delay exceeds EU261/DOT 2h threshold. Proactive rebook + duty of care applies.`,
      approved: false,
    };
  }

  _buildSummary(actions, disruption) {
    const counts = actions.reduce((acc, a) => {
      acc[a.recommendedAction] = (acc[a.recommendedAction] || 0) + 1;
      return acc;
    }, {});
    return {
      totalPax: disruption.pax,
      sampleSize: actions.length,
      actionsBreakdown: counts,
      highPriority: actions.filter(a => a.priority === 1).length,
      connectionRisk: actions.filter(a => a.connectionAtRisk).length,
    };
  }

  async health() { return { status: "healthy", agent: "ReaccommodationAgent" }; }
}

// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────
// Mirrors OTAIP Agent 9.1 Orchestrator pattern
export async function runOpsWorkflow() {
  const predAgent   = new DisruptionPredictionAgent();
  const rotAgent    = new RotationOptimizerAgent();
  const reaccoAgent = new ReaccommodationAgent();

  await Promise.all([predAgent.initialize(), rotAgent.initialize(), reaccoAgent.initialize()]);

  // Stage 1: Run disruption prediction for all flights
  const assessments = await Promise.all(SCHEDULE.map(f => predAgent.execute(f)));

  // Stage 1b: Annotate downstream flight impact per tail
  // For each flight, count how many LATER flights on the same tail will be 15+ min impacted
  assessments.forEach(a => {
    if (a.estDelayMin < 15) { a.downstreamFlights = 0; return; }
    const aStd = new Date(a.std).getTime();
    a.downstreamFlights = assessments.filter(b =>
      b.flight !== a.flight &&
      b.tail === a.tail &&
      new Date(b.std).getTime() > aStd
    ).length;
  });

  // Stage 2: Run rotation optimizer
  const rotations = await rotAgent.execute(assessments);

  // Stage 3: Run reaccommodation for HIGH/CRITICAL flights
  const criticalFlights = assessments.filter(a => a.risk.level === "CRITICAL" || a.risk.level === "HIGH");
  const reaccommodations = await Promise.all(criticalFlights.map(a => reaccoAgent.execute(a)));

  return { assessments, rotations, reaccommodations, runAt: new Date().toISOString() };
}
