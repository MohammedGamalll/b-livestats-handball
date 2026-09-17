import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/players")({
  component: PlayersLayout,
});

function PlayersLayout() {
  return <Outlet />;
}