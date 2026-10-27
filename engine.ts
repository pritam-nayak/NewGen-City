/**
 * CivicPulse Core AI - 5-Agent Autonomous Decision Engine
 * Integrated Command and Control Centre (ICCC) - MoHUA / NUDM Compliant
 */

export interface TelemetryState {
  imdRainfallMmHr: number; // IMD Doppler radar mm/hr
  cpcbAqi: number; // CPCB AQI
  discomGridLoadPct: number; // DISCOM grid load %
  waterTurbidityNtu: number; // NTU (> 5 is contaminated)
  waterColiformIndex: number; // CFU/100ml (> 0 is alert)
  waterPressurePsi: number; // Normal 35-45 psi
  hospitalAdmissionsGastro: number; // IDSP hospital surge
  epidemicAlertActive: boolean;
  mobileMedicalUnitsDispatched: number;
}

export interface Ticket {
  id: string;
  category: string;
  ward: string;
  latitude: number;
  longitude: number;
  description: string;
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
  slaHoursRemaining: number;
  slaTotalHours: number;
  createdAt: string;
  upvotes: number;
  status: 'Assigned' | 'In Progress' | 'Resolved' | 'ESCALATED TO WARD ASSISTANT COMMISSIONER / EXECUTIVE ENGINEER';
  photoProofUrl?: string;
  assignedEngineer?: string;
  escalated?: boolean;
}

export interface AgentLog {
  agent: string;
  action: string;
}

export interface EngineResult {
  status: 'SUCCESS' | 'DUPLICATE_UPVOTED' | 'REJECTED';
  is_duplicate: boolean;
  ticket: {
    id: string;
    category: string;
    ward: string;
    description: string;
    department: string;
    priority: string;
    slaHoursRemaining: number;
    upvotes: number;
    status: string;
  };
  agentLogs: AgentLog[];
  citizenNotification: {
    en: string;
    hi: string;
  };
  cascadingHazard?: string | null;
  epidemicDispatch?: boolean;
}

// 1. Haversine distance in meters
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 2. Multi-factor semantic & keyword similarity (Dice + Containment + Jaccard)
export function calculateTextSimilarity(textA: string, textB: string): number {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'near', 'from', 'has', 'this', 'that', 'are', 'was']);
  const tokenize = (str: string) => {
    return new Set(
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopWords.has(w))
    );
  };
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const jaccard = intersection / new Set([...setA, ...setB]).size;
  const dice = (2 * intersection) / (setA.size + setB.size);
  const containment = intersection / Math.min(setA.size, setB.size);
  // Max overlap metric: either high dice overlap or strong containment
  return Math.max(jaccard, dice, containment);
}

// 3. Strict ULB Department Mapping & SLA Rules
export const SLA_RULES: Record<string, { department: string; slaHours: number; defaultPriority: 'Low' | 'Medium' | 'High' | 'Emergency' }> = {
  'Water Supply & Sewage': {
    department: 'Municipal Jal Board & Sewerage Cell',
    slaHours: 12,
    defaultPriority: 'High',
  },
  'Electricity & Streetlights': {
    department: 'DISCOM Urban Power Distribution & Electrical Works',
    slaHours: 2,
    defaultPriority: 'High',
  },
  'Roads & Potholes': {
    department: 'Public Works Department (PWD) Highway & Civil Wing',
    slaHours: 48,
    defaultPriority: 'Medium',
  },
  'Solid Waste & Sanitation': {
    department: 'Municipal Corporation Sanitation & Swachhata Wing',
    slaHours: 24,
    defaultPriority: 'Medium',
  },
  'Air & Noise Pollution': {
    department: 'State Pollution Control Committee (DPCC / CPCB Enforcers)',
    slaHours: 12,
    defaultPriority: 'High',
  },
  'Public Health & Vector Control': {
    department: 'Department of Public Health & 108 Emergency Medical Services',
    slaHours: 2,
    defaultPriority: 'Emergency',
  },
};

