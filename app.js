(function () {
  'use strict';
  const M = window.FlexModel;
  const $ = id => document.getElementById(id);
  const state = { chargingMode: 'arrival', weather: 'windy', scenario: 'evening', dispatch: 'follow', time: 24, playing: false };
  const time = t => {
    const minutes = Math.round(t * 60) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  };
  const value = id => Number($(id).value);
  const money = amount => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  const number = n => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(n);
  const hoursText = n => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n);
  const put = (id, text) => { $(id).textContent = text; };
  let fleet;

  function house(x, y, scale, active, variant = 0) {
    const wall = active ? '#c9d7bc' : '#e2e6dc';
    const side = active ? '#afc2a0' : '#cbd3c3';
    const roof = active ? '#627c58' : '#a4b19b';
    return `<g transform="translate(${x} ${y}) scale(${scale})">
      <ellipse cx="0" cy="35" rx="47" ry="12" fill="#45583d" opacity=".07"/>
      <path d="M-38-6V25L0 44V12Z" fill="${wall}" stroke="#647b5b" stroke-width=".6"/>
      <path d="M0 12V44L38 25V-6Z" fill="${side}" stroke="#647b5b" stroke-width=".6"/>
      <path d="M-38-6L-19-33 0 12Z" fill="${wall}" stroke="#647b5b" stroke-width=".6"/>
      <path d="M-19-36L22-55 44-8 0 15Z" fill="${roof}" stroke="#597050" stroke-width=".7"/>
      <path d="M-41-5L-19-36 0 15" fill="none" stroke="#597050" stroke-width="2" stroke-linejoin="round"/>
      <path d="M-33 4L-27 7V19L-33 16Z" fill="#fbefc8" stroke="#7b8c6d" stroke-width=".7"/>
      <path d="M12 13V28L24 22V7Z" fill="${active ? '#ebf1da' : '#dce4d3'}" stroke="#728367" stroke-width=".7"/>
      <path d="M-24 12L-14 17V37L-24 32Z" fill="#86987a" stroke="#647b5b" stroke-width=".6"/>
      <circle cx="-16" cy="27" r=".8" fill="#e8ebd7"/>
      ${variant % 3 === 0 ? '<path d="M-7-25L14-35 22-17 1-7Z" fill="#345548" stroke="#b3c3a3" stroke-width=".8"/><path d="M0-28.3L8-10.3M7-31.7L15-13.7M-3-16L18-26" stroke="#94b3a1" stroke-width=".6"/>' : ''}
      ${variant % 3 === 1 ? '<path d="M29 7L37 3V22L29 26Z" fill="#f0eee3" stroke="#68845e" stroke-width=".8"/><path d="M32 9L35 7" stroke="#397451" stroke-width="2"/>' : ''}
      ${active ? '<circle cx="-19" cy="-12" r="2.5" fill="#d4dfa8"/>' : ''}
    </g>`;
  }
  function tree(x, y, s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="22" rx="15" ry="6" fill="#536c45" opacity=".09"/><path d="M0 0V22" stroke="#718160" stroke-width="3"/><ellipse cy="-8" rx="16" ry="23" fill="#bdcaaa"/><path d="M0-20V12M0 0L-9-8M0 6L9-5" fill="none" stroke="#9cae87" stroke-width="1"/></g>`;
  }
  function car(x, y, s = 1) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="19" rx="41" ry="8" fill="#4e6250" opacity=".10"/><path d="M-37 0L-23-13H12L31-2 39 0V17H-38Z" fill="#e2b29a" stroke="#876e5c" stroke-width="1"/><path d="M-19-10H9L23-2H-26Z" fill="#6e8376"/><path d="M-6-10V-2" stroke="#d6c7b2"/><circle cx="-24" cy="16" r="7" fill="#45584c"/><circle cx="24" cy="16" r="7" fill="#45584c"/><circle cx="-24" cy="16" r="3" fill="#c2c9b9"/><circle cx="24" cy="16" r="3" fill="#c2c9b9"/><path d="M-38 5H-32M33 5H39" stroke="#f5e8b8" stroke-width="3"/></g>`;
  }
  function roadCar(x, y, scale = 1) {
    return `<g transform="translate(${x} ${y}) scale(${scale})">
      <ellipse cx="0" cy="8" rx="40" ry="12" transform="rotate(-30)" fill="#4e6250" opacity=".12"/>
      <path d="M-36-1L20-33 36-24-20 8Z" fill="#e4b49b" stroke="#876e5c" stroke-width=".8"/>
      <path d="M-20 8L36-24V-12L-20 20Z" fill="#ca9278" stroke="#876e5c" stroke-width=".8"/>
      <path d="M-36-1L-20 8V20L-36 11Z" fill="#bb856f" stroke="#876e5c" stroke-width=".8"/>
      <path d="M-24-8L-20-22 7-38 15-30 22-16-8 1Z" fill="#ead1bb" stroke="#876e5c" stroke-width=".8"/>
      <path d="M-20-22L7-38 18-32-9-16Z" fill="#7c9388"/>
      <path d="M-9-16L18-32 22-18-8-1Z" fill="#526f63"/>
      <path d="M5-24L7-10" stroke="#dfc4ae" stroke-width="1.5"/>
      <ellipse cx="-10" cy="13" rx="4.5" ry="6" fill="#40564a"/><ellipse cx="24" cy="-6" rx="4.5" ry="6" fill="#40564a"/>
      <ellipse cx="-10" cy="13" rx="2" ry="3" fill="#c6ccba"/><ellipse cx="24" cy="-6" rx="2" ry="3" fill="#c6ccba"/>
      <path d="M30-18L34-20" stroke="#f6e9bc" stroke-width="3"/>
    </g>`;
  }
  function heroArt() {
    $('hero-scene').innerHTML = `<defs><pattern id="dots" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#9ead93" opacity=".35"/></pattern></defs>
      <rect width="600" height="470" fill="url(#dots)"/>
      <circle cx="414" cy="84" r="28" fill="#e8d9ac" opacity=".8"/>
      <path d="M58 292L294 153 552 299 314 438Z" fill="#d8dfcc" stroke="#becbb1" stroke-width="1"/>
      <path d="M81 299L300 174 528 303 309 425Z" fill="#e4e8db"/>
      <path d="M164 246L393 378 420 362 192 231Z" fill="#cfd5c7"/>
      <path d="M148 350L374 220 400 235 174 365Z" fill="#cfd5c7"/>
      <path d="M179 238L407 371M160 359L387 228" stroke="#f4f3e7" stroke-width="1.6" stroke-dasharray="8 8"/>
      ${house(176, 243, 1.05, true, 0)}${house(289, 188, 1.05, true, 1)}${house(401, 249, 1.05, true, 0)}${house(288, 323, 1.05, true, 2)}${house(399, 382, .83, false, 1)}
      ${tree(112, 302, .8)}${tree(459, 318, .9)}${tree(228, 177, .7)}${tree(345, 425, .65)}${tree(487, 290, .6)}
      ${roadCar(217, 326, .72)}
      <g fill="none" stroke="#74936c" stroke-width="1.3" stroke-dasharray="4 5">
        <path d="M235 114C165 132 124 170 156 230"/>
        <path d="M285 114C281 138 275 151 269 175"/>
        <path d="M345 114C410 137 437 184 381 236"/>
        <path d="M380 114C518 189 509 302 268 310"/>
      </g>
      <g fill="#f5f3ed" stroke="#74936c" stroke-width="1.4"><circle cx="156" cy="230" r="3.5"/><circle cx="269" cy="175" r="3.5"/><circle cx="381" cy="236" r="3.5"/><circle cx="268" cy="310" r="3.5"/></g>
      <g><rect x="209" y="65" width="201" height="49" rx="5" fill="#f5f3ed" stroke="#9aaf8d"/><text x="309.5" y="85" text-anchor="middle" fill="#325a46" font-family="sans-serif" font-size="11" letter-spacing="1">VPP COORDINATOR</text><text x="309.5" y="101" text-anchor="middle" fill="#657a5e" font-family="sans-serif" font-size="8">Software linking participating homes</text></g>
      <path d="M92 183V104" stroke="#8c9f7e" stroke-width="3"/>
      <g fill="#819b73"><path d="M90 103L89 72Q89 63 93 61L97 94 95 104Z"/><path d="M90 103L89 72Q89 63 93 61L97 94 95 104Z" transform="rotate(120 92 104)"/><path d="M90 103L89 72Q89 63 93 61L97 94 95 104Z" transform="rotate(240 92 104)"/></g><circle cx="92" cy="104" r="4" fill="#6d8761"/>
      <path d="M470 161H505M480 172H520M70 219H96" stroke="#bdc9af" stroke-width="1"/>
      <path d="M145 459H171" stroke="#74936c" stroke-width="1.5" stroke-dasharray="4 4"/><text x="181" y="462" fill="#61765b" font-family="sans-serif" font-size="9">Control signals · not electrical wires</text>`;
  }
  function chartFrame(container, height = 220, max = 10, min = 0, event = null, ticks = null, domain = [12, 36], top = 28) {
    const width = Math.max(280, container.clientWidth);
    const left = 43, right = width - 16, bottom = height - 33;
    const x = t => left + (t - domain[0]) / (domain[1] - domain[0]) * (right - left);
    const y = p => bottom - (p - min) / (max - min) * (bottom - top);
    let grid = '';
    const gridValues = ticks || Array.from({ length: 5 }, (_, i) => min + (max - min) * i / 4);
    for (const p of gridValues) {
      grid += `<line class="chart-grid" x1="${left}" x2="${right}" y1="${y(p)}" y2="${y(p)}"/><text class="chart-axis" x="${left - 9}" y="${y(p) + 3}" text-anchor="end">${number(p)}</text>`;
    }
    const tickStep = domain[1] - domain[0] <= 2 ? 0.5 : 1;
    const timeTicks = domain[0] === 12 && domain[1] === 36 ? [12, 18, 24, 30, 36] : domain[0] === 6 && domain[1] === 24 ? [6, 12, 18, 24] : Array.from({ length: Math.floor((domain[1] - domain[0]) / tickStep) + 1 }, (_, i) => domain[0] + i * tickStep);
    if (timeTicks[timeTicks.length - 1] < domain[1]) timeTicks.push(domain[1]);
    timeTicks.forEach(t => {
      grid += `<text class="chart-axis" x="${x(t)}" y="${height - 10}" text-anchor="${t === domain[0] ? 'start' : t === domain[1] ? 'end' : 'middle'}">${time(t)}</text>`;
    });
    const eventSvg = event ? `<rect x="${x(event[0])}" y="${top}" width="${x(event[1]) - x(event[0])}" height="${bottom - top}" fill="#eadcc4" opacity=".65"/><text x="${x(event[0]) + 5}" y="${top - 9}" class="chart-unit">EVENT</text>` : '';
    return { width, height, left, right, top, bottom, x, y, grid, eventSvg };
  }
  function stepPath(values, x, y, start = 12) {
    let d = `M${x(start)},${y(values[0])}`;
    values.forEach((p, i) => { if (i) d += `V${y(p)}`; d += `H${x(start + (i + 1) * M.DT)}`; });
    return d;
  }
  function chimney(x, y, height = 78) {
    return `<g transform="translate(${x} ${y})"><ellipse cy="1" rx="16" ry="8" fill="#64775a" opacity=".12"/><ellipse rx="14" ry="7" fill="#bdcbb1" stroke="#819675" stroke-width=".8"/><path d="M-10 ${-height}V0C-10 7 10 7 10 0V${-height}Z" fill="#a4b796" stroke="#748a68" stroke-width=".8"/><path d="M0 ${-height}V5C5 5 10 3 10 0V${-height}Z" fill="#8ea57f"/><path d="M-10 ${-height / 2}C-10 ${-height / 2 + 7} 10 ${-height / 2 + 7} 10 ${-height / 2}" fill="none" stroke="#bdcbb1" stroke-width="1"/><ellipse cy="${-height}" rx="10" ry="5.5" fill="#d4dec8" stroke="#748a68" stroke-width=".9"/><ellipse cy="${-height}" rx="6.5" ry="3.2" fill="#5d7351"/></g>`;
  }
  function onrampValue() {
    const selected = Array.from(document.querySelectorAll('[name="onramp"]')).find(input => input.checked);
    return selected ? Number(selected.value) : 0;
  }
  function setOnramp(minutes) {
    document.querySelectorAll('[name="onramp"]').forEach(input => { input.checked = Number(input.value) === minutes; });
  }
  function renderPeak() {
    const rows = M.peakDay();
    const row = rows.reduce((peak,r)=>r.demand>peak.demand?r:peak,rows[0]);
    const c = chartFrame($('peak-chart'), 290, 600, 0, null, [0, 120, 240, 360, 480, 600]);
    // Monotone cubic interpolation passes through the model samples without overshooting peaks.
    const samples = rows.concat({ t: 36, demand: rows[0].demand });
    const slopes = samples.slice(1).map((r,i)=>(r.demand-samples[i].demand)/(r.t-samples[i].t));
    const tangents = samples.map((r,i)=>i===0?slopes[0]:i===samples.length-1?slopes[i-1]:slopes[i-1]*slopes[i]<=0?0:2*slopes[i-1]*slopes[i]/(slopes[i-1]+slopes[i]));
    let demandPath=`M${c.x(samples[0].t)},${c.y(samples[0].demand)}`;
    for(let i=0;i<samples.length-1;i++) {
      const a=samples[i], b=samples[i+1], third=(b.t-a.t)/3;
      demandPath+=`C${c.x(a.t+third)},${c.y(a.demand+tangents[i]*third)} ${c.x(b.t-third)},${c.y(b.demand-tangents[i+1]*third)} ${c.x(b.t)},${c.y(b.demand)}`;
    }
    $('peak-chart').innerHTML = `<svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true"><defs><clipPath id="peaker-gap-clip"><rect x="${c.left}" y="${c.top}" width="${c.right-c.left}" height="${c.y(300)-c.top}"/></clipPath></defs>${c.grid}<path d="${demandPath}L${c.right},${c.bottom}L${c.left},${c.bottom}Z" clip-path="url(#peaker-gap-clip)" fill="#ce9275" opacity=".65"/><line x1="${c.left}" x2="${c.right}" y1="${c.y(300)}" y2="${c.y(300)}" stroke="#62815a" stroke-width="2" stroke-dasharray="5 4"/><text x="${c.right}" y="13" text-anchor="end" fill="#52734a" font-family="sans-serif" font-size="9">WITHOUT THE PEAKER · 300 MW</text><path d="${demandPath}" class="chart-line" stroke="#253d34" stroke-width="2.2"/><circle cx="${c.x(row.t)}" cy="${c.y(row.demand)}" r="4" fill="#253d34" stroke="#fcfbf7" stroke-width="2"/><text x="${c.x(row.t)}" y="${c.y(row.demand)-13}" text-anchor="middle" fill="#253d34" font-family="sans-serif" font-size="11">${number(row.demand)} MW demand</text><text x="${c.left}" y="13" class="chart-unit">POWER · MW</text></svg>`;
    put('peak-extra', `${number(row.peaker)} MW`);
    put('peak-hero-clock', time(row.t));
    $('peak-chart').setAttribute('aria-label', `Demand and peaker output. At ${time(row.t)}, demand is ${number(row.demand)} megawatts, supply available without the peaker is up to 300 megawatts, and peaker output is ${number(row.peaker)} megawatts.`);
    const active = row.peaker > 0;
    const colour = active ? '#c58065' : '#a8b39e';
    $('peak-scene').innerHTML = `<defs><pattern id="peak-dots" width="17" height="17" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#9ead93" opacity=".35"/></pattern><marker id="power-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4 0 8Z" fill="${colour}"/></marker></defs><rect width="600" height="470" fill="url(#peak-dots)"/><circle cx="456" cy="130" r="28" fill="#e4c9a1"/><path d="M50 310L264 184 557 348 340 459Z" fill="#dce3d2" stroke="#c2ceb5"/><path d="M230 304L389 214M277 331L468 320" fill="none" stroke="${colour}" stroke-width="3" marker-end="url(#power-arrow)"/>
      <g transform="translate(147 245)"><ellipse cx="40" cy="78" rx="114" ry="27" fill="#64775a" opacity=".10"/><path d="M-60-12L45-73 142-17 37 44Z" fill="#c5d0bb" stroke="#809373"/><path d="M-60-12V54L37 110V44Z" fill="#d9dfce" stroke="#809373"/><path d="M37 44L142-17V49L37 110Z" fill="#adbea0" stroke="#809373"/>${chimney(62, -53)}${chimney(20, -29)}${chimney(-22, -5)}<path d="M-48 3L-33 12V37L-48 28ZM-24 17L-9 26V51L-24 42ZM0 31L15 40V65L0 56Z" fill="${colour}"/><path d="M61 47L81 35V66L61 78ZM95 27L116 15V47L95 59Z" fill="#78916a"/></g>
      ${house(401, 225, .9, true, 2)}${house(477, 336, .9, true, 2)}${tree(372, 360, .8)}${tree(528, 383, .7)}<text x="95" y="410" fill="#667b5e" font-family="sans-serif" font-size="10" letter-spacing="1">PEAKING POWER STATION</text><rect x="267" y="55" width="267" height="49" rx="4" fill="#f5f3ed" stroke="#b9c7ab"/><text x="400" y="76" fill="#253d34" font-family="sans-serif" font-size="11" text-anchor="middle">${number(row.peaker)} MW EXTRA OUTPUT</text><text x="400" y="92" fill="#657a5e" font-family="sans-serif" font-size="9" text-anchor="middle">${active ? 'Called on to cover the demand peak' : 'Not needed at this point in the day'}</text>`;
  }
  function renderEV() {
    const departure = value('departure');
    const duration = value('charge-duration');
    const latest = departure - duration;
    $('charge-start').max = latest;
    if (value('charge-start') > latest) $('charge-start').value = latest;
    const start = value('charge-start');
    put('charge-start-out', time(start));
    put('departure-out', time(departure));
    put('start-latest', `${time(latest)} · ${latest >= 24 ? 'tomorrow' : 'today'}`);
    put('charge-duration-out', `${hoursText(duration)} hours`);
    put('charge-power', `${number(14 / duration)} kW × ${hoursText(duration)} hours`);
    $('charge-duration').setAttribute('aria-valuetext', `${hoursText(duration)} hours at ${number(14 / duration)} kilowatts`);
    put('ev-window', `${time(start)}–${time(start + duration)}`);
    $('charge-start').setAttribute('aria-valuetext', time(start));
    $('departure').setAttribute('aria-valuetext', `${time(departure)} tomorrow`);
    renderHousehold();
  }
  function renderHousehold() {
    const start = value('charge-start'), departure = value('departure');
    const result = M.householdShift(start, departure, state.weather, value('charge-duration')), rows = result.rows;
    const descriptions = {
      windy: 'Breezy day: wind continues after sunset, with some daytime solar.',
      sunny: 'Sunny, light winds: most of the shown renewable electricity arrives in daylight.',
      cloudy: 'Cloudy and breezy: limited solar, with wind throughout the day.',
      still: 'Still and cloudy: little wind or solar. Moving charging alone cannot create more supply.',
      overnight: 'Windy overnight: the strongest wind arrives after midnight.',
      changeable: 'Changeable winds and sun: later is not automatically better; compare the curves.'
    };
    const c = chartFrame($('ev-chart'), 300, 10, 0, null, [0, 2, 4, 6, 8, 10], [12, 36], 62);
    const tariffBands = [[12,16,'Standard','25p/kWh','#eeece6'],[16,21,'Peak','35p/kWh','#f2ddcc'],[21,24,'Standard','25p/kWh','#eeece6'],[24,30,'Off-peak','10p/kWh','#e0e5f4'],[30,36,'Standard','25p/kWh','#eeece6']].map(([a,b,name,label,fill]) => `<rect x="${c.x(a)}" y="23" width="${c.x(b)-c.x(a)}" height="20" fill="${fill}"/><text x="${(c.x(a)+c.x(b))/2}" y="14" text-anchor="middle" class="chart-unit">${name}</text><text x="${(c.x(a)+c.x(b))/2}" y="37" text-anchor="middle" class="chart-unit">${label}</text>`).join('');
    const tariffLines = [16,21,24,30].map(t => `<line x1="${c.x(t)}" x2="${c.x(t)}" y1="23" y2="${c.bottom}" stroke="#877b99" stroke-width="1" stroke-dasharray="2 4"/><text x="${c.x(t)}" y="54" text-anchor="middle" class="chart-unit">${time(t)}</text>`).join('');
    const home = rows.map(r => r.home), total = rows.map(r => r.total);
    const band = [...rows.flatMap(r => [[c.x(r.t), c.y(r.total)], [c.x(r.t + M.DT), c.y(r.total)]]), ...rows.slice().reverse().flatMap(r => [[c.x(r.t + M.DT), c.y(r.home)], [c.x(r.t), c.y(r.home)]])];
    const gap = [...rows.flatMap(r => [[c.x(r.t), c.y(r.total)], [c.x(r.t + M.DT), c.y(r.total)]]), ...rows.slice().reverse().flatMap(r => [[c.x(r.t + M.DT), c.y(Math.min(r.total, r.generation))], [c.x(r.t), c.y(Math.min(r.total, r.generation))]])];
    $('ev-chart').innerHTML = `<svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true"><defs><pattern id="renewable-gap-hatch" patternUnits="userSpaceOnUse" width="7" height="7"><path d="M-2 2L2-2M0 7L7 0M5 9L9 5" stroke="#b64d38" stroke-width="1.1" opacity=".7"/></pattern></defs>${c.grid}${tariffBands}<text x="${c.left+6}" y="${c.top+13}" class="chart-unit">kW</text><path d="${stepPath(home,c.x,c.y)}L${c.x(36)},${c.y(0)}L${c.x(12)},${c.y(0)}Z" fill="#c5ccbe" opacity=".65"/><path d="M${band.map(p=>p.join(',')).join('L')}Z" fill="#b7cfe9" opacity=".7"/><path d="M${gap.map(p=>p.join(',')).join('L')}Z" fill="#f0bda9" opacity=".6"/><path d="M${gap.map(p=>p.join(',')).join('L')}Z" fill="url(#renewable-gap-hatch)"/><path d="${stepPath(rows.map(r=>r.baseline),c.x,c.y)}" class="chart-line" stroke="#858585" stroke-width="1.6" stroke-dasharray="2 4"/><path d="${stepPath(total,c.x,c.y)}" class="chart-line" stroke="#2857a0" stroke-width="2.8"/><path d="${stepPath(rows.map(r=>r.generation),c.x,c.y)}" class="chart-line" stroke="#a56b08" stroke-width="2.8" stroke-dasharray="9 4"/>${tariffLines}<line x1="${c.x(departure)}" x2="${c.x(departure)}" y1="${c.top}" y2="${c.bottom}" stroke="#ce7055" stroke-dasharray="3 4"/><text x="${Math.min(c.width-62,c.x(departure)+5)}" y="${c.bottom-8}" class="chart-unit">READY BY</text></svg>`;
    put('ev-charge-cost', money(result.chargingCost));
    put('ev-original-cost', money(result.baselineChargingCost));
    put('household-cost', money(result.householdCost));
    put('household-original-cost', `Original schedule: ${money(result.baselineHouseholdCost)}`);
    const costChange = result.baselineChargingCost - result.chargingCost;
    put('ev-charge-saving', money(Math.abs(costChange)));
    put('ev-saving-label', costChange < -.005 ? 'EXTRA EV CHARGING COST' : 'EV CHARGING SAVING');
    put('ev-cost-change', Math.abs(costChange)<.005 ? 'No saving yet' : `${number(Math.abs(costChange)/result.baselineChargingCost*100)}% ${costChange>0?'saved':'more expensive'}`);
    put('weather-description', descriptions[state.weather]);
    put('home-peak', `${number(result.peak)} kW`);
    put('home-peak-before', `Original 18:00 / 2-hour charge: ${number(result.baselinePeak)} kW`);
    const savingPercent = costChange / result.baselineChargingCost * 100;
    const costReached = savingPercent >= 30 - 1e-8;
    const matchReached = result.renewableShare >= 90 - 1e-8;
    put('ev-renewable-share', `${number(result.renewableShare)}%`);
    put('ev-renewable-energy', `${number(result.renewableMatched)} of 14 kWh · after other household use`);
    put('ev-renewable-original', `Original charge: ${number(result.baselineRenewableShare)}% matched`);
    put('cost-goal-value', `${number(savingPercent)}% saved`);
    put('renewable-goal-value', `${number(result.renewableShare)}% matched`);
    put('cost-goal-label', `${costReached?'✓ ':''}Save at least 30%`);
    put('renewable-goal-label', `${matchReached?'✓ ':''}Match at least 90%`);
    $('cost-goal').classList.toggle('goal-reached',costReached);
    $('renewable-goal').classList.toggle('goal-reached',matchReached);
    $('cost-progress-fill').style.width=`${M.clamp(savingPercent,0,100)}%`;
    $('renewable-progress-fill').style.width=`${M.clamp(result.renewableShare,0,100)}%`;
    $('cost-progress').setAttribute('aria-valuenow',M.clamp(savingPercent,0,100));
    $('renewable-progress').setAttribute('aria-valuenow',M.clamp(result.renewableShare,0,100));
    $('ev-chart').setAttribute('aria-label', `Household demand with charging from ${time(start)} to ${time(result.end)} at ${number(result.power)} kilowatts. ${descriptions[state.weather]} Grey area is other household demand; pale blue adds EV charging. Solid blue line is total demand; dotted grey is the original 18:00 two-hour charge. Dashed amber is a wind and solar allocation. Hatched coral above the renewable curve is demand supplied by the rest of the system, not an outage. Peak demand ${number(result.peak)} kilowatts. ${number(result.renewableShare)} percent of the EV’s 14 kilowatt-hours matched to the shown renewables after other household use. Tariff boundaries at 16:00, 21:00, midnight and 06:00. EV charge costs ${money(result.chargingCost)} versus ${money(result.baselineChargingCost)} for the original. Fixed axis zero to ten kilowatts.`);
  }
  function renderNeighbourhoodCharging() {
    const fleet=M.neighbourhoodCharging({homes:value('charging-homes'),evShare:value('charging-share'),limit:value('charging-limit')});
    const selected=fleet.results[state.chargingMode];
    const names={arrival:'Charge on arrival',midnight:'Everyone waits until midnight',coordinated:'Coordinate charging'};
    put('charging-homes-out',fleet.homes);put('charging-share-out',`${value('charging-share')}% · ${fleet.evCount} EVs`);put('charging-limit-out',`${fleet.limit} kW`);
    const c=chartFrame($('charging-neighbourhood-chart'),300,700,0,null,[0,140,280,420,560,700]);
    const colours={arrival:'#8b8177',midnight:'#a56b08',coordinated:'#2857a0'};
    const other=Object.entries(fleet.results).filter(([mode])=>mode!==state.chargingMode).map(([mode,r])=>`<path d="${stepPath(r.total,c.x,c.y)}" class="chart-line" stroke="${colours[mode]}" stroke-width="1.5" stroke-dasharray="4 5" opacity=".55"/>`).join('');
    const overload=fleet.base.map((_,k)=>`<rect x="${c.x(M.hours[k])}" y="${c.y(Math.max(selected.total[k],fleet.limit))}" width="${c.x(M.hours[k]+M.DT)-c.x(M.hours[k])}" height="${Math.max(0,c.y(fleet.limit)-c.y(selected.total[k]))}" fill="#d88469" opacity=".45"/>`).join('');
    $('charging-neighbourhood-chart').innerHTML=`<svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true">${c.grid}<text x="${c.left}" y="13" class="chart-unit">NEIGHBOURHOOD DEMAND · kW / SAME SCALE FOR EVERY STRATEGY</text><rect x="${c.x(24)}" y="${c.top}" width="${c.x(30)-c.x(24)}" height="${c.bottom-c.top}" fill="#e0e5f4" opacity=".5"/><path d="${stepPath(fleet.base,c.x,c.y)}L${c.x(36)},${c.y(0)}L${c.x(12)},${c.y(0)}Z" fill="#c5ccbe" opacity=".6"/>${overload}${other}<path d="${stepPath(selected.total,c.x,c.y)}" class="chart-line" stroke="${colours[state.chargingMode]}" stroke-width="3"/><line x1="${c.left}" x2="${c.right}" y1="${c.y(fleet.limit)}" y2="${c.y(fleet.limit)}" stroke="#b34d39" stroke-width="2" stroke-dasharray="8 4"/><text x="${c.right}" y="${c.y(fleet.limit)-7}" text-anchor="end" fill="#b34d39" font-size="10" font-family="sans-serif">LOCAL LIMIT · ${fleet.limit} kW</text></svg>`;
    put('charging-peak',`${number(selected.peak)} kW`);put('charging-cost',money(selected.cost));put('charging-ready',`${selected.ready} / ${fleet.evCount}`);
    const delta=selected.cost-fleet.results.arrival.cost;
    put('charging-cost-note',Math.abs(delta)<.005?'Same as charging on arrival':`${money(Math.abs(delta))} ${delta<0?'less':'more'} than arrival`);
    put('charging-summary',`${names[state.chargingMode]}. ${selected.overloadHours>0?`${number(selected.overloadHours)} hours above the local limit.`:'Demand stays within the local limit.'} ${selected.shortfall>1e-6?`${number(selected.shortfall)} kWh of required charging could not be scheduled; ${fleet.evCount-selected.ready} cars miss their energy target. A lower cost here partly reflects undelivered energy.`:`All ${number(fleet.required)} kWh scheduled before each car’s departure.`}${selected.overloadHours>0?' Requested demand exceeds available network capacity.':''}${Math.max(...fleet.base)>fleet.limit?' Household use alone exceeds this limit at some times; charging coordination cannot remove that load.':''}`);
    const display=fleet.cars.slice(0,8), x=t=>125+(t-12)/24*650;
    $('charging-car-timelines').innerHTML=`<svg viewBox="0 0 800 ${display.length*29+44}" aria-hidden="true">${display.map((car,i)=>`<text x="5" y="${i*29+18}" font-family="sans-serif" font-size="11" fill="#657166">Car ${i+1} · ${number(car.energy)} kWh</text><rect x="${x(car.arrival)}" y="${i*29+6}" width="${x(car.departure)-x(car.arrival)}" height="16" fill="#e1e5dc"/>${selected.plans[i].map((p,k)=>p>0?`<rect x="${x(M.hours[k])}" y="${i*29+6}" width="${650*M.DT/24}" height="16" fill="${colours[state.chargingMode]}" opacity="${.3+.7*p/7}"/>`:'').join('')}`).join('')}${[12,18,24,30,36].map(t=>`<text x="${x(t)}" y="${display.length*29+24}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#657166">${time(t)}</text>`).join('')}</svg>`;
    $('charging-neighbourhood-chart').setAttribute('aria-label',`${names[state.chargingMode]}. ${fleet.homes} homes, ${fleet.evCount} cars. Peak ${number(selected.peak)} kilowatts against a ${fleet.limit} kilowatt limit. ${selected.ready} cars scheduled ready. Capacity exceeded for ${number(selected.overloadHours)} hours. EV scheduled-energy cost ${money(selected.cost)}. Fixed scale 0 to 700 kilowatts.`);
    $('charging-car-timelines').setAttribute('aria-label','First eight cars: grey bars show arrival to departure availability; coloured segments show scheduled charging, with darker segments indicating higher power.');
  }
  function renderAbundance() {
    const result=M.renewableAbundance(value('abundance-shift')),rows=result.rows;
    const c=chartFrame($('abundance-chart'),280,200,0,null,[0,50,100,150,200],[6,24]);
    const curve=values=>values.map((p,i)=>`${i?'L':'M'}${c.x(rows[i].t)},${c.y(p)}`).join(' ');
    const unused=rows.flatMap(r=>[[c.x(r.t),c.y(r.generation)],[c.x(r.t+M.DT),c.y(r.generation)]]).concat(rows.slice().reverse().flatMap(r=>[[c.x(r.t+M.DT),c.y(r.used)],[c.x(r.t),c.y(r.used)]]));
    $('abundance-chart').innerHTML=`<svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true">${c.grid}<text x="${c.left}" y="13" class="chart-unit">POWER · kW</text><rect x="${c.x(12)}" y="${c.top}" width="${c.x(14)-c.x(12)}" height="${c.bottom-c.top}" fill="#e5eddf"/><path d="M${unused.map(p=>p.join(',')).join('L')}Z" fill="#edce84" opacity=".6"/><path d="${stepPath(rows.map(r=>r.baseline),c.x,c.y,6)}" class="chart-line" stroke="#858585" stroke-width="1.6" stroke-dasharray="2 4"/><path d="${curve(rows.map(r=>r.generation))}" class="chart-line" stroke="#a56b08" stroke-width="2.5" stroke-dasharray="9 4"/><path d="${stepPath(rows.map(r=>r.demand),c.x,c.y,6)}" class="chart-line" stroke="#2857a0" stroke-width="2.8"/></svg>`;
    put('abundance-shift-out',`${result.movedCars} of 10 cars`);
    put('abundance-used',`${number(result.extraUsed)} kWh`);put('abundance-unused',`${number(result.unused)} kWh`);put('abundance-peak',`${number(result.eveningPeak)} kW`);
    $('abundance-chart').setAttribute('aria-label',`${result.movedCars} cars charge at lunchtime instead of 18:00. ${number(result.extraUsed)} extra kilowatt-hours of solar used. ${number(result.unused)} kilowatt-hours left unused. Evening peak ${number(result.eveningPeak)} kilowatts. All cars receive the same total 140 kilowatt-hours.`);
  }
  function renderDevices() {
    const reserve = value('reserve'), comfort = 20 - value('comfort');
    const degrees = n => String(Number(n.toFixed(2)));
    put('reserve-out', `${reserve}%`);
    $('reserve-mask').style.width = `${reserve}%`;
    put('battery-label', `${((80 - reserve) / 10).toFixed(1)} kWh above reserve`);
    put('battery-explanation', `10 kWh battery · starts 80% full · up to ${((80 - reserve) / 10 * .95).toFixed(1)} kWh exported after losses`);
    put('comfort-out', `${degrees(comfort)}°C of flexibility`);
    put('comfort-min', `${degrees(value('comfort'))}°C`);
    $('comfort').setAttribute('aria-valuetext', `${degrees(value('comfort'))} degrees minimum, ${degrees(comfort)} degrees of flexibility`);
    $('comfort').style.setProperty('--temperature-position', `${(value('comfort') - 18) / 1.5 * 100}%`);
  }
  function fleetOptions() {
    return { homes: value('homes'), participation: value('participation'), reserve: value('reserve'), comfort: 20 - value('comfort'), duration: value('duration'), target: value('target'), coordinated: $('coordinated').checked, scenario: state.scenario, dispatch: state.dispatch, onramp: onrampValue() };
  }
  function renderFleet(recalculate = true) {
    if (recalculate) fleet = M.simulate(fleetOptions());
    const o = fleetOptions();
    put('homes-out', o.homes);
    put('participation-out', `${o.participation}%`);
    put('duration-out', `${o.duration} ${o.duration === 1 ? 'hour' : 'hours'}`);
    put('target-out', `${o.target} kW`);
    const solar = state.scenario === 'solar';
    put('response-label', solar ? 'AVERAGE DEMAND INCREASE' : 'AVERAGE DEMAND REDUCTION');
    $('response-value').innerHTML = `${number(fleet.eventAverage)} <small>kW</small>`;
    $('met-value').innerHTML = `${Math.round(fleet.intervalsOnTarget / fleet.eventIntervals * 100)}% <small>of event</small>`;
    $('ready-value').innerHTML = fleet.evDeadlinesMet ? 'All <small>✓</small>' : 'Not all';
    put('fleet-inventory', `${fleet.counts.ev} EVs · ${fleet.counts.battery} batteries · ${fleet.counts.heat} heat pumps · ${fleet.counts.solar} solar rooftops · ${fleet.counts.enrolled} homes enrolled`);
    const met = fleet.intervalsOnTarget === fleet.eventIntervals;
    const recovery = `The highest demand in the six hours after the event is ${number(fleet.peakAfter)} kW.`;
    put('fleet-observation', o.participation === 0 ? 'No one is enrolled: the two curves overlap and no event response is delivered. Participation is a choice.' : `${solar ? 'Extra demand absorbs' : 'The event reduces demand by'} ${number(fleet.responseEnergy)} kWh ${solar ? 'of additional energy during the event' : 'during the event'}. ${met ? 'Delivery stays within 5% of the request throughout.' : `Delivery stays within 5% of the requested profile (ramping to ${o.target} kW) for ${number(fleet.intervalsOnTarget * M.DT)} of ${o.duration} hours; ${number(fleet.intervalsBelow * M.DT)} hours are below the band and ${number(fleet.intervalsAbove * M.DT)} hours above it.`} ${recovery}`);
    $('met-value').classList.toggle('warning-text', !met);
    renderFleetChart();
    renderResponseChart();
    renderScene();
    renderValue();
  }
  function renderFleetChart() {
    // One scale across every setting so neighbourhood size remains visible.
    // Bounds cover even simultaneous maximum EV, heating and battery power.
    const max = 3000, min = -500;
    const ticks = [-500, 0, 500, 1000, 1500, 2000, 2500, 3000];
    const c = chartFrame($('fleet-chart'), 265, max, min, [fleet.eventStart, fleet.eventEnd], ticks);
    const actual = stepPath(fleet.rows.map(r => r.actual), c.x, c.y);
    const t = fleet.rows[state.time].t;
    $('fleet-chart').innerHTML = `<svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true">${c.eventSvg}${c.grid}${min < 0 ? `<line x1="${c.left}" x2="${c.right}" y1="${c.y(0)}" y2="${c.y(0)}" stroke="#a3ae9b"/>` : ''}<path d="${actual}L${c.x(36)},${c.y(0)}L${c.x(12)},${c.y(0)}Z" fill="#b6c9aa" opacity=".3"/><path d="${stepPath(fleet.rows.map(r => r.baseline), c.x, c.y)}" class="chart-line" stroke="#9a9e90" stroke-width="1.8" stroke-dasharray="5 5"/><path d="${actual}" class="chart-line" stroke="#32664e" stroke-width="2.2"/><line x1="${c.x(t)}" x2="${c.x(t)}" y1="${c.top}" y2="${c.bottom}" stroke="#ce7055" stroke-width="1"/><circle cx="${c.x(t)}" cy="${c.y(fleet.rows[state.time].actual)}" r="4" fill="#ce7055" stroke="#fcfbf7" stroke-width="2"/><text class="chart-unit" x="${c.left}" y="13">${min < 0 ? 'FIXED SCALE · kW · NEGATIVE = NET EXPORT' : 'SCRUB THE DAY USING THE CONTROL ABOVE'}</text></svg>`;
    $('fleet-chart').setAttribute('aria-label', `Neighbourhood grid demand. Average event response ${number(fleet.eventAverage)} kilowatts. Delivery within 5 percent of the request for ${Math.round(fleet.intervalsOnTarget / fleet.eventIntervals * 100)} percent of event. Post-event peak ${number(fleet.peakAfter)} kilowatts.`);
  }
  function selectDispatch(mode) {
    state.dispatch = mode;
    document.querySelectorAll('[data-dispatch]').forEach(b => {
      const active = b.dataset.dispatch === mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active);
    });
    put('dispatch-description', mode === 'follow' ? 'Eligible cohorts join during the on-ramp. The model then adjusts heating, charging and storage to follow the requested profile; batteries fill gaps as other flexibility runs out.' : 'Each cohort activates its maximum available flexibility when it joins. Staging the start can soften the initial burst, but does not by itself make delivery follow the requested profile.');
  }
  function renderResponseChart() {
    const rows = fleet.rows.filter(r => r.inEvent);
    const rangeMax = value('response-scale');
    const ticks = rangeMax === 200 ? [0, 40, 80, 120, 160, 200] : rangeMax === 500 ? [0, 100, 200, 300, 400, 500] : [0, 500, 1000, 1500, 2000];
    const c = chartFrame($('response-chart'), 295, rangeMax, 0, null, ticks, [fleet.eventStart, fleet.eventEnd]);
    const peakResponse = Math.max(...rows.map(r => r.response));
    $('response-scale-note').hidden = Math.max(peakResponse, value('target')) <= rangeMax + 1e-6;
    put('response-scale-message', `${peakResponse > rangeMax ? `Peak delivery is ${number(peakResponse)} kW` : `Requested power is ${number(value('target'))} kW`}, above the selected view. The plot is clipped at ${number(rangeMax)} kW.`);
    const layers = [
      { key: 'heatResponse', colour: '#bea66d', readout: 'heat-response' },
      { key: 'evResponse', colour: '#ce9275', readout: 'ev-response' },
      { key: 'batteryResponse', colour: '#5d8063', readout: 'battery-response' }
    ];
    const lower = rows.map(() => 0);
    let areas = '';
    for (const layer of layers) {
      const upper = rows.map((r, i) => lower[i] + Math.max(0, r[layer.key]));
      const points = [];
      rows.forEach((r, i) => { points.push([c.x(r.t), c.y(upper[i])], [c.x(r.t + M.DT), c.y(upper[i])]); });
      for (let i = rows.length - 1; i >= 0; i--) points.push([c.x(rows[i].t + M.DT), c.y(lower[i])], [c.x(rows[i].t), c.y(lower[i])]);
      areas += `<path d="M${points.map(p => p.join(',')).join('L')}Z" fill="${layer.colour}" opacity=".82"/>`;
      upper.forEach((v, i) => { lower[i] = v; });
    }
    let requestedPath = `M${c.x(rows[0].t)},${c.y(rows[0].requested)}`;
    rows.forEach((r, i) => { if (i) requestedPath += `V${c.y(r.requested)}`; requestedPath += `H${c.x(r.t + M.DT)}`; });
    let delivered = `M${c.x(rows[0].t)},${c.y(rows[0].response)}`;
    rows.forEach((r, i) => { if (i) delivered += `V${c.y(r.response)}`; delivered += `H${c.x(r.t + M.DT)}`; });
    const row = fleet.rows[state.time];
    const target = value('target');
    const cursor = row.inEvent ? `<line x1="${c.x(row.t)}" x2="${c.x(row.t)}" y1="${c.top}" y2="${c.bottom}" stroke="#253d34" opacity=".45"/><circle cx="${c.x(row.t)}" cy="${c.y(row.response)}" r="4" fill="#253d34" stroke="#fcfbf7" stroke-width="1.5"/>` : '';
    $('response-chart').innerHTML = `<svg viewBox="0 0 ${c.width} ${c.height}" aria-hidden="true">${c.grid}<defs><clipPath id="response-plot-clip"><rect x="${c.left}" y="${c.top}" width="${c.right - c.left}" height="${c.bottom - c.top}"/></clipPath></defs><g clip-path="url(#response-plot-clip)">${areas}<path d="${delivered}" class="chart-line" stroke="#253d34" stroke-width="2"/><path d="${requestedPath}" fill="none" stroke="#a75c45" stroke-width="2" stroke-dasharray="6 4"/>${cursor}</g><text class="chart-unit" x="${c.left}" y="13">${state.scenario === 'solar' ? 'EXTRA DEMAND DURING THE EVENT' : 'REDUCTION IN GRID DEMAND'}</text></svg>`;
    $('response-chart').setAttribute('aria-label', `${state.dispatch === 'follow' ? 'Following the request' : 'Activating everything'}. Requested profile ramps to ${target} kilowatts over ${fleet.onramp} minutes. Average delivered ${number(fleet.eventAverage)} kilowatts. On target within 5 percent for ${number(fleet.intervalsOnTarget * M.DT)} of ${value('duration')} hours. Stacked layers show heating, EV charging and batteries. Selected vertical scale stays fixed from zero to ${rangeMax} kilowatts.${Math.max(peakResponse, target) > rangeMax ? " The request or delivery exceeds this view; select the full range." : ""}`);
    layers.forEach(layer => { $(layer.readout).innerHTML = row.inEvent ? `${number(Math.max(0, row[layer.key]))} <small>kW</small>` : '—'; });
    const startIndex = Math.round((fleet.eventStart - 12) / M.DT);
    $('response-time').max = rows.length - 1;
    $('response-time').value = M.clamp(state.time - startIndex, 0, rows.length - 1);
    $('response-time').setAttribute('aria-valuetext', row.inEvent ? time(row.t) : 'Outside the event; move to explore event delivery');
    put('response-time-out', row.inEvent ? time(row.t) : 'Outside the event');
    put('response-start', time(fleet.eventStart));
    put('response-end', `${time(fleet.eventEnd)} · event ends`);
    if (!row.inEvent) {
      put('response-observation', 'The day cursor is outside the event. Use this event slider to inspect each resource’s contribution, or the neighbourhood timeline above to follow the full day.');
      return;
    }
    const intervalTarget = row.requested;
    const difference = row.response - intervalTarget;
    const status = Math.abs(difference) <= intervalTarget * 0.05 + 1e-6 ? 'Within 5% of the request.' : difference < 0 ? `${number(-difference)} kW below the request: available resources cannot deliver the full response.` : `${number(difference)} kW above the request: a large response is not the same as following the requested power.`;
    const physicalState = `${row.roomTemperature === null ? 'No heat pumps enrolled.' : `Average room temperature ${number(row.roomTemperature)}°C.`} ${row.batteryCharge === null ? 'No batteries enrolled.' : `Average battery charge ${number(row.batteryCharge)}%.`}`;
    put('response-observation', `During ${time(row.t)}–${time(row.t + M.DT)}, ${number(row.response)} kW is delivered against the ${number(intervalTarget)} kW request for this interval. ${status} ${row.activeHeat} heat pumps, ${row.activeEV} chargers and ${row.activeBattery} batteries have joined the event. At interval end: ${physicalState}`);
  }
  function renderScene() {
    const row = fleet.rows[state.time];
    put('fleet-clock', time(row.t));
    put('fleet-time-out', time(row.t));
    $('fleet-time').setAttribute('aria-valuetext', `${time(row.t)}${row.t >= 24 ? ' tomorrow' : ' today'}`);
    put('event-state', row.inEvent ? 'GRID EVENT' : row.t >= fleet.eventEnd ? 'AFTER THE EVENT' : 'BEFORE THE EVENT');
    $('event-state').classList.toggle('idle', !row.inEvent);
    const enrolled = Math.round(12 * value('participation') / 100);
    let lines = '', houses = '';
    for (let i = 0; i < 12; i++) {
      const col = i % 4, r = Math.floor(i / 4);
      const x = 89 + col * 120 + r * 8;
      const y = 64 + r * 85;
      if (i < enrolled) lines += `<path d="M${x} ${y + 24}V${y + 40}H280V280" fill="none" stroke="${row.inEvent ? '#78966c' : '#becbb2'}" stroke-width="1" stroke-dasharray="3 4"/>`;
      houses += house(x, y, .67, i < enrolled, i);
    }
    $('fleet-scene').innerHTML = `<path d="M35 91H525M35 176H525M35 261H525" stroke="#dce2d2" stroke-width="17"/>${lines}${houses}${tree(35, 224, .65)}${tree(518, 82, .6)}<g transform="translate(280 289)"><rect x="-65" y="-13" width="130" height="28" rx="3" fill="${row.inEvent ? '#345d46' : '#708469'}"/><text text-anchor="middle" y="5" fill="#f3f4e9" font-family="sans-serif" font-size="9" letter-spacing="1">VPP COORDINATOR</text></g>`;
    $('fleet-scene').setAttribute('aria-label', `Twelve representative homes; ${enrolled} shown enrolled. ${row.inEvent ? 'Event active' : 'No active event'} at ${time(row.t)}. These icons represent ${value('homes')} homes.`);
  }
  function renderValue() {
    const peak = value('peak-rate'), offpeak = value('offpeak-rate'), reward = value('reward-rate');
    put('peak-rate-out', `${peak}p/kWh`);
    put('offpeak-rate-out', `${offpeak}p/kWh`);
    put('reward-rate-out', `${reward}p/kWh`);
    put('peak-cost', money(14 * peak / 100));
    put('offpeak-cost', money(14 * offpeak / 100));
    const saving = 14 * (peak - offpeak) / 100;
    put('tariff-saving', saving >= 0 ? `${money(saving)} less for this charge.` : `${money(-saving)} more: this “off-peak” rate is higher.`);
    const energy = Math.max(0, fleet.responseEnergy);
    $('reward-energy').innerHTML = `${number(energy)} <small>kWh</small>`;
    $('reward-rate-display').innerHTML = `${reward}<small>p/kWh</small>`;
    put('reward-total', money(energy * reward / 100));
  }
  function stopPlayback() {
    state.playing = false;
    $('play-event').textContent = '▶';
    $('play-event').setAttribute('aria-label', 'Play the day');
  }
  function bindTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(trigger => {
      const bubble = $(trigger.dataset.tooltip);
      let pinned = false, closeTimer;
      const close = () => { window.clearTimeout(closeTimer); bubble.hidden = true; pinned = false; trigger.setAttribute('aria-expanded', 'false'); };
      const show = () => {
        window.clearTimeout(closeTimer);
        bubble.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const r = trigger.getBoundingClientRect();
        const width = bubble.offsetWidth;
        const height = bubble.offsetHeight;
        bubble.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, r.left + r.width / 2 - width / 2))}px`;
        bubble.style.top = `${Math.max(12, r.bottom + height + 12 < window.innerHeight ? r.bottom + 9 : r.top - height - 9)}px`;
      };
      const scheduleClose = () => { if (!pinned && document.activeElement !== trigger) closeTimer = window.setTimeout(close, 150); };
      trigger.addEventListener('mouseenter', show);
      trigger.addEventListener('mouseleave', scheduleClose);
      bubble.addEventListener('mouseenter', show);
      bubble.addEventListener('mouseleave', scheduleClose);
      trigger.addEventListener('focus', show);
      trigger.addEventListener('blur', close);
      trigger.addEventListener('click', () => { if (pinned) close(); else { pinned = true; show(); } });
      document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
      document.addEventListener('pointerdown', event => { if (event.target !== trigger && !bubble.contains(event.target)) close(); });
      window.addEventListener('scroll', close, { passive: true });
      window.addEventListener('resize', close);
    });
  }
  function bindChapterNavigation() {
    const links=Array.from(document.querySelectorAll('[data-chapter]'));
    const nav=$('chapter-links'), header=$('chapter-nav');
    const chapters=links.map(link=>({link,section:$(link.dataset.chapter)}));
    let current=null, pending=false;
    function update() {
      pending=false;
      const boundary=header.getBoundingClientRect().height+48;
      let active=null;
      for(const chapter of chapters)if(chapter.section.getBoundingClientRect().top<=boundary)active=chapter.link;
      if(active===current)return;
      current=active;
      links.forEach(link=>{
        link.classList.toggle('is-active',link===active);
        if(link===active)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
      if(active) {
        const item=active.getBoundingClientRect(),container=nav.getBoundingClientRect();
        if(item.left<container.left || item.right>container.right)nav.scrollTo({left:nav.scrollLeft+item.left-container.left-(container.width-item.width)/2,behavior:'auto'});
      }
    }
    function schedule() {if(!pending){pending=true;window.requestAnimationFrame(update);}}
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    window.addEventListener('hashchange',schedule);
    window.addEventListener('pageshow',schedule);
    update();
  }
  function bind() {
    $('abundance-shift').addEventListener('input',renderAbundance);
    ['charging-homes','charging-share','charging-limit'].forEach(id=>$(id).addEventListener('input',renderNeighbourhoodCharging));
    document.querySelectorAll('[data-charging-mode]').forEach(button=>button.addEventListener('click',()=>{state.chargingMode=button.dataset.chargingMode;document.querySelectorAll('[data-charging-mode]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',b===button);});renderNeighbourhoodCharging();}));
    document.querySelectorAll('[name="onramp"]').forEach(input => input.addEventListener('change', () => renderFleet()));
    ['charge-start', 'departure', 'charge-duration'].forEach(id => $(id).addEventListener('input', renderEV));
    $('reset-ev').addEventListener('click', () => { $('charge-duration').value = 2; $('departure').value = 31; $('charge-start').max = 29; $('charge-start').value = 18; state.weather = 'windy'; document.querySelectorAll('[data-weather]').forEach(b => { b.classList.toggle('active', b.dataset.weather === state.weather); b.setAttribute('aria-pressed', b.dataset.weather === state.weather); }); renderEV(); });
    [['find-cheapest','cost'],['find-renewable','renewables']].forEach(([id,objective])=>$(id).addEventListener('click',()=>{
      const best=M.bestHouseholdSchedule(value('departure'),state.weather,objective);
      $('charge-duration').value=best.duration;
      $('charge-start').max=value('departure')-best.duration;
      $('charge-start').value=best.start;
      renderEV();
    }));
    document.querySelectorAll('[data-weather]').forEach(button => button.addEventListener('click', () => {
      state.weather = button.dataset.weather;
      document.querySelectorAll('[data-weather]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
      renderHousehold();
    }));
    ['reserve', 'comfort'].forEach(id => $(id).addEventListener('input', () => { renderDevices(); renderFleet(); }));
    ['homes', 'participation', 'duration', 'target'].forEach(id => $(id).addEventListener('input', () => renderFleet()));
    $('coordinated').addEventListener('change', () => renderFleet());
    document.querySelectorAll('[data-dispatch]').forEach(button => button.addEventListener('click', () => { selectDispatch(button.dataset.dispatch); renderFleet(); }));
    $('try-long-event').addEventListener('click', () => {
      $('duration').value = 4;
      setOnramp(60);
      selectDispatch('follow');
      state.time = Math.round((fleet.eventStart - 12) / M.DT);
      $('fleet-time').value = state.time;
      stopPlayback();
      renderFleet();
    });
    $('response-scale').addEventListener('change', renderResponseChart);
    $('response-expand').addEventListener('click', () => { $('response-scale').value = 2000; renderResponseChart(); });
    $('response-time').addEventListener('input', () => {
      stopPlayback();
      state.time = Math.round((fleet.eventStart - 12) / M.DT) + value('response-time');
      $('fleet-time').value = state.time;
      renderFleetChart(); renderResponseChart(); renderScene();
    });
    document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => {
      state.scenario = button.dataset.scenario;
      state.time = state.scenario === 'solar' ? 4 : 24;
      $('fleet-time').value = state.time;
      document.querySelectorAll('[data-scenario]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
      stopPlayback();
      renderFleet();
    }));
    $('reset-fleet').addEventListener('click', () => {
      const defaults = { homes: 120, participation: 70, reserve: 30, comfort: 19, duration: 2, target: 80 };
      Object.keys(defaults).forEach(id => { $(id).value = defaults[id]; });
      $('coordinated').checked = true;
      selectDispatch('follow');
      setOnramp(30);
      $('response-scale').value = 500;
      document.querySelector('[data-scenario="evening"]').click();
      renderDevices();
    });
    $('fleet-time').addEventListener('input', () => { stopPlayback(); state.time = value('fleet-time'); renderFleetChart(); renderResponseChart(); renderScene(); });
    $('play-event').addEventListener('click', () => {
      if (state.playing) { stopPlayback(); return; }
      if (state.time >= 95) state.time = 0;
      state.playing = true;
      $('play-event').textContent = 'Ⅱ';
      $('play-event').setAttribute('aria-label', 'Pause the day');
    });
    ['peak-rate', 'offpeak-rate', 'reward-rate'].forEach(id => $(id).addEventListener('input', renderValue));
    window.addEventListener('pageshow', () => {
      state.time = M.clamp(value('fleet-time'), 0, 95);
      selectDispatch(state.dispatch);
      renderPeak(); renderEV(); renderAbundance(); renderNeighbourhoodCharging(); renderDevices(); renderFleet();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); });
    window.setInterval(() => {
      if (!state.playing) return;
      if (state.time >= 95) { stopPlayback(); return; }
      state.time++;
      $('fleet-time').value = state.time;
      renderFleetChart(); renderResponseChart(); renderScene();
    }, 220);
    let resizeTimer;
    window.addEventListener('resize', () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { renderPeak(); renderEV(); renderAbundance(); renderNeighbourhoodCharging(); renderFleetChart(); renderResponseChart(); }, 100); });
  }
  heroArt();
  renderPeak();
  selectDispatch('follow');
  renderEV();
  renderDevices();
  renderAbundance();
  renderNeighbourhoodCharging();
  renderFleet();
  bind();
  bindTooltips();
  bindChapterNavigation();
})();
