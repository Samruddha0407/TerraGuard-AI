const express = require("express");
const { calculateRisk } = require("../services/riskEngine");
const { saveAssessment, saveAlert, getAssessments, getAlerts } = require("../services/storage");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "TerraGuard AI API", timestamp: new Date().toISOString() });
});

router.post("/risk/assess", async (req, res, next) => {
  try {
    const { location, latitude, longitude, weather } = req.body || {};
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!location || typeof location !== "string" || location.trim().length < 2) {
      return res.status(400).json({ error: "A valid location name is required." });
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }
    if (!weather || typeof weather !== "object") {
      return res.status(400).json({ error: "Weather data is required for assessment." });
    }

    const result = calculateRisk({
      hourlyPrecipitation: weather.hourlyPrecipitation,
      rainfall7d: weather.rainfall7d,
      humidity: weather.humidity,
      weatherCode: weather.weatherCode
    });

    const assessment = await saveAssessment({
      location: location.trim().slice(0, 120),
      latitude: lat,
      longitude: lon,
      score: result.score,
      level: result.level,
      factors: result.factors,
      weather: {
        rainfall24h: result.rainfall24h,
        rainfall7d: result.rainfall7d,
        humidity: Number(weather.humidity) || 0,
        temperature: Number(weather.temperature) || null
      }
    });

    let alert = null;
    if (["High", "Severe"].includes(result.level)) {
      alert = await saveAlert({
        location: location.trim().slice(0, 120),
        level: result.level,
        score: result.score,
        latitude: lat,
        longitude: lon,
        message: `${result.level} screening level for ${location.trim()}. Review local conditions and official advisories.`
      });
    }

    res.json({
      assessment: {
        id: assessment._id,
        location: location.trim(),
        latitude: lat,
        longitude: lon,
        ...result,
        createdAt: assessment.createdAt || new Date()
      },
      alert
    });
  } catch (error) {
    next(error);
  }
});

router.get("/assessments", async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    res.json({ items: await getAssessments(limit) });
  } catch (error) { next(error); }
});

router.get("/alerts", async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    res.json({ items: await getAlerts(limit) });
  } catch (error) { next(error); }
});

module.exports = router;
