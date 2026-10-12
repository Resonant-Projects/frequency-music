import { resolve } from "node:path";

export function routeOfflineWebSocket(ws, info, external, backendBlocked) {
  const url = new URL(ws.url());
  if (url.hostname === "127.0.0.1" && url.port === "9") {
    backendBlocked.push(ws.url());
    ws.close(); // Never forward even if port 9 hosts a tunnel or live backend.
  } else if (url.hostname === "127.0.0.1" && url.port === String(info.port)) {
    ws.connectToServer();
  } else {
    external.push(ws.url());
    ws.close();
  }
}

export async function enterEssays(page, nav, base, expect, mobile = false) {
  const trigger = nav.getByRole("button", {
    name: mobile ? "Open navigation menu" : "Library",
    exact: true,
  });
  await trigger.click();
  const link = nav.getByRole("link", { name: /^Essays/ });
  await expect(link).toHaveAttribute("href", "/essays");
  await link.click();
  await expect(page).toHaveURL(`${base}/essays`);
  await expect(nav.locator(".app-menu-panel:visible")).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

export async function finishRun({
  context,
  browser,
  out,
  feature,
  result,
  error,
  writeResult,
}) {
  let failure = error;
  try {
    if (context)
      await context.tracing.stop({
        path: resolve(out, `${feature}-trace.zip`),
      });
  } catch (caught) {
    failure = failure || caught;
  } finally {
    try {
      if (browser) await browser.close();
    } catch (caught) {
      failure = failure || caught;
    }
  }
  const completed = failure
    ? { ...result, status: "fail", feature, error: String(failure) }
    : result;
  writeResult(completed); // A pass is impossible before trace AND browser teardown.
  return { completed, failure };
}
