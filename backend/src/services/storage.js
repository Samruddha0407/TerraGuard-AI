const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema({
  location: { type: String, required: true, trim: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  score: { type: Number, required: true },
  level: { type: String, required: true },
  factors: { type: [String], default: [] },
  weather: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
  location: { type: String, required: true },
  level: { type: String, required: true },
  score: { type: Number, required: true },
  message: { type: String, required: true },
  latitude: Number,
  longitude: Number,
  createdAt: { type: Date, default: Date.now }
});

const Assessment = mongoose.models.Assessment ||
  mongoose.model("Assessment", assessmentSchema);
const Alert = mongoose.models.Alert || mongoose.model("Alert", alertSchema);

const memory = { assessments: [], alerts: [] };

async function saveAssessment(record) {
  if (mongoose.connection.readyState === 1) {
    return Assessment.create(record);
  }
  const saved = { ...record, _id: `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: new Date() };
  memory.assessments.unshift(saved);
  memory.assessments = memory.assessments.slice(0, 100);
  return saved;
}

async function saveAlert(record) {
  if (mongoose.connection.readyState === 1) {
    return Alert.create(record);
  }
  const saved = { ...record, _id: `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: new Date() };
  memory.alerts.unshift(saved);
  memory.alerts = memory.alerts.slice(0, 50);
  return saved;
}

async function getAssessments(limit = 20) {
  if (mongoose.connection.readyState === 1) {
    return Assessment.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
  return memory.assessments.slice(0, limit);
}

async function getAlerts(limit = 20) {
  if (mongoose.connection.readyState === 1) {
    return Alert.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
  return memory.alerts.slice(0, limit);
}

module.exports = { saveAssessment, saveAlert, getAssessments, getAlerts, memory };
