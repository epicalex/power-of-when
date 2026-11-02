const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('moving an EV window preserves energy and respects departure', () => {
  for (const departure of [29, 31, 34]) {
    for (let start = 18; start <= departure - 2; start += .25) {
      const r = M.evPlan(start, departure);
      close(r.delivered, 14);
      close(r.power.reduce((a,b) => a + b * M.DT, 0), 14);
      assert.ok(r.feasible);
      assert.ok(r.power.every((p, i) => p <= 7 && p >= 0 && (M.hours[i] < departure || p === 0)));
    }
  }
});
test('an infeasible EV window reports its shortfall', () => {
  const r = M.evPlan(30, 31);
  close(r.delivered, 7);
  close(r.remaining, 7);
  assert.equal(r.feasible, false);
});
test('zero participation delivers no response and changes no energy', () => {
  for (const scenario of ['evening', 'solar', 'winter']) {
    const r = M.simulate({ participation: 0, scenario });
    r.rows.forEach(row => close(row.actual, row.baseline));
    close(r.totalActual, r.totalBaseline);
    close(r.responseEnergy, 0);
  }
});
test('scenario boundary cases respect reserves, comfort, deadlines and accounting', () => {
  for (const scenario of ['evening', 'solar', 'winter'])
    for (const duration of [1, 2.5, 4])
      for (const reserve of [10, 30, 80])
        for (const comfort of [.5, 2])
          for (const coordinated of [true, false])
            for (const dispatch of ['all', 'follow']) {
            const r = M.simulate({ scenario, duration, reserve, comfort, coordinated, dispatch, homes: 80, participation: 100 });
            assert.equal(r.rows.length, 96);
            assert.ok(r.evDeadlinesMet);
            close(r.evEnergyBaseline, r.evEnergyActual);
            assert.ok(r.lowestBattery >= reserve / 10 - 1e-6);
            assert.ok(r.lowestTemp >= 20 - comfort - 1e-6);
            assert.ok(r.highestTemp <= 21 + 1e-6);
            r.batteryFinal.forEach(e => close(e, 8));
            assert.ok(r.batteryInput >= r.batteryOutput - 1e-6);
            close(r.eventAverage * duration, r.responseEnergy);
            assert.equal(r.eventIntervals, duration / M.DT);
            assert.ok(r.intervalsMet <= r.eventIntervals);
            assert.ok(r.rows.every(row => Number.isFinite(row.actual) && Number.isFinite(row.baseline)));
          }
});
test('staggering recovery lowers the default evening rebound peak', () => {
  const simultaneous = M.simulate({ coordinated: false });
  const staggered = M.simulate({ coordinated: true });
  assert.ok(staggered.peakAfter < simultaneous.peakAfter);
});
test('a high request does not claim delivery merely because devices are enrolled', () => {
  const r = M.simulate({ homes: 20, participation: 100, target: 400 });
  assert.equal(r.intervalsMet, 0);
  assert.ok(r.eventAverage < 400);
});

