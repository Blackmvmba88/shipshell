import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AnnotationDock } from "./AnnotationDock";
import "./styles.css";
import "./integration-tokens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <AnnotationDock />
  </StrictMode>,
);
