import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { ClinicianLayout, Home } from "./pages/Clinician";
import { CasePage } from "./pages/Case";
import { RulesPage } from "./pages/Rules";
import { AthleteApp } from "./pages/Athlete";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/a/:code" element={<AthleteApp />} />
        <Route element={<ClinicianLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/c/:id" element={<CasePage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