test('following the request changes physical delivery when the requested power changes', () => {
  const small = M.simulate({ dispatch: 'follow', target: 40 });
  const larger = M.simulate({ dispatch: 'follow', target: 160 });
  close(small.eventAverage, 40);
  close(larger.eventAverage, 160);
  assert.ok(larger.responseEnergy > small.responseEnergy);
  const allSmall = M.simulate({ dispatch: 'all', target: 40 });
  const allLarge = M.simulate({ dispatch: 'all', target: 160 });
  allSmall.rows.forEach((r, i) => close(r.actual, allLarge.rows[i].actual));
});
test('the four-hour example hands delivery from heating and charging to batteries', () => {
  const r = M.simulate({ dispatch: 'follow', duration: 4 });
  const event = r.rows.filter(row => row.inEvent);
  assert.ok(event[0].heatResponse > event[event.length - 1].heatResponse);
  assert.ok(event[0].evResponse > 0);
  close(event[0].batteryResponse, 0);
  assert.ok(event[event.length - 1].batteryResponse > 0);
  assert.equal(r.intervalsOnTarget, r.eventIntervals);
  const all = M.simulate({ dispatch: 'all', duration: 4 });
  assert.ok(r.meanAbsoluteError < all.meanAbsoluteError);
  assert.ok(all.intervalsAbove > 0 && all.intervalsBelow > 0);
});
test('each stacked contribution reconciles exactly to net grid response, including recovery', () => {
  for (const scenario of ['evening', 'solar', 'winter'])
    for (const dispatch of ['all', 'follow']) {
      const r = M.simulate({ scenario, dispatch, duration: 4 });
      r.rows.forEach(row => close(row.evResponse + row.heatResponse + row.batteryResponse, row.response));
      assert.equal(r.intervalsOnTarget + r.intervalsBelow + r.intervalsAbove, r.eventIntervals);
    }
});
test('following a request does not overshoot or invent capacity for an impossible request', () => {
  for (const scenario of ['evening', 'solar', 'winter'])
    for (const target of [20, 80, 200, 400]) {
      const r = M.simulate({ scenario, dispatch: 'follow', target, duration: 4, homes: 20 });
      r.rows.filter(row => row.inEvent).forEach(row => {
        assert.ok(row.response >= -1e-6);
        assert.ok(row.response <= target + 1e-6);
      });
      if (target === 400) {
        assert.equal(r.intervalsOnTarget, 0);
        assert.equal(r.intervalsBelow, r.eventIntervals);
      }
    }
});
test('no participation means zero delivery in either dispatch mode', () => {
  for (const scenario of ['evening', 'solar', 'winter'])
    for (const dispatch of ['all', 'follow']) {
      const r = M.simulate({ scenario, dispatch, participation: 0 });
      close(r.responseEnergy, 0);
      r.rows.forEach(row => close(row.actual, row.baseline));
      assert.equal(r.intervalsOnTarget, 0);
    }
});

test('the peak example balances demand using other supply plus peaker output', () => {
  const rows = M.peakDay();
  assert.equal(rows.length, 96);
  rows.forEach(row => {
    close(row.otherUsed + row.peaker, row.demand);
    assert.ok(row.peaker >= 0 && row.otherUsed <= row.otherSupply);
  });
  assert.ok(rows.some(r => r.peaker === 0));
  assert.ok(rows.some(r => r.peaker > 150));
  const at = t => rows.find(r => r.t === t);
  assert.ok(at(12).demand > at(24).demand);
  assert.ok(at(27).demand < at(24).demand);
  close(at(18.5).demand, 470);
  close(at(18.5).peaker, 170);
});
test('staged on-ramps change both requested profile and cohort eligibility', () => {
  const immediate = M.simulate({ dispatch: 'all', duration: 4, onramp: 0 });
  const staged = M.simulate({ dispatch: 'all', duration: 4, onramp: 60 });
  const a = immediate.rows.filter(r => r.inEvent), b = staged.rows.filter(r => r.inEvent);
  assert.deepEqual(b.slice(0, 4).map(r => r.requested), [20, 40, 60, 80]);
  assert.ok(b[0].activeHeat < b[1].activeHeat && b[1].activeHeat < b[3].activeHeat);
  assert.ok(b[0].activeEV < b[3].activeEV && b[0].activeBattery < b[3].activeBattery);
  assert.ok(b[0].response < a[0].response);
  close(b[3].activeHeat, a[3].activeHeat);
});
test('ramp requests are followed subject to physical limits, with complete recovery', () => {
  for (const scenario of ['evening', 'winter', 'solar'])
    for (const onramp of [30, 60])
      for (const duration of [1, 4])
        for (const reserve of [10, 80]) {
          const r = M.simulate({ scenario, onramp, duration, reserve, dispatch: 'follow' });
          r.rows.filter(row => row.inEvent).forEach(row => {
            assert.ok(row.response <= row.requested + 1e-6);
            assert.ok(row.response >= -1e-6);
          });
          assert.ok(r.evDeadlinesMet);
          close(r.evEnergyActual, r.evEnergyBaseline);
          assert.ok(r.lowestTemp >= 19 - 1e-6);
          assert.ok(r.highestTemp <= 21 + 1e-6);
          assert.ok(r.lowestBattery >= reserve / 10 - 1e-6);
          r.batteryFinal.forEach(energy => close(energy, 8));
          assert.equal(r.intervalsOnTarget + r.intervalsBelow + r.intervalsAbove, r.eventIntervals);
        }
});
test('on-ramp and recovery controls are independent during the event', () => {
  for (const scenario of ['evening', 'solar', 'winter']) {
    const a = M.simulate({ scenario, dispatch: 'follow', onramp: 60, coordinated: true });
    const b = M.simulate({ scenario, dispatch: 'follow', onramp: 60, coordinated: false });
    a.rows.forEach((row, i) => { if (row.inEvent) { close(row.response, b.rows[i].response); close(row.requested, b.rows[i].requested); } });
  }
});
test('solar reduces both net-demand curves equally and provides no invented event response', () => {
  const r = M.simulate({ onramp: 30, dispatch: 'follow' });
  assert.ok(r.counts.solar > 0);
  r.rows.forEach(row => {
    close(row.baseline + row.generation, row.grossBaseline);
    close(row.actual + row.generation, row.grossActual);
    close(row.evResponse + row.heatResponse + row.batteryResponse, row.response);
    if (row.t >= 24 && row.t <= 30) close(row.generation, 0);
  });
  assert.ok(r.rows.some(row => row.generation > 0));
});

