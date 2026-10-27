import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { processCivicReport, type Ticket, type TelemetryState } from './src/engine';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google Gemini Client with recommended User-Agent header
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Endpoint 1: Gemini Status & Diagnostics
app.get('/api/gemini/status', (req, res) => {
  res.json({
    ok: true,
    engine: 'CivicPulse Core AI + Gemini 3.8 Flash',
    model: 'gemini-3.8-flash',
    hasApiKey: !!apiKey,
    status: apiKey ? 'ONLINE_ACTIVE' : 'OFFLINE_FALLBACK',
    timestamp: new Date().toISOString(),
  });
});

// Endpoint 2: 5-Agent Autonomous Decision Engine powered by Gemini 3.8 Flash
app.post('/api/civicpulse/agent-decision', async (req, res) => {
  const { report, activeTickets = [], telemetry } = req.body;

  if (!report || !report.category || !report.description) {
    return res.status(400).json({ error: 'Missing report payload' });
  }

  // 1. If Gemini AI client is initialized, attempt real model generation with structured JSON schema
  if (ai) {
    try {
      const prompt = `
You are the "CivicPulse Core AI" 5-Agent Autonomous Decision Engine for Integrated Command and Control Centres (ICCC) across India (MoHUA, NUDM, and Digital India compliant).

Evaluate this incoming civic report against the active tickets and real-time IoT telemetry:

=== INCOMING REPORT ===
Category: ${report.category}
Ward: ${report.ward}
Coordinates: Lat ${report.latitude}, Lon ${report.longitude}
Description: "${report.description}"

=== ACTIVE WARD TICKETS ===
${JSON.stringify(
  activeTickets.slice(0, 10).map((t: Ticket) => ({
    id: t.id,
    category: t.category,
    ward: t.ward,
    description: t.description,
    lat: t.latitude,
    lon: t.longitude,
    upvotes: t.upvotes,
    status: t.status,
    slaHoursRemaining: t.slaHoursRemaining,
  })),
  null,
  2
)}

=== REAL-TIME WARD TELEMETRY ===
${JSON.stringify(telemetry, null, 2)}

=== 5-AGENT ARCHITECTURAL RULES ===
1. Agent 1 (Intake & Deduplication): Check if there is an active ticket in the same category within a 300-meter radius with >70% semantic similarity. If duplicate, set is_duplicate to true, block new ticket creation, keep the existing ticket id, increment upvotes by 1, and log deduplication action. If unique, set is_duplicate to false, generate ticket id "TICK-YYYYMMDD-XXXX", and set upvotes to 1.
2. Agent 2 (Municipal Routing & SLA): Assign strictly according to ULB departments:
   - Water Supply & Sewage -> "Municipal Jal Board & Sewerage Cell" (SLA: 12 hours)
   - Electricity & Streetlights -> "DISCOM Urban Power Distribution & Electrical Works" (SLA: 2 hours)
   - Roads & Potholes -> "Public Works Department (PWD) Highway & Civil Wing" (SLA: 48 hours)
   - Solid Waste & Sanitation -> "Municipal Corporation Sanitation & Swachhata Wing" (SLA: 24 hours)
   - Air & Noise Pollution -> "State Pollution Control Committee (DPCC / CPCB Enforcers)" (SLA: 12 hours)
   - Public Health & Vector Control -> "Department of Public Health & 108 Emergency Medical Services" (SLA: 2 hours)
3. Agent 3 (Telemetry & Multi-Domain Correlation): If IMD Rain > 40 mm/hr and water/drainage report, flag "URBAN FLOODING WARNING: Heavy IMD Rainfall Radar correlated with drainage backflow" and elevate priority to Emergency. If AQI > 300, flag anti-smog response.
4. Agent 4 (Public Health & Epidemic Surveillance): If water issue and (Turbidity > 15 NTU OR Coliform > 10 OR Hospital admissions > 15/day), flag "EPIDEMIC ALERT: Water contamination spike + Hospital Gastro surge. Mobile Medical Unit auto-dispatched." and set epidemicDispatch to true.
5. Agent 5 (SLA Guardian & Escalation): Initialize SLA countdown timer audit monitor.
6. Citizen Notification: Provide both English and formal Hindi receipt text describing the action and assigned department/SLA.

Produce the output strictly according to the JSON schema.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are the CivicPulse Core AI 5-Agent Autonomous Decision Engine for Indian Integrated Command & Control Centres. Respond strictly in valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              is_duplicate: { type: Type.BOOLEAN },
              ticket: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: { type: Type.STRING },
                  ward: { type: Type.STRING },
                  description: { type: Type.STRING },
                  department: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  slaHoursRemaining: { type: Type.INTEGER },
                  upvotes: { type: Type.INTEGER },
                  status: { type: Type.STRING },
                },
                required: [
                  'id',
                  'category',
                  'ward',
                  'description',
                  'department',
                  'priority',
                  'slaHoursRemaining',
                  'upvotes',
                  'status',
                ],
              },
              agentLogs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    agent: { type: Type.STRING },
                    action: { type: Type.STRING },
                  },
                  required: ['agent', 'action'],
                },
              },
              citizenNotification: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING },
                  hi: { type: Type.STRING },
                },
                required: ['en', 'hi'],
              },
              cascadingHazard: { type: Type.STRING },
              epidemicDispatch: { type: Type.BOOLEAN },
            },
            required: ['status', 'is_duplicate', 'ticket', 'agentLogs', 'citizenNotification'],
          },
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text.trim());
        // Return Gemini generated decision
        return res.json({
          ...parsed,
          aiProvider: 'Google Gemini 3.8 Flash',
          model: 'gemini-3.8-flash',
        });
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to deterministic engine:', err);
    }
  }

  // 2. Deterministic Fallback Engine (runs if no API key or network error occurs)
  const { result } = processCivicReport(report, activeTickets, telemetry);
  return res.json({
    ...result,
    aiProvider: 'CivicPulse Core AI (Edge Deterministic Engine)',
    model: 'embedded-5agent-mesh',
  });
});

// Start dev server with Vite middlewares or production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NextGen City ICCC] Server running on port ${PORT}`);
    console.log(`[Gemini AI] Status: ${apiKey ? 'ONLINE (gemini-3.8-flash)' : 'LOCAL_DETERMINISTIC_FALLBACK'}`);
  });
}

startServer();
