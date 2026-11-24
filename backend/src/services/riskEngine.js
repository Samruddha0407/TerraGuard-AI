/*
 * Transparent screening heuristic for an academic prototype.
 * It is NOT a scientifically validated landslide prediction model.
 */
function calculateRisk(input) {
  const hourly = Array.isArray(input.hourlyPrecipitation)
    ? input.hourlyPrecipitation.slice(-24)
    : [];
  const rainfall24h = hourly.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const rainfall7d = Math.max(0, Number(input.rainfall7d) || 0);
  const humidity = Math.max(0, Math.min(100, Number(input.humidity) || 0));
  const weatherCode = Number(input.weatherCode);
  let score = 0;
  const factors = [];

  if (rainfall24h >= 100) { score += 40; factors.push("Very heavy rainfall in the last 24 hours"); }
  else if (rainfall24h >= 50) { score += 30; factors.push("Heavy rainfall in the last 24 hours"); }
  else if (rainfall24h >= 25) { score += 20; factors.push("Moderate-to-heavy rainfall in the last 24 hours"); }
  else if (rainfall24h >= 10) { score += 10; factors.push("Rainfall recorded in the last 24 hours"); }

  if (rainfall7d >= 200) { score += 25; factors.push("High accumulated rainfall over the available 7-day period"); }
  else if (rainfall7d >= 100) { score += 15; factors.push("Elevated accumulated rainfall over the available 7-day period"); }
  else if (rainfall7d >= 50) { score += 8; factors.push("Notable accumulated rainfall over the available 7-day period"); }

  if (humidity >= 90) { score += 10; factors.push("Very high relative humidity"); }
  else if (humidity >= 80) { score += 5; factors.push("High relative humidity"); }

  if ([65, 82, 95, 96, 99].includes(weatherCode)) {
    score += 10;
    factors.push("Current weather code indicates heavy rain or thunderstorm conditions");
  }

  score = Math.min(85, score);
  let level = "Low";
  if (score >= 65) level = "Severe";
  else if (score >= 45) level = "High";
  else if (score >= 25) level = "Moderate";

  if (!factors.length) factors.push("No elevated rainfall or humidity indicators in the supplied weather data");

  return {
    score,
    level,
    rainfall24h: Number(rainfall24h.toFixed(1)),
    rainfall7d: Number(rainfall7d.toFixed(1)),
    factors,
    method: "Rule-based environmental screening heuristic"
  };
}

module.exports = { calculateRisk };