test('combined household chart preserves charging energy and reconciles total demand', () => {
  for (const weather of ['windy','sunny','cloudy','still','overnight','changeable']) {
    for (const start of [12,18,24,29]) {
      const r = M.householdShift(start,31,weather);
      close(r.plan.delivered,14);
      close(r.rows.reduce((s,p)=>s+(p.total-p.home)*M.DT,0),14);
      close(r.beyond,r.rows.reduce((s,p)=>s+Math.max(0,p.total-p.generation)*M.DT,0));
      assert.ok(r.rows.every(p=>p.total>=p.home && p.generation>=0 && p.total<=10 && p.generation<=10));
      const original=M.householdShift(18,31,weather);
      close(r.rows.reduce((s,p)=>s+p.total*M.DT,0),original.rows.reduce((s,p)=>s+p.total*M.DT,0));
    }
  }
});
test('weather changes the useful charging time without inventing solar at night', () => {
  const daytime=M.householdShift(12,31,'sunny'),night=M.householdShift(24,31,'sunny');
  assert.ok(daytime.beyond<night.beyond);
  const evening=M.householdShift(18,31,'overnight'),overnight=M.householdShift(25,31,'overnight');
  assert.ok(overnight.beyond<evening.beyond);
  assert.ok(daytime.rows.filter(p=>p.t%24>=18 || p.t%24<=6).every(p=>p.solar<1e-9));
  assert.ok(night.peak<night.baselinePeak);
});

test('spreading household charging preserves energy and respects power and deadlines', () => {
  for (const duration of [2,2.25,4,6,8,12]) {
    for (const departure of [29,31,34]) {
      const start=departure-duration;
      const r=M.householdShift(start,departure,'overnight',duration);
      close(r.plan.delivered,14);
      close(r.rows.reduce((sum,p)=>sum+p.charging*M.DT,0),14);
      close(r.power,14/duration);
      assert.ok(r.rows.every(p=>p.charging<=7+1e-9 && (p.t<departure || p.charging===0)));
      close(r.end,departure);
      close(r.baselineBeyond,M.householdShift(18,departure,'overnight',2).baselineBeyond);
    }
  }
});
test('a gentler charge can fit beneath available renewables while preserving the journey', () => {
  const fast=M.householdShift(24,31,'overnight',2);
  const gentle=M.householdShift(24,31,'overnight',6);
  close(fast.plan.delivered,gentle.plan.delivered);
  assert.ok(fast.beyond>gentle.beyond);
  assert.ok(gentle.rows.filter(p=>p.charging>0).every(p=>p.total<=p.generation));
  close(gentle.beyond,gentle.rows.reduce((sum,p)=>sum+Math.max(0,p.home-p.generation)*M.DT,0));
  const scarce=M.householdShift(24,31,'still',6);
  assert.ok(scarce.beyond>0,'longer charging must not invent renewable supply');
});