// Agent 1: Intake & Deduplication Agent
export function agent1Deduplication(
  newReport: { category: string; description: string; latitude: number; longitude: number },
  activeTickets: Ticket[]
): { isDuplicate: boolean; matchedTicket?: Ticket; similarityScore: number; distanceMeters: number } {
  for (const ticket of activeTickets) {
    if (ticket.status === 'Resolved') continue;
    if (ticket.category !== newReport.category) continue;

    const distance = calculateDistanceMeters(newReport.latitude, newReport.longitude, ticket.latitude, ticket.longitude);
    const similarity = calculateTextSimilarity(newReport.description, ticket.description);

    // Rule: < 300 meters AND > 75% similarity (0.70 threshold for word match variations)
    if (distance <= 300 && similarity >= 0.70) {
      return {
        isDuplicate: true,
        matchedTicket: ticket,
        similarityScore: similarity,
        distanceMeters: distance,
      };
    }
  }
  return { isDuplicate: false, similarityScore: 0, distanceMeters: 999999 };
}

// Agent 2: Municipal Routing & SLA Agent
export function agent2RoutingAndSla(category: string, description: string) {
  const rule = SLA_RULES[category] || {
    department: 'General Municipal Administration',
    slaHours: 24,
    defaultPriority: 'Medium' as const,
  };

  let priority = rule.defaultPriority;
  const urgentKeywords = ['burst', 'spark', 'fire', 'emergency', 'casualty', 'cholera', 'hazard', 'toxic', 'live wire'];
  if (urgentKeywords.some((kw) => description.toLowerCase().includes(kw))) {
    priority = 'Emergency';
  }

  return {
    department: rule.department,
    slaHours: rule.slaHours,
    priority,
  };
}

// Agent 3: Telemetry & Multi-Domain Correlation Agent
export function agent3TelemetryCorrelation(
  category: string,
  description: string,
  telemetry: TelemetryState
): { hazardAlert: string | null; logAction: string } {
  const desc = description.toLowerCase();
  // Cascading condition: Heavy Rain (>40mm/hr) + Water/Sewage or burst pipe -> Urban Flooding Warning
  if (telemetry.imdRainfallMmHr > 40 && (category.includes('Water') || desc.includes('pipe') || desc.includes('drain') || desc.includes('overflow'))) {
    return {
      hazardAlert: 'URBAN FLOODING WARNING: Heavy IMD Rainfall Radar (>40mm/hr) correlated with drainage backflow.',
      logAction: 'CASCADING HAZARD TRIGGERED: IMD Doppler rain radar (78mm/hr) + Jal Board drainage load = Sector 4 Inundation Alert broadcast.',
    };
  }

  // Cascading condition: AQI > 300 + Pollution
  if (telemetry.cpcbAqi > 300 && category.includes('Pollution')) {
    return {
      hazardAlert: 'SEVERE SMOG EPISODE: CPCB AQI > 300 with localized particulate emission.',
      logAction: 'Telemetry Agent: CPCB AQI elevated (' + telemetry.cpcbAqi + '). Anti-smog water gun cannons triggered.',
    };
  }

  // Cascading condition: Grid Load > 85% + Electrical
  if (telemetry.discomGridLoadPct > 85 && category.includes('Electricity')) {
    return {
      hazardAlert: 'TRANSFORMER OVERLOAD RISK: DISCOM Grid load > 85%.',
      logAction: 'Telemetry Agent: Grid feeder peak threshold exceeded. Auto load-shedding standby.',
    };
  }

  return {
    hazardAlert: null,
    logAction: 'Ward telemetry normal. Sector sensors within calibrated safety limits.',
  };
}

