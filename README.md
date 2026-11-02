# The power of when

A standalone interactive essay about electricity flexibility and virtual power plants. Plain HTML, CSS and JavaScript. No package install, framework, build step, CDN, analytics or API keys.

## Run locally

**Easiest:** double-click `index.html`. All experiments work directly from a local file, including without an internet connection. External source links require internet access.

**Optional local server:** open a terminal in this folder and run:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Stop the server with Ctrl+C. This requires Python 3; opening the file directly does not.

## Live site and GitHub sync

- Live site: https://epicalex.github.io/power-of-when/
- Repository: https://github.com/epicalex/power-of-when

GitHub Pages publishes the root of `main`. Every push to `main` automatically updates the live site after GitHub's deployment completes. The included `.nojekyll` file serves the static files without Jekyll processing; no build or package install is needed.

This folder is the Git repository and contains the website at its root. Generated previews and download archives live outside it.

For subsequent changes, review and save a snapshot before uploading:

```sh
git diff
git add index.html styles.css app.js model.js README.md tests .gitignore .nojekyll
git commit -m "Describe the change"
git push
```

GitHub sync is explicit; local edits are uploaded when pushed. Pull remote changes before starting work on another computer.

## Add it to your portfolio later

Copy `index.html`, `styles.css`, `model.js` and `app.js` into any portfolio subdirectory, for example `/projects/power-of-when/`. All internal asset links are relative, so no code changes are required. The page has no root-relative routes or runtime dependencies.

To give the entire GitHub Pages site a custom domain, configure **Settings → Pages → Custom domain**, then follow GitHub's DNS instructions for your domain provider. The correct records depend on whether you use an apex domain or a subdomain. A custom domain does not mount this page inside another site's path; for a portfolio path, copy the files into that site's hosting source instead. HTTPS can be enabled once domain verification and certificate provisioning complete.

Official hosting references:

