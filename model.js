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
  // Invented time-of-use tariff, GBP/kWh. No standing charge or export credit.
  function illustrativeRate(t) {
    const h = ((t % 24) + 24) % 24;
    return h < 6 ? 0.10 : h >= 16 && h < 21 ? 0.35 : 0.25;
  }
  function householdShift(start, departure, weather = 'windy', duration = 2) {
    duration = clamp(duration, 2, 12);
    const power = 14 / duration;
    const plan = evPlan(start, Math.min(start + duration, departure), 14, power);
    const original = evPlan(18, departure);
    const rows = hours.map((t, i) => {
      const h = t % 24;
      const sun = Math.max(0, Math.sin((h - 6) / 12 * Math.PI));
      const home = 0.4 + 0.7 * Math.exp(-Math.pow((t - 18.5) / 2, 2)) + 0.45 * Math.exp(-Math.pow((t - 31) / 1.5, 2));
      let wind = 2.8 + 0.6 * Math.sin(t * 0.5), solar = 2.5 * sun;
      if (weather === 'sunny') { wind = 0.35; solar = 6.6 * sun; }
      if (weather === 'still') { wind = 0.2; solar = 0.8 * sun; }
      if (weather === 'cloudy') { wind = 3; solar = 0.7 * sun; }
      if (weather === 'overnight') { wind = 0.8 + 6 * Math.exp(-Math.pow((t - 27) / 3.5, 2)); solar = 1.4 * sun; }
      if (weather === 'changeable') { wind = 2.6 + 2.2 * Math.sin((t - 12) * 0.75); solar = 3.2 * sun * (0.65 + 0.35 * Math.cos(t * 2)); }
      const generation = wind + solar, total = home + plan.power[i], baseline = home + original.power[i];
      return { t, home, charging: plan.power[i], total, baseline, wind, solar, generation, rate: illustrativeRate(t) };
    });
    const renewableMatched = sum(rows.map(r => Math.min(r.charging, Math.max(0, r.generation-r.home)))) * DT;
    const baselineRenewableMatched = sum(rows.map((r,i) => Math.min(original.power[i], Math.max(0, r.generation-r.home)))) * DT;
    return { rows, plan, duration, power, renewableMatched, baselineRenewableMatched,
      renewableShare: renewableMatched / 14 * 100, baselineRenewableShare: baselineRenewableMatched / 14 * 100,
      chargingCost: sum(rows.map(r => r.charging * r.rate)) * DT,
      baselineChargingCost: sum(rows.map((r, i) => original.power[i] * r.rate)) * DT,
      householdCost: sum(rows.map(r => r.total * r.rate)) * DT,
      baselineHouseholdCost: sum(rows.map(r => r.baseline * r.rate)) * DT,
      end: Math.min(start + duration, departure), peak: Math.max(...rows.map(r => r.total)), baselinePeak: Math.max(...rows.map(r => r.baseline)),
      beyond: sum(rows.map(r => Math.max(0, r.total - r.generation))) * DT,
      baselineBeyond: sum(rows.map(r => Math.max(0, r.baseline - r.generation))) * DT };
  }
  function bestHouseholdSchedule(departure, weather, objective = 'cost') {
    let best;
    for(let duration=2;duration<=12;duration+=DT) {
      for(let start=12;start+duration<=departure+1e-8;start+=DT) {
        const result=householdShift(start,departure,weather,duration);
        const primary=objective==='renewables'?result.beyond:result.chargingCost;
        const secondary=objective==='renewables'?result.chargingCost:result.beyond;
        if(!best || primary<best.primary-1e-8 || Math.abs(primary-best.primary)<1e-8 && secondary<best.secondary-1e-8)best={start,duration,primary,secondary,result};
      }
    }
    return best;
  }
  function renewableAbundance(shiftPercent = 0) {
    const share=clamp(shiftPercent,0,100)/100;
    const rows=Array.from({length:72},(_,i)=>6+i*DT).map(t=>{
      const home=25+45*Math.exp(-Math.pow((t-18.5)/2,2));
      const generation=130*Math.max(0,Math.sin((t%24-6)/12*Math.PI));
      const evening=t>=18 && t<20,daytime=t>=12 && t<14;
      const baseline=home+(evening?70:0);
      const charging=(evening?70*(1-share):0)+(daytime?70*share:0);
      const demand=home+charging;
      return {t,home,generation,baseline,charging,demand,used:Math.min(demand,generation),unused:Math.max(0,generation-demand)};
    });
    const used=sum(rows.map(r=>r.used))*DT;
    const baselineUsed=sum(rows.map(r=>Math.min(r.baseline,r.generation)))*DT;
    return {rows,shiftPercent:share*100,movedCars:Math.round(share*10),chargingEnergy:sum(rows.map(r=>r.charging))*DT,
      used,extraUsed:used-baselineUsed,unused:sum(rows.map(r=>r.unused))*DT,
      eveningPeak:Math.max(...rows.filter(r=>r.t>=18 && r.t<21).map(r=>r.demand))};
  }
  function neighbourhoodCharging(options = {}) {
    const homes = Math.round(clamp(options.homes ?? 60,20,80));
    const evCount = Math.round(homes * clamp(options.evShare ?? 70,25,100) / 100);
    const limit = clamp(options.limit ?? 140,30,200);
    const base = hours.map(t => homes * (0.45 + 0.75 * Math.exp(-Math.pow((t-18.5)/2,2)) + 0.4 * Math.exp(-Math.pow((t-31)/1.5,2))));
    const cars = Array.from({length:evCount},(_,i)=>({arrival:16+(i%9)*0.5,departure:29+(i%9)*0.5,energy:7+(i%4)*3.5}));
    function schedule(mode) {
      const total=base.slice(), plans=cars.map(()=>hours.map(()=>0));
      const order=cars.map((car,i)=>({car,i})).sort((a,b)=>a.car.departure-b.car.departure || a.i-b.i);
      for(const {car,i} of order) {
        let remaining=car.energy;
        const eligible=hours.map((t,k)=>k).filter(k=>hours[k]>=car.arrival && hours[k]<car.departure && (mode!=='midnight' || hours[k]>=24));
        while(remaining>1e-8) {
          const slots=eligible.filter(k=>plans[i][k]<7-1e-8 && (mode!=='coordinated' || total[k]<limit-1e-8));
          if(!slots.length)break;
          if(mode==='coordinated')slots.sort((a,b)=>illustrativeRate(hours[a])-illustrativeRate(hours[b]) || total[a]-total[b] || a-b);
          const k=slots[0];
          const power=Math.min(7-plans[i][k],remaining/DT,mode==='coordinated'?Math.max(0,limit-total[k]):Infinity);
          plans[i][k]+=power;total[k]+=power;remaining-=power*DT;
        }
      }
      const delivered=plans.map(plan=>sum(plan)*DT);
      return { mode, total, plans, delivered, ready:cars.filter((car,i)=>delivered[i]>=car.energy-1e-6).length,
        energy:sum(delivered), shortfall:sum(cars.map((car,i)=>Math.max(0,car.energy-delivered[i]))),
        peak:Math.max(...total), overloadHours:total.filter(p=>p>limit+1e-6).length*DT,
        cost:sum(plans.map(plan=>sum(plan.map((p,k)=>p*illustrativeRate(hours[k])))*DT)) };
    }
    return {homes,evCount,limit,base,cars,required:sum(cars.map(car=>car.energy)),results:{arrival:schedule('arrival'),midnight:schedule('midnight'),coordinated:schedule('coordinated')}};
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
    // Invented daily shape: daytime use, evening peak, overnight low, morning rise.
    const points = [[12, 300], [15, 310], [18.5, 470], [21, 310], [24, 230], [27, 200], [30, 260], [32, 350], [36, 300]];
    return hours.map(t => {
      const i = points.findIndex((p, index) => index < points.length - 1 && t >= p[0] && t < points[index + 1][0]);
      const [a, b] = [points[i], points[i + 1]];
      const blend = (1 - Math.cos(Math.PI * (t - a[0]) / (b[0] - a[0]))) / 2;
      const demand = a[1] + (b[1] - a[1]) * blend;
      const otherSupply = 300;
      return { t, demand, otherSupply, otherUsed: Math.min(demand, otherSupply), peaker: Math.max(0, demand - otherSupply) };
    });
  }
  const api = { DT, STEPS, hours, clamp, evPlan, renewable, illustrativeRate, householdShift, bestHouseholdSchedule, renewableAbundance, neighbourhoodCharging, simulate, peakDay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlexModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
