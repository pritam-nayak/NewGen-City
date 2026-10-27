const Complaint = require('../models/Complaint');
const { findDuplicate } = require('./dedupAgent');
const { routeComplaint } = require('./routingAgent');

const categorySignals = [
  ['safety', /\b(emergency|danger|dangerous|fire|smoke|accident|injury|crime|unsafe|exposed wire|electric shock|gas leak)\b/i],
  ['pollution', /\b(pollution|pradushan|air quality|aqi|smog|dust|smoke|pm2\.?5|pm10)\b/i],
  ['health', /\b(health|clinic|hospital|mosquito|disease|fever|public hygiene|medical|dengue|bimari)\b/i],
  ['weather', /\b(weather|rain|rainfall|baarish|flood|flooding|waterlogging|storm|heatwave|heat wave)\b/i],
  ['electricity', /\b(electricity|bijli|power outage|power cut|blackout|transformer|power line|electric pole)\b/i],
  ['sewage', /\b(sewage|sewer|sewerage|manhole|overflow|blocked sewer|sewage blockage)\b/i],
  ['roads', /\b(pothole|road|pavement|footpath|sidewalk|speed bump|sadak|gaddha)\b/i],
  ['traffic', /\b(traffic|signal|intersection|crossing|jam|red light|traffic light)\b/i],
  ['water', /\b(water|tap|pipeline|pipe leak|supply|drinking water|pani|nal)\b/i],
  ['sanitation', /\b(garbage|rubbish|waste|trash|litter|kachra|safai|gandagi|dustbin)\b/i],
  ['drainage', /\b(drain|drainage|flood|waterlogging|blocked water|naali)\b/i],
  ['parks', /\b(park|playground|garden|public space)\b/i],
  ['streetlights', /\b(street ?light|lamp ?post|street lamp|dark street|light not working)\b/i],
];

const highPrioritySignals = /\b(emergency|urgent|danger|dangerous|fire|smoke|accident|injury|life.?threatening|exposed wire|electric shock|flood|flooding|major leak|gas leak|extreme heat)\b/i;

function classifyReport(title, description, selectedCategory) {
  const text = `${title} ${description}`;
  if (selectedCategory) {
    return { category: selectedCategory, method: 'citizen-selected' };
  }
  const match = categorySignals.find(([, pattern]) => pattern.test(text));
  return {
    category: match?.[0] || 'other',
    method: match ? 'keyword-assisted' : 'safe-default',
  };
}

async function automateReport({
  title,
  description,
  location,
  category,
  latitude,
  longitude,
  reporterUserId,
}) {
  const classification = classifyReport(title, description, category);
  const priority = highPrioritySignals.test(`${title} ${description}`)
    ? 'high'
    : 'normal';
  const duplicate = await findDuplicate({
    category: classification.category,
    title,
  });

  if (duplicate) {
    await Complaint.addEvent(
      duplicate.id,
      'duplicate_report',
      `Additional report received at ${location}: ${description}`
    );
    return { duplicate: true, complaintId: duplicate.id };
  }

  const routing = await routeComplaint(classification.category);
  const complaint = await Complaint.createComplaint({
    title,
    description,
    location,
    category: classification.category,
    departmentId: routing.departmentId,
    duplicateOf: null,
    slaHours: routing.slaHours,
    priority,
    latitude,
    longitude,
    reporterUserId,
  });

  await Complaint.addEvent(
    complaint.id,
    'created',
    `Report received and assigned to ${routing.department}.`
  );
  await Complaint.addEvent(
    complaint.id,
    'automated_triage',
    `Category ${classification.category} (${classification.method}); ${priority} priority; ${routing.slaHours}-hour SLA.`
  );

  return {
    duplicate: false,
    ...complaint,
    department: routing.department,
    automation: {
      category: classification.category,
      classificationMethod: classification.method,
      department: routing.department,
      slaHours: routing.slaHours,
      priority,
    },
  };
}

module.exports = { automateReport, classifyReport };