- [Publishing from a branch](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

## Change the page

| File | Purpose |
| --- | --- |
| `index.html` | Essay, sources, controls and assumptions |
| `styles.css` | Responsive layout, typography and colours |
| `model.js` | Pure, deterministic 15-minute simulation |
| `app.js` | Interaction, SVG illustrations and charts |
| `tests/model.test.cjs` | Energy accounting and model boundary checks |

The model is exposed as `window.FlexModel`, with CommonJS support for optional tests. Classic scripts are intentional: browser modules would require a server when running from local files.

To run the optional model tests with Node.js installed:

```sh
node --test tests/model.test.cjs
```

There is no runtime dependency on Node.js.

## What the model represents

The journey begins with an illustrative peak-demand and peaker dispatch example, then introduces household demand shifting, the Demand Flexibility Service, automation of existing resources, the coordinated VPP, value and the proposed Huels test. The simulation runs from noon to noon at 15-minute resolution. Demand, weather, equipment ownership and rates are **illustrative assumptions**, not measured data or financial forecasts. The essay includes expandable notes explaining the model and linking to sources.

- EVs receive 14 kWh by 07:00 using a 7 kW charger. They do not export.
- Home batteries have 10 kWh capacity, initially at 80%, user-selected reserve, 3 kW event power, 2 kW recovery power, and 95% charge/discharge efficiency each way. They recover their initial charge by the end of the day.
- Heating uses a simplified one-room thermal model with bounded temperature and constant COP. A solar event can preheat to 21°C. An evening event respects the chosen minimum temperature. Thermal losses mean heating energy is not necessarily conserved when its timing changes.
- Two dispatch strategies can be compared. **Activate everything** uses all available event flexibility. **Follow the request** reallocates power every 15 minutes using ideal current device states: heating first, then EV charging, then batteries for the remaining gap. This is a simple educational priority rule, not cost-optimal dispatch or a real market controller.
- The stacked response chart reconciles heating, EV and battery contributions to the actual change in net grid demand. Its vertical scale stays fixed as settings change. An explicit range selector offers 0–200 kW close-up, 0–500 kW detail and 0–2,000 kW full-range views. If delivery exceeds the selected view, a clipping notice offers the full range. The existing whole-day demand chart remains fixed at −500–3,000 kW, so changing the number of homes does not rescale it.
- **On target** means within ±5% of the requested power in a 15-minute interval. Both too little and too much response fall outside this teaching band. This tolerance is invented for the demonstration, not a grid-service qualification rule.
- A separate on-ramp radio group makes devices eligible in two cohorts over 30 minutes or four over 60 minutes. The requested profile rises by the corresponding fraction at each 15-minute interval. This is a stepped illustration, not a continuous or second-by-second ramp. On-target scoring follows the interval's requested power rather than the final full target.
- Solar is explicit in the whole-day net-demand curves: 40% of homes have a 3 kW rooftop array, using an invented daylight profile scaled to 40% on the cold day. The same output is subtracted from baseline and actual demand; it is zero at night and is not counted as a commanded event response.
- The event timeline and full-day timeline share a cursor. The four-hour example demonstrates the handover from heating and EV charging to batteries. After the event, deferred EV charging and battery state recover; the recovery toggle applies to both strategies.
- Device states are known perfectly. There is no communication latency, forecast uncertainty, network power flow, or second-by-second controller. EV power can modulate continuously between zero and 7 kW, ignoring minimum charging currents and switching constraints.
- Event reward examples use net event response energy and an invented reward rate. They exclude costs, fees and real settlement rules. They are separate from the independent tariff comparison.

Real VPP operation also involves consent, telemetry, forecasting, communication failures, estimated baselines, local network constraints, market eligibility and settlement. These are discussed in the text but are not simulated. The response comparison was informed by [Volts’ January 2026 conversation with Seth Frader-Thompson](https://www.volts.wtf/p/lets-dig-a-little-deeper-into-virtual).

Accessibility features include keyboard-operable native inputs, source disclosures, visible focus indicators, semantic headings, a skip link, chart descriptions, manually started playback and reduced-motion styling.


## Historical programme evidence

A separate historical panel cites Octopus Energy's [Saving Sessions analysis, 8 June 2023](https://octoenergy-production-media.s3.amazonaws.com/documents/Consumer_flexibility_-_ready_to_replace_coal.pdf), covering winter 2022/23. The programme figures are attributed in the page and are not used to calibrate the simulation. The report's wider gigawatt estimates are extrapolations, not delivered capacity or proof of continuous power-station-equivalent availability.


## Huels test and maturity

The final learning chapter introduces the Huels test and EnergyHub's proposed five-level VPP maturity model. It is presented as a proposed operational benchmark, not certification or an industry-wide scoring system. Matching a simulated request does not demonstrate that a real VPP has passed it: the model has no real telemetry, forecast uncertainty, year-round availability assessment or operational grid-system integration. Source links are provided in the chapter.

## Demand shifting and DFS

The seven-part journey introduces demand shifting with the EV experiment, then explains Great Britain’s Demand Flexibility Service before introducing device automation and VPP coordination. DFS is a service, while a VPP is a way to aggregate and coordinate resources; they can overlap. The DFS chapter separates historical winter 2022–23 evidence from the year-round service and its April 2026 expansion to demand turn-up. The 300 MW line in the opening chart is a fixed limit on supply available without the peaker, not constant actual generation.

## Combined household charging experiment

The demand-shifting experiment uses one shared 0–10 kW chart. Grey shows other household use, pale blue adds EV charging, the solid blue line shows total demand, and the dotted grey line preserves the original 18:00 two-hour charging schedule. The dashed amber line is a made-up allocation of wider wind and solar generation, not rooftop output alone. Six weather scenarios demonstrate that peak shaving and matching renewable availability are different objectives.

Assume the car is available from noon until departure. The duration control spreads the same 14 kWh over 2–12 hours at constant power (14 / duration kW). All feasible schedules deliver 14 kWh; other household demand stays fixed. The start moves earlier when needed to fit the departure deadline. The demand-beyond-renewables metric integrates positive demand minus generation at 15-minute resolution, without banking unused renewable allocation. It is neither a bill nor an emissions calculation. Coral hatching marks demand above the renewable allocation, met by the rest of the system. Reset restores the original two-hour schedule and breezy weather. The gentle overnight example selects six hours from midnight in the overnight-wind scenario.

## Illustrative charging tariff

The combined household chart marks tariff boundaries at 16:00, 21:00, 00:00 and 06:00. The invented tariff is 10p/kWh from midnight to 06:00, 35p from 16:00 to 21:00 and 25p otherwise. Intervals include their start and exclude their end. EV and whole-house energy costs sum each 15-minute power interval times its rate. The fixed comparison is 14 kWh at 7 kW from 18:00–20:00 (£4.90). The six-hour midnight example costs £1.40 for the EV. Household energy totals cover noon to noon.

Weather affects renewable overlap, not the fixed retail tariff. All consumption is billed: the renewable allocation is not free on-site generation. No standing charges, exports or charging losses are included. The three scheduling sliders share a row above 620px and stack on narrower screens.

## Neighbourhood charging coordination

A separate comparison opens the VPP chapter: charging on arrival, a shared midnight start, and coordinated charging. Controls set 20–80 homes, 25–100% EV ownership and an illustrative 30–200 kW local capacity limit. All strategies share deterministic cars with 16:00–20:00 arrivals, 05:00–09:00 departures, 7–17.5 kWh requirements and 7 kW chargers. The chart stays at 0–700 kW. The first eight cars have availability and charging timelines.

The coordinated scheduler prioritises earlier departures, then allocates cheaper slots first and chooses less-loaded slots at equal prices, subject to each charger and available aggregate capacity. It is a simple greedy scheduling demonstration with perfect information, not a globally optimal controller or a power-flow model. Costs integrate the same illustrative time-of-use tariff. Household load is fixed; energy shortfalls and base-load capacity breaches are explicit. Unconstrained strategies show requested demand; scheduled readiness is not guaranteed physical delivery when demand exceeds capacity. This comparison is independent of the later grid-event simulation.

## Experiment 2 layout

The household experiment groups weather, tariff, legend and chart with the three scheduling sliders directly underneath. At widths of 700px and above, energy and cost metrics form one vertical results column on the right; narrower screens place results after the chart and controls. The redundant car illustration is removed. Longer explanations are available below the working area in an expandable note.

Repeated editorial caveats and technical notes are consolidated in the closing “A note on the models” section, with the detailed assumptions retained in one expandable panel. Explanatory chart labels and state-dependent charging shortfalls remain beside the experiments.

## Cost and renewable-match challenge

Experiment 2 compares each schedule with the original 18:00 two-hour charge using two visible goals: lower charging cost and less total household demand beyond the shown renewable allocation. “Lowest cost” and “Closest renewable match” search all valid start times and constant-power durations on the 15-minute control grid, preserving the current departure time, weather and 14 kWh requirement. Ties are broken using the other objective. This renewable-overlap measure is not an emissions estimate. These objective buttons replace the earlier overnight preset.

## Renewable matching percentage

The household challenge now requires at least 30% EV cost saving against the 18:00 two-hour charge and at least 90% of the EV’s 14 kWh matched to the shown renewable allocation. These are teaching targets. Progress bars show the actual percentages. Matching assigns renewable power to other household use first, then counts min(EV charging, max(generation − other household use, 0)) in each 15-minute interval. Unused allocation is not carried into later intervals. This is a timing match to an illustrative allocation, not an attribution of real electricity or a carbon calculation.

The opening peak-demand chart is now a static annotated example: 470 MW maximum demand, 300 MW available without the peaker, and a 170 MW gap. The former day slider and changing readouts are removed; a smooth curve preserves the model sample values.

The DFS chapter now includes a solar-abundance demonstration over 06:00–24:00. Its slider moves ten 14 kWh EV charges from 18:00–20:00 to 12:00–14:00 while holding total charging energy at 140 kWh. It reports extra solar used, unused solar and evening peak demand; no DFS payment is simulated. The historical Octopus panel uses a navy and pink visual treatment. A vehicle-to-grid tooltip explains compatible bidirectional equipment while preserving one-way EV assumptions in the models.
