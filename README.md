# Levelgrid Enterprises Financial Records

Levelgrid Finance is a planned private Android PWA for recording daily sales and expenses in ZMW, viewing balances and generating PDF reports.

Feature 01 provides the one-page application shell and offline startup. The [progress tracker](PROGRESS.md) records verification and acceptance.

| File | Contents |
| --- | --- |
| [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) | Business requirements, architecture and acceptance conditions |
| [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) | Feature sequence, design reference and acceptance checks |
| [AGENTS.md](AGENTS.md) | Contributor instructions and implementation rules |
| [PROGRESS.md](PROGRESS.md) | Decision log and current feature status |

## Build the application

Use Node.js 22 or newer.

```sh
npm ci
npm run typecheck
npm run build
```

Deploy the `out/` directory on static HTTPS hosting. For a Vercel preview, set the framework preset to **Other**, the build command to `npm run build`, and the output directory to `out`.

To serve the production build on the build computer, run `python3 -m http.server 4173 --bind 127.0.0.1 --directory out` and open [localhost port 4173](http://127.0.0.1:4173/).

## Check Feature 01 on Android

1. Open the HTTPS preview in Chrome and wait for **Ready offline** in the app footer.
2. Open Chrome's menu and select **Install app** or **Add to Home screen**. Launch the app from the home screen.
3. Select a reporting month. Open and close **Enter Daily Sales**, **PDF Reports**, **Departments**, and **More** from the main page.
4. Turn off Wi-Fi and mobile data. Close the app, then reopen it from the home screen. Check that the main page and panels open and the footer shows **Offline**.
