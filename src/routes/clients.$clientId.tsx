import { createFileRoute, Outlet } from "@tanstack/react-router";

// Parent layout for a single client. Nested call sessions
// (/clients/$clientId/call/$callId) mount inside <Outlet /> below.
export const Route = createFileRoute("/clients/$clientId")({
  head: () => ({
    meta: [
      { title: "Client — LSP Onboarding Tracker" },
      { name: "description", content: "Client onboarding calls, checklist and history." },
    ],
  }),
  component: () => <Outlet />,
});
