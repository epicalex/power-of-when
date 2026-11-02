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
