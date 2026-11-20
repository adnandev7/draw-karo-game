// Draw Karo keepalive — keeps the free Render server out of cold start.
//
// Why not GitHub Actions: scheduled workflows are best-effort and get delayed
// or skipped under load; a skipped */10 run let the service sleep. Apps Script
// time-driven triggers are managed by Google and fire every 5 minutes.
//
// Setup (no new account, no card — the same Google account that owns nothing
// else here):
//   1. script.google.com → New project → paste this file into Code.gs
//   2. Rename the project to `draw-karo-keepalive`
//   3. Run `ping` once → Google asks for permission to call the URL (Allow)
//   4. Triggers (clock icon) → Add Trigger
//        function       ping
//        deployment     Head
//        event source   Time-driven
//        type           Minutes timer
//        interval       Every 5 minutes
//   5. Save. Check Triggers → "Last run" after 5 minutes.
//
// Change URL if you redeploy the server somewhere else.
const URL = 'https://draw-karo-server.onrender.com/health';

function ping() {
  const res = UrlFetchApp.fetch(URL, { muteHttpExceptions: true });
  console.log(res.getResponseCode());
}
