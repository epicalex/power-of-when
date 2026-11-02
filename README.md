# The power of when

A standalone interactive essay about electricity flexibility and virtual power plants. Plain HTML, CSS and JavaScript. No package install, framework, build step, CDN, analytics or API keys.

## Run locally

**Easiest:** double-click `index.html`. All experiments work directly from a local file, including without an internet connection. External source links require internet access.

**Optional local server:** open a terminal in this folder and run:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000>. Stop the server with Ctrl+C. This requires Python 3; opening the file directly does not.

## Publish to GitHub Pages

1. Create a GitHub repository and upload the **contents of this folder** to its root. `index.html` must be at the publishing root.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. GitHub will show the published address when deployment completes. For a project repository, it is normally `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The included `.nojekyll` file tells GitHub to serve these static files without Jekyll processing. If uploading via the browser, make sure to include this hidden file; this particular page also works without it.

There is no automated deployment workflow to configure. A branch deployment is sufficient. GitHub Pages can be enabled separately after the repository is connected.

## Sync with GitHub

This folder is the Git repository and contains the website at its root. Generated previews and download archives live outside it.

Once an empty GitHub repository has been created, connect it and upload the initial commit:

```sh
git remote add origin https://github.com/epicalex/power-of-when.git
git push -u origin main
```

Use the actual repository URL if you choose a different name. Git will use your configured GitHub authentication.

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

The journey begins with an illustrative peak-demand and peaker dispatch example, then introduces existing resources, household flexibility, the coordinated VPP, value and the proposed Huels test. The simulation runs from noon to noon at 15-minute resolution. Demand, weather, equipment ownership and rates are **illustrative assumptions**, not measured data or financial forecasts. The essay includes expandable notes explaining the model and linking to sources.

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