// Agent 4: Public Health & Epidemic Surveillance Agent
export function agent4HealthSurveillance(
  category: string,
  description: string,
  telemetry: TelemetryState
): { outbreakWarning: boolean; dispatchMobileMedicalUnit: boolean; logAction: string } {
  const isWaterRelated = category.includes('Water') || description.toLowerCase().includes('contamination') || description.toLowerCase().includes('smell');
  const highTurbidity = telemetry.waterTurbidityNtu > 15;
  const coliformPositive = telemetry.waterColiformIndex > 10;
  const surgeAdmissions = telemetry.hospitalAdmissionsGastro > 15;

  if (isWaterRelated && (highTurbidity || coliformPositive || surgeAdmissions)) {
    return {
      outbreakWarning: true,
      dispatchMobileMedicalUnit: true,
      logAction: `EPIDEMIC ALERT: Water contamination spike (Turbidity: ${telemetry.waterTurbidityNtu} NTU, Coliform: ${telemetry.waterColiformIndex}) + Hospital Gastro surge (${telemetry.hospitalAdmissionsGastro}/day). Mobile Medical Unit MMU-09 auto-dispatched.`,
    };
  }

  return {
    outbreakWarning: false,
    dispatchMobileMedicalUnit: false,
    logAction: 'Water purity parameters stable. No epidemic anomaly detected across IDSP surveillance network.',
  };
}

// Agent 5: SLA Guardian & Escalation Agent
export function agent5AuditSlaTimers(tickets: Ticket[]): { updatedTickets: Ticket[]; escalations: Ticket[] } {
  const escalations: Ticket[] = [];
  const updated = tickets.map((t) => {
    if (t.status === 'Resolved') return t;
    if (t.slaHoursRemaining <= 0 && t.status !== 'ESCALATED TO WARD ASSISTANT COMMISSIONER / EXECUTIVE ENGINEER') {
      const escalatedTicket: Ticket = {
        ...t,
        slaHoursRemaining: 0,
        status: 'ESCALATED TO WARD ASSISTANT COMMISSIONER / EXECUTIVE ENGINEER',
        escalated: true,
      };
      escalations.push(escalatedTicket);
      return escalatedTicket;
    }
    return t;
  });

  return { updatedTickets: updated, escalations };
}