test('illustrative tariff uses exact peak and off-peak boundaries', () => {
  for(const [t,rate] of [[0,.1],[5.75,.1],[6,.25],[15.75,.25],[16,.35],[20.75,.35],[21,.25],[23.75,.25],[24,.1],[30,.25],[36,.25]]) close(M.illustrativeRate(t),rate);
});
test('time-of-use costs integrate each interval and keep the original comparison fixed', () => {
  const original=M.householdShift(18,31,'windy',2);
  close(original.chargingCost,4.9);close(original.baselineChargingCost,4.9);
  const overnight=M.householdShift(24,31,'overnight',6);
  close(overnight.chargingCost,1.4);
  const crossing=M.householdShift(18,31,'still',12);
  close(crossing.chargingCost,2.8);
  for(const r of [original,overnight,crossing]) {
    close(r.householdCost,r.rows.reduce((sum,p)=>sum+p.total*p.rate*M.DT,0));
    close(r.householdCost-r.baselineHouseholdCost,r.chargingCost-r.baselineChargingCost);
    close(r.baselineChargingCost,4.9);
  }
  close(M.householdShift(24,31,'sunny',6).chargingCost,overnight.chargingCost);
});

test('neighbourhood charging compares identical cars and energy needs', () => {
  const f=M.neighbourhoodCharging();
  for(const r of Object.values(f.results)){
    close(r.energy,f.required);close(r.shortfall,0);assert.equal(r.ready,f.evCount);
    r.plans.forEach((plan,i)=>{
      close(plan.reduce((sum,p)=>sum+p*M.DT,0),f.cars[i].energy);
      assert.ok(plan.every((p,k)=>p>=0 && p<=7+1e-6 && (p===0 || M.hours[k]>=f.cars[i].arrival && M.hours[k]<f.cars[i].departure)));
    });
    for(let k=0;k<M.STEPS;k++)close(r.total[k],f.base[k]+r.plans.reduce((sum,plan)=>sum+plan[k],0));
    close(r.cost,r.plans.reduce((sum,plan)=>sum+plan.reduce((v,p,k)=>v+p*M.DT*M.illustrativeRate(M.hours[k]),0),0));
  }
  assert.ok(f.results.midnight.peak>f.results.arrival.peak);
  assert.ok(f.results.coordinated.peak<=f.limit+1e-6);
  close(f.results.midnight.cost,f.results.coordinated.cost);
});
test('coordination respects availability and spare capacity across fleet sizes', () => {
  for(const homes of [20,60,80])for(const evShare of [25,70,100])for(const limit of [30,100,200]){
    const f=M.neighbourhoodCharging({homes,evShare,limit}),r=f.results.coordinated;
    r.total.forEach((total,k)=>assert.ok(total<=Math.max(limit,f.base[k])+1e-6));
    close(r.energy+r.shortfall,f.required);
    r.plans.forEach((plan,i)=>assert.ok(plan.every((p,k)=>p<=7+1e-6 && p>=0 && (p===0 || M.hours[k]>=f.cars[i].arrival && M.hours[k]<f.cars[i].departure))));
  }
  const f=M.neighbourhoodCharging({homes:80,evShare:100,limit:30});
  assert.ok(f.results.coordinated.shortfall>0);
  assert.ok(f.results.coordinated.ready<f.evCount);
  assert.ok(f.results.coordinated.overloadHours>0,'base household demand can itself exceed a very low limit');
});

