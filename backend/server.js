require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const { calculateRisk } = require("./src/services/riskEngine");
const { saveAssessment, saveAlert, getAssessments, getAlerts } = require("./src/services/storage");

const app = express();
const PORT = Number(process.env.PORT || 5000);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({
  success: true, status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "memory-mode",
  chatbot: process.env.GEMINI_API_KEY ? "gemini-enabled" : "built-in-assistant",
  timestamp: new Date().toISOString()
}));

app.post("/api/risk/assess", async (req, res, next) => {
  try {
    const { location, latitude, longitude, weather } = req.body || {};
    const lat = Number(latitude), lon = Number(longitude);
    if (typeof location !== "string" || location.trim().length < 2)
      return res.status(400).json({ success:false, message:"A valid location name is required." });
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180)
      return res.status(400).json({ success:false, message:"Valid latitude and longitude are required." });
    if (!weather || typeof weather !== "object" || Array.isArray(weather))
      return res.status(400).json({ success:false, message:"Weather data is required." });
    const result = calculateRisk(weather);
    const assessment = await saveAssessment({
      location: location.trim().slice(0,120), latitude:lat, longitude:lon,
      score:result.score, level:result.level, factors:result.factors,
      weather:{ rainfall24h:result.rainfall24h, rainfall7d:result.rainfall7d,
        humidity:Number(weather.humidity)||0, temperature:Number(weather.temperature)||null },
      method:result.method
    });
    let alert = null;
    if (["High","Severe"].includes(result.level)) {
      alert = await saveAlert({
        location:location.trim().slice(0,120), level:result.level, score:result.score,
        latitude:lat, longitude:lon,
        message:`${result.level} screening level detected. Review local conditions and official advisories.`
      });
    }
    res.status(201).json({ success:true, message:"Assessment completed.", assessment:{
      ...assessment, id:String(assessment._id), ...result
    }, alert });
  } catch (e) { next(e); }
});

app.get("/api/assessments", async (req,res,next) => {
  try { res.json({success:true, items:await getAssessments(Math.min(100,Math.max(1,Number(req.query.limit)||20)))}); }
  catch(e){next(e);}
});
app.get("/api/alerts", async (req,res,next) => {
  try { res.json({success:true, items:await getAlerts(Math.min(100,Math.max(1,Number(req.query.limit)||20)))}); }
  catch(e){next(e);}
});

function assistantReply(message, context={}) {
  const q = String(message || "").toLowerCase();
  const a = context.assessment || {};
  const location = context.location || a.location || "the selected location";
  if (/hello|hi\b|hey/.test(q)) return `Hello! I'm TerraGuard Risk Assistant. I can explain rainfall indicators, the latest screening result, alerts, and landslide preparedness. What would you like to know?`;
  if (/current|latest|my risk|risk level|assessment|score/.test(q)) {
    if (!a.level) return "No risk assessment is attached yet. Search for a location on the dashboard first; I can then explain its screening score and contributing weather indicators.";
    return `The latest screening for ${location} is **${a.level} (${a.score}/85)**. ${Array.isArray(a.factors) ? a.factors.join("; ") : "Review the dashboard factors."} This is a weather-indicator screening heuristic, not a validated landslide forecast or official warning.`;
  }
  if (/rainfall|precipitation|humidity|weather/.test(q)) {
    const w = context.weather || {};
    return `For ${location}, the dashboard's latest available readings are: current temperature ${w.temperature ?? "not available"} °C, humidity ${w.humidity ?? "not available"}%, current precipitation ${w.precipitation ?? "not available"} mm, and accumulated 7-day rainfall ${w.rainfall7d ?? "not available"} mm. Rainfall and soil saturation can contribute to slope instability, but local geology, slope, drainage, land use and field observations also matter.`;
  }
  if (/prepare|safety|safe|evacuat|landslide|warning|emergency|heavy rain|during rain/.test(q)) return "Preparedness: follow district and disaster-management authority alerts; identify safe routes and nearby higher-ground/official shelters; keep essentials, medicines, documents, water and a charged phone ready; avoid steep slopes, road cuts, river valleys and active slide areas during intense or prolonged rain. If you notice new ground cracks, tilting trees/poles, unusual water seepage, rumbling or a moving slope, move away immediately and contact local emergency services. Do not wait for this dashboard to confirm danger.";
  if (/factor|why|explain/.test(q)) return a.level
    ? `The screening score is ${a.score}/85 (${a.level}). Contributing indicators: ${(a.factors||[]).join("; ")}. The heuristic uses recent 24-hour rainfall, accumulated 7-day rainfall, relative humidity and selected heavy-rain/thunderstorm weather codes. It does not include terrain, soil, geology or live field sensors.`
    : "The prototype's screening heuristic considers recent 24-hour rainfall, accumulated 7-day rainfall, relative humidity and selected heavy-rain/thunderstorm weather codes. Select a location to see its current contributing factors.";
  return "I can help with your latest risk screening, rainfall and humidity readings, why a score was assigned, alerts, and general landslide preparedness. Try asking: “Explain my risk score” or “What should I do during heavy rain?”";
}

app.post("/api/chat", async (req,res,next) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message || message.length > 2000) return res.status(400).json({success:false,message:"Enter a message (up to 2,000 characters)."});
    const context = req.body?.context || {};
    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({systemInstruction:{parts:[{text:"You are TerraGuard, a cautious landslide preparedness assistant. Use supplied dashboard context only for current readings. Never claim to predict landslides or issue official warnings. State uncertainty and direct emergencies to local authorities. Be concise."}]}, contents:[{role:"user",parts:[{text:`Dashboard context: ${JSON.stringify(context)}\nQuestion: ${message}`}]}]})
        });
        if (response.ok) {
          const data = await response.json();
          const answer = data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n");
          if (answer) return res.json({success:true, answer, mode:"gemini"});
        }
      } catch (err) { console.error("Gemini unavailable; using built-in assistant:", err.message); }
    }
    res.json({success:true, answer:assistantReply(message,context), mode:"built-in"});
  } catch(e){next(e);}
});

app.use("/api",(req,res)=>res.status(404).json({success:false,message:"API route not found."}));
app.use(express.static(path.join(__dirname,"..","frontend")));
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"..","frontend","index.html")));
app.use((err,req,res,next)=>{
  console.error("API error:",err.message);
  res.status(500).json({success:false,message:"The server could not complete that request."});
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});
      console.log("MongoDB connected.");
    } catch(e) { console.warn("MongoDB unavailable; using temporary in-memory storage:",e.message); }
  } else console.warn("MONGODB_URI not set; using temporary in-memory storage.");
  app.listen(PORT,()=>console.log(`TerraGuard AI running at http://localhost:${PORT}`));
}
start();
