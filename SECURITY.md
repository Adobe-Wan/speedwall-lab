# Security

Speedwall Lab is a static web page served by GitHub Pages. It has no accounts, no server and no analytics. It loads nothing from other sites: a Content-Security-Policy in `site/index.html` limits scripts, styles, images and fetches to the site itself, and the browser smoke tests (`pnpm test:e2e`) fail if the page tries to reach anywhere else.

What it stores: your control settings and view choices, in your browser's local storage, on your device only. Nothing is sent anywhere. The **Send Feedback** button opens a GitHub issue form; only what you type there is shared, publicly.

## Reporting a problem

Please report security problems privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Don't open a public issue for them.

Include what you found, the steps to reproduce it, and the browser you used.

## Flight-test harness

`tools/sc-flighttest` drives Star Citizen through a virtual joystick on the author's own PC. It is never part of the web page, and it is only ever run in Arena Commander with the author present.