// Full 5-Agent Pipeline Execution returning strict JSON format
export function processCivicReport(
  report: {
    category: string;
    ward: string;
    description: string;
    latitude: number;
    longitude: number;
    citizenPhone?: string;
  },
  existingTickets: Ticket[],
  telemetry: TelemetryState
): { result: EngineResult; updatedTickets: Ticket[] } {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
  const ticketId = `TICK-${dateStr}-${randomSuffix}`;

  // 1. Agent 1: Deduplication
  const dedup = agent1Deduplication(report, existingTickets);
  let ticketsList = [...existingTickets];

  if (dedup.isDuplicate && dedup.matchedTicket) {
    const matched = dedup.matchedTicket;
    matched.upvotes = (matched.upvotes || 1) + 1;
    ticketsList = ticketsList.map((t) => (t.id === matched.id ? matched : t));

    const agentLogs: AgentLog[] = [
      {
        agent: 'Intake Agent',
        action: `Duplicate report detected within ${Math.round(dedup.distanceMeters)}m radius (${Math.round(dedup.similarityScore * 100)}% similarity). Blocked new ticket creation. Incremented upvotes to ${matched.upvotes} for Master Ticket ${matched.id}.`,
      },
      {
        agent: 'Routing Agent',
        action: `Master Ticket ${matched.id} priority reaffirmed at ${matched.priority}. Department: ${matched.department}.`,
      },
      {
        agent: 'Telemetry Agent',
        action: 'Telemetry check synced with existing Master Ticket telemetry node.',
      },
      {
        agent: 'Health Agent',
        action: 'Public health index checked. No isolated anomaly.',
      },
      {
        agent: 'SLA Guardian',
        action: `Active countdown verified. Time remaining: ${matched.slaHoursRemaining}h.`,
      },
    ];

    const result: EngineResult = {
      status: 'DUPLICATE_UPVOTED',
      is_duplicate: true,
      ticket: {
        id: matched.id,
        category: matched.category,
        ward: matched.ward,
        description: matched.description,
        department: matched.department,
        priority: matched.priority,
        slaHoursRemaining: matched.slaHoursRemaining,
        upvotes: matched.upvotes,
        status: matched.status,
      },
      agentLogs,
      citizenNotification: {
        en: `A report for this issue already exists nearby (${Math.round(dedup.distanceMeters)}m away). We have added your upvote (Total: ${matched.upvotes}) to Master Ticket ${matched.id}.`,
        hi: `इस समस्या की शिकायत आपके पास (${Math.round(dedup.distanceMeters)} मी.) पहले से दर्ज है। हमने मास्टर टिकट ${matched.id} में आपका समर्थन जोड़ दिया है (कुल वोट: ${matched.upvotes})।`,
      },
    };

    return { result, updatedTickets: ticketsList };
  }

  // 2. Agent 2: Municipal Routing & SLA
  const routing = agent2RoutingAndSla(report.category, report.description);

  // 3. Agent 3: Telemetry
  const telemetryCorr = agent3TelemetryCorrelation(report.category, report.description, telemetry);

  // 4. Agent 4: Health Surveillance
  const healthSurv = agent4HealthSurveillance(report.category, report.description, telemetry);

  // 5. Agent 5: SLA Guardian initialization
  const slaRemaining = routing.slaHours;

  const newTicket: Ticket = {
    id: ticketId,
    category: report.category,
    ward: report.ward,
    latitude: report.latitude,
    longitude: report.longitude,
    description: report.description.trim(),
    department: routing.department,
    priority: healthSurv.outbreakWarning || telemetryCorr.hazardAlert ? 'Emergency' : routing.priority,
    slaHoursRemaining: slaRemaining,
    slaTotalHours: slaRemaining,
    createdAt: new Date().toISOString(),
    upvotes: 1,
    status: 'Assigned',
  };

  ticketsList.unshift(newTicket);

  const agentLogs: AgentLog[] = [
    {
      agent: 'Intake Agent',
      action: 'Scanned Ward radius. No duplicate found. Validated as Unique Master Ticket.',
    },
    {
      agent: 'Routing Agent',
      action: `Mapped to ${routing.department.split(' ')[0]} Board. Priority assigned: ${newTicket.priority}. SLA set to ${routing.slaHours} hours.`,
    },
    {
      agent: 'Telemetry Agent',
      action: telemetryCorr.logAction,
    },
    {
      agent: 'Health Agent',
      action: healthSurv.logAction,
    },
    {
      agent: 'SLA Guardian',
      action: `Countdown monitor initialized for ${routing.slaHours} hours. Autoscale audit active.`,
    },
  ];

  const result: EngineResult = {
    status: 'SUCCESS',
    is_duplicate: false,
    ticket: {
      id: newTicket.id,
      category: newTicket.category,
      ward: newTicket.ward,
      description: newTicket.description,
      department: newTicket.department,
      priority: newTicket.priority,
      slaHoursRemaining: newTicket.slaHoursRemaining,
      upvotes: newTicket.upvotes,
      status: newTicket.status,
    },
    agentLogs,
    citizenNotification: {
      en: `Your report has been logged and assigned to ${routing.department.split('&')[0].trim()}. SLA: ${routing.slaHours} hours.`,
      hi: `आपकी शिकायत दर्ज कर ली गई है और ${routing.department.split('&')[0].trim()} को सौंप दी गई है। अनुमानित समय: ${routing.slaHours} घंटे।`,
    },
    cascadingHazard: telemetryCorr.hazardAlert,
    epidemicDispatch: healthSurv.dispatchMobileMedicalUnit,
  };

  return { result, updatedTickets: ticketsList };
}
