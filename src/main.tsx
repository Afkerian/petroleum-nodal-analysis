import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./lib/i18n";
import { FluidProvider } from "./lib/fluid";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <FluidProvider>
        <App />
      </FluidProvider>
    </I18nProvider>
  </React.StrictMode>
);
