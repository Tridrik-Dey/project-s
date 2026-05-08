import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { BrowserValidationI18n } from "./i18n/BrowserValidationI18n";
import { I18nProvider } from "./i18n/I18nContext";
import { AppRouter } from "./router/AppRouter";
import "./index.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <BrowserValidationI18n />
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
