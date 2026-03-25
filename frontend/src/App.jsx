import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./components/header.jsx";

export default function App() {
  const [telemetryComponents, setTelemetryComponents] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const scheduleLoad =
      typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback
        : (callback) => window.setTimeout(callback, 1200);

    const cancelScheduledLoad =
      typeof window !== "undefined" && typeof window.cancelIdleCallback === "function"
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const handle = scheduleLoad(async () => {
      try {
        const [{ SpeedInsights }, { Analytics }] = await Promise.all([
          import("@vercel/speed-insights/react"),
          import("@vercel/analytics/react"),
        ]);

        if (!cancelled) {
          setTelemetryComponents({ SpeedInsights, Analytics });
        }
      } catch {
        // Skip telemetry rendering if module load fails.
      }
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad(handle);
    };
  }, []);

  const SpeedInsights = telemetryComponents?.SpeedInsights;
  const Analytics = telemetryComponents?.Analytics;

  return (
    <div className="app-root">
      <Header />
      <main className="page-container">
        <Outlet />
      </main>
      {SpeedInsights && Analytics && (
        <>
          <SpeedInsights />
          <Analytics />
        </>
      )}
    </div>
  );
}