test('household objective buttons expose the cost versus renewables trade-off', () => {
  for(const departure of [29,34])for(const weather of ['sunny','overnight','still']) {
    const cheap=M.bestHouseholdSchedule(departure,weather,'cost');
    const renewable=M.bestHouseholdSchedule(departure,weather,'renewables');
    for(const best of [cheap,renewable]){
      assert.ok(best.start>=12 && best.start+best.duration<=departure+1e-6);
      assert.ok(best.duration>=2 && best.duration<=12);
      close(best.result.plan.delivered,14);
    }
    close(cheap.result.chargingCost,1.4);
    assert.ok(renewable.result.beyond<=cheap.result.beyond+1e-6);
    assert.ok(cheap.result.chargingCost<=renewable.result.chargingCost+1e-6);
    for(const start of [12,18,24])for(const duration of [2,4])if(start+duration<=departure){
      const candidate=M.householdShift(start,departure,weather,duration);
      assert.ok(cheap.result.chargingCost<=candidate.chargingCost+1e-6);
      assert.ok(renewable.result.beyond<=candidate.beyond+1e-6);
    }
  }
  const a=M.bestHouseholdSchedule(31,'sunny','cost'),b=M.bestHouseholdSchedule(31,'sunny','renewables');
  assert.ok(a.result.chargingCost<b.result.chargingCost);
  assert.ok(a.result.beyond>b.result.beyond);
});

test('EV renewable matching counts only simultaneous supply left after household use', () => {
  for(const weather of ['windy','sunny','still','overnight'])for(const start of [12,18,21.5,24])for(const duration of [2,6])if(start+duration<=31){
    const r=M.householdShift(start,31,weather,duration);
    close(r.renewableMatched,r.rows.reduce((sum,p)=>sum+Math.min(p.charging,Math.max(0,p.generation-p.home))*M.DT,0));
    close(r.renewableShare,r.renewableMatched/14*100);
    assert.ok(r.renewableShare>=0 && r.renewableShare<=100+1e-6);
    const homeGap=r.rows.reduce((sum,p)=>sum+Math.max(0,p.home-p.generation)*M.DT,0);
    close(r.beyond-homeGap,14-r.renewableMatched);
  }
  const screenshot=M.householdShift(21.5,31,'windy',2);
  assert.ok(screenshot.renewableShare<30,'a small improvement must not meet the 90% target');
  const cheap=M.bestHouseholdSchedule(31,'sunny','cost').result;
  const renewable=M.bestHouseholdSchedule(31,'sunny','renewables').result;
  close(cheap.renewableShare,0);close(renewable.renewableShare,100);
  assert.ok((1-cheap.chargingCost/cheap.baselineChargingCost)*100>=30);
  assert.ok((1-renewable.chargingCost/renewable.baselineChargingCost)*100<30);
});

test('demand turn-up uses more solar without adding EV energy', () => {
  const initial=M.renewableAbundance(0),full=M.renewableAbundance(100);
  let previous=initial;
  for(let share=0;share<=100;share+=10){
    const r=M.renewableAbundance(share);
    close(r.chargingEnergy,140);
    close(r.rows.reduce((sum,p)=>sum+p.demand*M.DT,0),initial.rows.reduce((sum,p)=>sum+p.demand*M.DT,0));
    close(r.used+r.unused,r.rows.reduce((sum,p)=>sum+p.generation*M.DT,0));
    close(initial.unused-r.unused,r.extraUsed);
    assert.ok(r.extraUsed>=previous.extraUsed-1e-6);
    assert.ok(r.eveningPeak<=previous.eveningPeak+1e-6);
    assert.ok(r.rows.every(p=>p.used>=0 && p.unused>=0 && p.used<=p.demand+1e-6 && p.used<=p.generation+1e-6));
    assert.equal(r.movedCars,share/10);previous=r;
  }
  close(full.extraUsed,140);close(initial.eveningPeak-full.eveningPeak,70);
});
