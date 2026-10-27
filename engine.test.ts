import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceMeters,
  calculateTextSimilarity,
  agent1Deduplication,
  agent2RoutingAndSla,
  agent3TelemetryCorrelation,
  agent4HealthSurveillance,
  agent5AuditSlaTimers,
  processCivicReport,
  type Ticket,
  type TelemetryState,
} from './engine';

test('Distance calculation - Haversine accuracy', () => {
  // Janakpuri Ward coordinates: approx 28.6219, 77.0878
  // 150m offset: approx 28.6230, 77.0885
  const d = calculateDistanceMeters(28.6219, 77.0878, 28.6230, 77.0885);
  assert.ok(d > 100 && d < 200, `Expected distance around 140m, got ${d}`);
});

test('Semantic similarity calculation', () => {
  const text1 = 'Severe water pipe burst flooding road near block B';
  const text2 = 'Water pipe burst with severe flooding on block B road';
  const sim = calculateTextSimilarity(text1, text2);
  assert.ok(sim >= 0.70, `Expected similarity >= 0.70, got ${sim}`);
});

test('Agent 1: Deduplication detects duplicate within 300m and high similarity', () => {
  const activeTickets: Ticket[] = [
    {
      id: 'TICK-20261027-1001',
      category: 'Water Supply & Sewage',
      ward: 'Ward 14 - Janakpuri',
      latitude: 28.6219,
      longitude: 77.0878,
      description: 'Major drinking water pipeline burst creating heavy waterlogging',
      department: 'Municipal Jal Board & Sewerage Cell',
      priority: 'High',
      slaHoursRemaining: 12,
      slaTotalHours: 12,
      createdAt: '2026-10-27T10:00:00Z',
      upvotes: 1,
      status: 'Assigned',
    },
  ];

  const duplicateReport = {
    category: 'Water Supply & Sewage',
    ward: 'Ward 14 - Janakpuri',
    latitude: 28.6225,
    longitude: 77.0880, // ~80m away
    description: 'Drinking water pipeline burst and major waterlogging on main road',
  };

  const result = agent1Deduplication(duplicateReport, activeTickets);
  assert.equal(result.isDuplicate, true);
  assert.equal(result.matchedTicket?.id, 'TICK-20261027-1001');
});

test('Agent 2: Municipal Routing assigns correct departments and strict SLAs', () => {
  const water = agent2RoutingAndSla('Water Supply & Sewage', 'Normal leak');
  assert.equal(water.slaHours, 12);
  assert.equal(water.department, 'Municipal Jal Board & Sewerage Cell');

  const electric = agent2RoutingAndSla('Electricity & Streetlights', 'Sparking transformer');
  assert.equal(electric.slaHours, 2);
  assert.equal(electric.priority, 'Emergency'); // contains 'spark'

  const roads = agent2RoutingAndSla('Roads & Potholes', 'Deep pothole');
  assert.equal(roads.slaHours, 48);

  const waste = agent2RoutingAndSla('Solid Waste & Sanitation', 'Garbage dump overflow');
  assert.equal(waste.slaHours, 24);

  const health = agent2RoutingAndSla('Public Health & Vector Control', 'Mosquito fogging required');
  assert.equal(health.slaHours, 2);
});

test('Agent 3: Telemetry correlation detects cascading hazard with heavy rain', () => {
  const telemetry: TelemetryState = {
    imdRainfallMmHr: 65, // > 40 mm/hr
    cpcbAqi: 120,
    discomGridLoadPct: 60,
    waterTurbidityNtu: 3.2,
    waterColiformIndex: 0,
    waterPressurePsi: 38,
    hospitalAdmissionsGastro: 4,
    epidemicAlertActive: false,
    mobileMedicalUnitsDispatched: 0,
  };

  const corr = agent3TelemetryCorrelation('Water Supply & Sewage', 'Main sewer line overflow', telemetry);
  assert.ok(corr.hazardAlert?.includes('URBAN FLOODING WARNING'));
});

test('Agent 4: Health Surveillance triggers mobile medical unit during water contamination outbreak', () => {
  const telemetrySpike: TelemetryState = {
    imdRainfallMmHr: 10,
    cpcbAqi: 140,
    discomGridLoadPct: 55,
    waterTurbidityNtu: 28, // High contamination (>15)
    waterColiformIndex: 35, // High coliform
    waterPressurePsi: 15,
    hospitalAdmissionsGastro: 22, // Hospital surge (>15)
    epidemicAlertActive: true,
    mobileMedicalUnitsDispatched: 2,
  };

  const health = agent4HealthSurveillance('Water Supply & Sewage', 'Foul smell and yellow contamination in tap water', telemetrySpike);
  assert.equal(health.outbreakWarning, true);
  assert.equal(health.dispatchMobileMedicalUnit, true);
});

test('Agent 5: SLA Guardian escalates breached tickets (0h) to Executive Engineer', () => {
  const tickets: Ticket[] = [
    {
      id: 'TICK-TEST-001',
      category: 'Electricity & Streetlights',
      ward: 'Ward 14 - Janakpuri',
      latitude: 28.6219,
      longitude: 77.0878,
      description: 'Streetlight out',
      department: 'DISCOM Urban Power Distribution & Electrical Works',
      priority: 'High',
      slaHoursRemaining: 0, // Breached!
      slaTotalHours: 2,
      createdAt: '2026-10-27T08:00:00Z',
      upvotes: 2,
      status: 'Assigned',
    },
  ];

  const { updatedTickets, escalations } = agent5AuditSlaTimers(tickets);
  assert.equal(escalations.length, 1);
  assert.equal(updatedTickets[0].status, 'ESCALATED TO WARD ASSISTANT COMMISSIONER / EXECUTIVE ENGINEER');
});

test('Full Pipeline: outputs exact required JSON structure', () => {
  const telemetry: TelemetryState = {
    imdRainfallMmHr: 5,
    cpcbAqi: 110,
    discomGridLoadPct: 45,
    waterTurbidityNtu: 2.1,
    waterColiformIndex: 0,
    waterPressurePsi: 40,
    hospitalAdmissionsGastro: 2,
    epidemicAlertActive: false,
    mobileMedicalUnitsDispatched: 0,
  };

  const { result } = processCivicReport(
    {
      category: 'Water Supply & Sewage',
      ward: 'Ward 14 - Janakpuri',
      latitude: 28.6500,
      longitude: 77.1200,
      description: 'Cleaned description of the issue.',
    },
    [],
    telemetry
  );

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.is_duplicate, false);
  assert.ok(result.ticket.id.startsWith('TICK-'));
  assert.equal(result.ticket.category, 'Water Supply & Sewage');
  assert.equal(result.ticket.ward, 'Ward 14 - Janakpuri');
  assert.equal(result.ticket.department, 'Municipal Jal Board & Sewerage Cell');
  assert.equal(result.ticket.slaHoursRemaining, 12);
  assert.equal(result.agentLogs.length, 5);
  assert.ok(result.citizenNotification.en.length > 0);
  assert.ok(result.citizenNotification.hi.length > 0);
});
