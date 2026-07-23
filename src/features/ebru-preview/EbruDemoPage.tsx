import EbruPreviewPage from "./EbruPreviewPage";

// Temporary, authenticated visual-review entrypoint. Demo-only routing and
// historical fixtures are enabled explicitly and never reach canonical pages.
export default function EbruDemoPage() {
  return <EbruPreviewPage demoMode />;
}
