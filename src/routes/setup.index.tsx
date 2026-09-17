import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/setup/")({
  component: () => <Navigate to="/setup/system-check" />,
});
