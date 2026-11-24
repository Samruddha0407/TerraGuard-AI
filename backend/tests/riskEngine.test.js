const assert = require("node:assert/strict");
const { calculateRisk } = require("../src/services/riskEngine");
const low = calculateRisk({hourlyPrecipitation:Array(24).fill(0),rainfall7d:0,humidity:40,weatherCode:0});
assert.equal(low.level,"Low");
const severe = calculateRisk({hourlyPrecipitation:Array(24).fill(5),rainfall7d:220,humidity:95,weatherCode:95});
assert.equal(severe.level,"Severe");
assert.ok(severe.score <= 85);
console.log("Risk engine tests passed.");
