const express = require('express');
const Complaint = require('../models/Complaint');
const { automateReport } = require('../agents/automationAgent');
const { verifyClosure } = require('../agents/verificationAgent');
const { verifyOperationsAccess } = require('../middleware/operationsAuth');
const { optionalCitizen, requireCitizen } = require('../middleware/citizenAuth');
const { reportRateLimiter } = require('../middleware/reportRateLimiter');

const router = express.Router();
const validStatuses = new Set(['open', 'in_progress', 'resolved', 'reopened']);
const validCategories = new Set([
  'roads', 'traffic', 'water', 'sanitation', 'drainage', 'sewage',
  'parks', 'streetlights', 'safety', 'pollution', 'health',
  'weather', 'electricity', 'other',
]);

router.get('/', async (req, res, next) => {
  try {
    if (req.query.status && !validStatuses.has(req.query.status)) {
      return res.status(400).json({ error: 'Invalid status filter.' });
    }
    res.json(await Complaint.listComplaints(req.query.status));
  } catch (error) {
    next(error);
  }
});

router.get('/mine', requireCitizen, async (req, res, next) => {
  try {
    res.json(await Complaint.listMyComplaints(req.citizen.id));
  } catch (error) {
    next(error);
  }
});

router.post('/', reportRateLimiter, optionalCitizen, async (req, res, next) => {
  try {
    const {
      title, description, location, latitude, longitude,
    } = req.body;
    let { category } = req.body;
    if (![title, description, location].every(
      (value) => typeof value === 'string' && value.trim()
    )) {
      return res.status(400).json({
        error: 'Title, description, and location are required.',
      });
    }
    if (title.trim().length > 120 || description.trim().length > 2000 || location.trim().length > 200) {
      return res.status(400).json({
        error: 'Title must be 120 characters, description 2,000, and location 200 or fewer.',
      });
    }
    if (category === '') category = undefined;
    if (category !== undefined && !validCategories.has(category)) {
      return res.status(400).json({ error: 'Invalid complaint category.' });
    }
    if ((latitude === undefined) !== (longitude === undefined)) {
      return res.status(400).json({ error: 'Both GPS coordinates are required together.' });
    }
    if (
      latitude !== undefined
      && (
        typeof latitude !== 'number'
        || typeof longitude !== 'number'
        || latitude < -90
        || latitude > 90
        || longitude < -180
        || longitude > 180
      )
    ) {
      return res.status(400).json({ error: 'GPS coordinates are outside valid map bounds.' });
    }

    const result = await automateReport({
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      category,
      latitude,
      longitude,
      reporterUserId: req.citizen?.id,
    });
    if (result.duplicate) {
      return res.status(200).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid case reference.' });
  }
  try {
    const complaint = await Complaint.findComplaintById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ error: 'No report was found for that case reference.' });
    }
    res.json(complaint);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', verifyOperationsAccess, async (req, res, next) => {
  try {
    const { status, departmentId, evidenceUrl, resolutionNote } = req.body;
    if (status && !validStatuses.has(status)) {
      return res.status(400).json({ error: 'Invalid complaint status.' });
    }
    if (departmentId !== undefined && !Number.isInteger(Number(departmentId))) {
      return res.status(400).json({ error: 'Invalid department ID.' });
    }
    if (
      status === 'resolved' &&
      !verifyClosure({ resolutionNote, evidenceUrl })
    ) {
      return res.status(400).json({
        error: 'A resolution note or valid evidence URL is required to close a case.',
      });
    }

    const complaint = await Complaint.updateComplaint(req.params.id, {
      status,
      departmentId: departmentId === undefined ? null : Number(departmentId),
      evidenceUrl,
      resolutionNote,
    });
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    await Complaint.addEvent(
      complaint.id,
      status || 'updated',
      resolutionNote || `Case updated${status ? `: ${status}` : '.'}`
    );
    res.json(complaint);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
