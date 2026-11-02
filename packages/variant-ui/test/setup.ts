import { GlobalRegistrator } from "@happy-dom/global-registrator";

// AIDEV-NOTE: a DOM for component tests; must be registered before @testing-library/react is imported.
GlobalRegistrator.register({ url: "http://localhost/" });
