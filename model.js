/* Shared, deterministic educational model. Also works from file://. */
(function (root) {
  'use strict';
  const DT = 0.25, STEPS = 96;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const sum = values => values.reduce((a, b) => a + b, 0);
  const hours = Array.from({ length: STEPS }, (_, i) => 12 + i * DT);
  function evPlan(start, departure, energy = 14, maxPower = 7) {
    const power = hours.map(() => 0);
    let remaining = energy;
    hours.forEach((t, i) => {
      if (t >= start && t < departure && remaining > 1e-8) {
        power[i] = Math.min(maxPower, remaining / DT);
        remaining -= power[i] * DT;
      }
    });
    return { power, delivered: energy - remaining, remaining, feasible: remaining < 1e-6 };
  }
  function renewable(t, weather) {
    const sun = Math.max(0, Math.sin((t % 24 - 6) / 12 * Math.PI));
    if (weather === 'sunny') return 0.14 + 2.2 * sun;
    if (weather === 'still') return 0.12 + 0.35 * sun;
    return 0.7 + 0.15 * Math.sin(t * 0.5) + 0.65 * sun;
  }
  function simulate(options = {}) {
    const o = Object.assign({ homes: 120, participation: 70, reserve: 30, duration: 2, comfort: 1, scenario: 'evening', coordinated: true, target: 80, dispatch: 'all', onramp: 0 }, options);
    o.homes = Math.round(clamp(o.homes, 20, 400));
    o.participation = clamp(o.participation, 0, 100);
    o.reserve = clamp(o.reserve, 10, 80) / 100;
    o.duration = clamp(o.duration, 1, 4);
    o.target = clamp(o.target, 20, 400);
    o.comfort = clamp(o.comfort, 0.5, 2);
    const solar = o.scenario === 'solar';
    const cold = o.scenario === 'winter';
    o.onramp = [0, 30, 60].includes(Number(o.onramp)) ? Number(o.onramp) : 0;
    const cohorts = Math.max(1, o.onramp / (DT * 60));
    const activationDelay = (i, count) => count ? Math.floor(i * cohorts / count) * DT : 0;
    const following = o.dispatch === 'follow';
    const eventStart = solar ? 13 : 18;
    const eventEnd = eventStart + o.duration;
    const ambient = cold ? 0 : 8;
    const minTemp = 20 - o.comfort;
    const heatHolding = 0.32 * (20 - ambient) / 3;
    const nEV = Math.round(o.homes * 0.4);
    const nBattery = Math.round(o.homes * 0.3);
    const nHeat = Math.round(o.homes * 0.5);
    const nSolar = Math.round(o.homes * 0.4);
    const enrolled = n => Math.round(n * o.participation / 100);
    const evs = Array.from({ length: nEV }, (_, i) => ({
      baselineStart: 18 + (i % 4) * DT,
      baseline: evPlan(18 + (i % 4) * DT, 31),
      enrolled: i < enrolled(nEV),
      daytime: i % 5 === 0,
      remaining: 14,
      activateAt: eventStart + activationDelay(i, enrolled(nEV)),
      recoveryDelay: o.coordinated ? (i % 12) * DT : 0
    }));
    const batteries = Array.from({ length: enrolled(nBattery) }, (_, i) => ({ energy: 8, activateAt: eventStart + activationDelay(i, enrolled(nBattery)), delay: o.coordinated ? (i % 12) * DT : 0 }));
    const heaters = Array.from({ length: enrolled(nHeat) }, (_, i) => ({ temp: 20, activateAt: eventStart + activationDelay(i, enrolled(nHeat)), delay: o.coordinated ? (i % 8) * DT : 0 }));
    // Share each resource group's request in proportion to its current capability.
    // This uses ideal state knowledge at 15-minute intervals, not real telemetry.
    function allocate(capabilities, budget) {
      const total = sum(capabilities);
      const ratio = total > 0 ? Math.min(1, Math.max(0, budget) / total) : 0;
      return capabilities.map(capacity => capacity * ratio);
    }
    const rows = [];
    let lowestTemp = 20, highestTemp = 20, lowestBattery = 8, batteryInput = 0, batteryOutput = 0;
    hours.forEach((t, j) => {
      const inEvent = t >= eventStart && t < eventEnd;
      const rampFraction = o.onramp ? Math.min(1, (t - eventStart + DT) / (o.onramp / 60)) : 1;
      const requested = inEvent ? o.target * rampFraction : 0;
      let budget = following ? requested : Infinity;
      const base = o.homes * (0.30 + 0.47 * Math.exp(-Math.pow(((t % 24) - 18.5) / 2.2, 2)) + 0.25 * Math.exp(-Math.pow((t - 31.5) / 1.7, 2)));
      const baselineEV = sum(evs.map(e => e.baseline.power[j]));
      // Use thermal flexibility first, then EV charging, and batteries for the gap.
      // As rooms reach their temperature limits, their capability declines.
      const heatCapabilities = heaters.map(h => {
        if (t < h.activateAt) return 0;
        const nextWithoutHeat = h.temp + 0.08 * (ambient - h.temp) * DT;
        if (solar) {
          const preheatPower = clamp((21 - nextWithoutHeat) * 4 / (3 * DT), 0, 3.5);
          return Math.max(0, preheatPower - heatHolding);
        }
        const minimumPower = Math.max(0, (minTemp - nextWithoutHeat) * 4 / (3 * DT));
        return Math.max(0, heatHolding - minimumPower);
      });
      const heatAllocated = inEvent ? allocate(heatCapabilities, budget) : heaters.map(() => 0);
      budget -= sum(heatAllocated);
      let heatPower = (nHeat - heaters.length) * heatHolding;
      heaters.forEach((h, i) => {
        let p = heatHolding;
        if (inEvent) p += (solar ? 1 : -1) * heatAllocated[i];
        else if (t >= eventEnd) {
          const nextWithoutHeat = h.temp + 0.08 * (ambient - h.temp) * DT;
          const recoveryTarget = !solar && t < eventEnd + h.delay ? minTemp : 20;
          p = clamp((recoveryTarget - nextWithoutHeat) * 4 / (3 * DT), 0, 3.5);
        }
        h.temp += (0.08 * (ambient - h.temp) + 3 * p / 4) * DT;
        lowestTemp = Math.min(lowestTemp, h.temp);
        highestTemp = Math.max(highestTemp, h.temp);
        heatPower += p;
      });
      const evNormal = evs.map(e => {
        if (inEvent && e.enrolled && !solar) return Math.min(e.baseline.power[j], e.remaining / DT);
        if (e.enrolled && !solar && t >= eventEnd && t < 31) {
          return t >= eventEnd + e.recoveryDelay ? Math.min(7, e.remaining / DT) : 0;
        }
        return t >= e.baselineStart && t < 31 ? Math.min(7, e.remaining / DT) : 0;
      });
      const evCapabilities = evs.map((e, i) => {
        if (!e.enrolled || t < e.activateAt) return 0;
        return solar ? (e.daytime ? Math.min(7, e.remaining / DT) : 0) : evNormal[i];
      });
      const evAllocated = inEvent ? allocate(evCapabilities, budget) : evs.map(() => 0);
      budget -= sum(evAllocated);
      let actualEV = 0;
      evs.forEach((e, i) => {
        let p = evNormal[i] + (inEvent ? (solar ? 1 : -1) * evAllocated[i] : 0);
        // Charging deadlines take priority over participation, including recovery.
        if (e.enrolled && t < 31) p = Math.max(p, Math.max(0, e.remaining - (31 - t - DT) * 7) / DT);
        p = clamp(p, 0, Math.min(7, e.remaining / DT));
        e.remaining = Math.max(0, e.remaining - p * DT);
        actualEV += p;
      });
      const batteryCapabilities = batteries.map(b => t < b.activateAt ? 0 : solar ? Math.min(3, Math.max(0, 10 - b.energy) / (0.95 * DT)) : Math.min(3, Math.max(0, b.energy - o.reserve * 10) * 0.95 / DT));
      const batteryAllocated = inEvent ? allocate(batteryCapabilities, budget) : batteries.map(() => 0);
      let batteryPower = 0;
      batteries.forEach((b, i) => {
        let p = 0;
        if (inEvent) p = (solar ? 1 : -1) * batteryAllocated[i];
        else if (solar && t >= 18 + b.delay && b.energy > 8 + 1e-8) p = -Math.min(2, (b.energy - 8) * 0.95 / DT);
        else if (!solar && t >= eventEnd + b.delay && b.energy < 8 - 1e-8) p = Math.min(2, (8 - b.energy) / (0.95 * DT));
        b.energy += (p >= 0 ? p * 0.95 : p / 0.95) * DT;
        batteryInput += Math.max(0, p) * DT;
        batteryOutput += Math.max(0, -p) * DT;
        lowestBattery = Math.min(lowestBattery, b.energy);
        batteryPower += p;
      });
      const daylight = Math.max(0, Math.sin(((t % 24) - 6) / 12 * Math.PI));
      const generation = nSolar * 3 * daylight * (cold ? 0.4 : 1);
      const grossBaseline = base + baselineEV + nHeat * heatHolding;
      const grossActual = base + actualEV + heatPower + batteryPower;
      const baseline = grossBaseline - generation;
      const actual = grossActual - generation;
      const direction = solar ? 1 : -1;
      rows.push({ t, baseline, actual,
        generation, grossBaseline, grossActual,
        response: direction * (actual - baseline), inEvent, requested,
        activeHeat: heaters.filter(h => inEvent && t >= h.activateAt).length,
        activeEV: evs.filter(e => e.enrolled && inEvent && t >= e.activateAt).length,
        activeBattery: batteries.filter(b => inEvent && t >= b.activateAt).length,
        evResponse: direction * (actualEV - baselineEV),
        heatResponse: direction * (heatPower - nHeat * heatHolding),
        batteryResponse: direction * batteryPower,
        batteryCharge: batteries.length ? sum(batteries.map(b => b.energy)) / batteries.length / 10 * 100 : null,
        roomTemperature: heaters.length ? sum(heaters.map(h => h.temp)) / heaters.length : null
      });
    });
    const event = rows.filter(r => r.inEvent);
    const responseEnergy = sum(event.map(r => r.response * DT));
    const eventAverage = responseEnergy / (event.length * DT);
    const tolerance = o.target * 0.05;
    return {
      rows, eventStart, eventEnd, eventAverage, responseEnergy, onramp: o.onramp, requestAverage: sum(event.map(r => r.requested)) / event.length, dispatch: following ? 'follow' : 'all', tolerance,
      intervalsMet: event.filter(r => r.response >= r.requested - 1e-6).length,
      intervalsOnTarget: event.filter(r => Math.abs(r.response - r.requested) <= r.requested * 0.05 + 1e-6).length,
      intervalsBelow: event.filter(r => r.response < r.requested * 0.95 - 1e-6).length,
      intervalsAbove: event.filter(r => r.response > r.requested * 1.05 + 1e-6).length,
      meanAbsoluteError: sum(event.map(r => Math.abs(r.response - r.requested))) / event.length,
      eventIntervals: event.length,
      lowestTemp, highestTemp, lowestBattery, batteryInput, batteryOutput,
      evEnergyBaseline: sum(evs.map(e => e.baseline.delivered)), evEnergyActual: sum(evs.map(e => 14 - e.remaining)),
      evDeadlinesMet: evs.every(e => e.remaining < 1e-6),
      batteryFinal: batteries.map(b => b.energy),
      totalBaseline: sum(rows.map(r => r.baseline * DT)), totalActual: sum(rows.map(r => r.actual * DT)),
      peakAfter: Math.max(...rows.filter(r => r.t >= eventEnd && r.t < eventEnd + 6).map(r => r.actual)),
      counts: { ev: nEV, battery: nBattery, heat: nHeat, solar: nSolar, enrolled: enrolled(o.homes) }
    };
  }
  function peakDay() {
    return hours.map(t => {
      const demand = 250 + 220 * Math.exp(-Math.pow((t - 18.5) / 2, 2)) + 80 * Math.exp(-Math.pow((t - 31.5) / 1.7, 2));
      const otherSupply = 300;
      return { t, demand, otherSupply, otherUsed: Math.min(demand, otherSupply), peaker: Math.max(0, demand - otherSupply) };
    });
  }
  const api = { DT, STEPS, hours, clamp, evPlan, renewable, simulate, peakDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlexModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
