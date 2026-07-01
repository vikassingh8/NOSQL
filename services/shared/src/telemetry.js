// Azure Application Insights bootstrap.
//
// No-op unless APPLICATIONINSIGHTS_CONNECTION_STRING is set, so local dev and tests are
// unaffected. In Azure the connection string is injected from Key Vault / Terraform
// output `app_insights_connection_string`. Call initTelemetry() once at service startup,
// as early as possible, so auto-collection (HTTP, deps, logs) is wired up.
let started = false;

export async function initTelemetry(serviceName) {
  if (started) return;
  const conn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!conn) return; // not configured — skip silently

  try {
    const appInsights = (await import('applicationinsights')).default;
    appInsights
      .setup(conn)
      .setAutoCollectRequests(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectExceptions(true)
      .setSendLiveMetrics(true);
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] =
      serviceName;
    appInsights.start();
    started = true;
    console.log(`[telemetry] Application Insights enabled for ${serviceName}`);
  } catch (err) {
    // Never let observability wiring take down the service.
    console.error('[telemetry] failed to start Application Insights:', err.message);
  }
}

export default { initTelemetry };
