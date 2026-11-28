using Workerd = import "/workerd/workerd.capnp";
# run.mjs injects ephemeral synthetic keys; no live credentials or providers are used.
const config :Workerd.Config = (
  services = [(name = "push-compat", worker = (
    bindings = [
      (name = "REMINDERS", durableObjectNamespace = "GapReminder"),
      (name = "VAPID_SUBJECT", text = "mailto:test@example.com"),
      (name = "VAPID_PRIVATE_JWK", fromEnvironment = "FUEL_TEST_VAPID_PRIVATE_JWK"),
      (name = "VAPID_PUBLIC_KEY", fromEnvironment = "FUEL_TEST_VAPID_PUBLIC_KEY"),
      (name = "PAIRING_KEY", fromEnvironment = "FUEL_TEST_PAIRING_KEY"),
      (name = "APP_ORIGIN", text = "https://app.example"),
    ],
    durableObjectNamespaces = [(className = "GapReminder", uniqueKey = "fuel-gap-test", enableSql = true)],
    durableObjectStorage = (localDisk = "test-alarm-data"),
    globalOutbound = "fake-provider",
    compatibilityDate = "2026-11-01",
    modules = [
      (name = "push.mjs", esModule = embed "push.mjs"),
      (name = "worker.js", esModule = embed "../worker.js"),
    ],
  )), (name = "fake-provider", worker = (
    compatibilityDate = "2026-11-01",
    modules = [(name = "provider.mjs", esModule = embed "provider.mjs")],
  )), (name = "test-alarm-data", disk = (path = ".", writable = true))],
);
