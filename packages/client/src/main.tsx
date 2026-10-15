import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";
import { AuthProvider, RequireRole } from "./lib/auth";
import { ClinicianLayout, Home } from "./pages/Clinician";
import { CasePage } from "./pages/Case";
import { RulesPage } from "./pages/Rules";
import { ProtocolsPage } from "./pages/Protocols";
import { ConsentFormPage } from "./pages/ConsentForm";
import { ConsentRecordPage } from "./pages/ConsentRecord";
import { ReportPage } from "./pages/Report";
import { AthleteApp } from "./pages/Athlete";
import { AdminPage, ChangePassword, InvitePage, LoginPage } from "./pages/Account";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/me" element={<RequireRole roles={["athlete"]}><AthleteApp /></RequireRole>} />
          <Route element={<RequireRole roles={["clinician", "admin"]}><ClinicianLayout /></RequireRole>}>
            <Route path="/" element={<Home />} />
            <Route path="/c/:id" element={<CasePage />} />
            <Route path="/c/:id/report" element={<ReportPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/protocols" element={<ProtocolsPage />} />
            <Route path="/consent" element={<ConsentFormPage />} />
            <Route path="/c/:id/consent" element={<ConsentRecordPage />} />
            <Route path="/account" element={<ChangePassword />} />
            <Route path="/admin" element={<RequireRole roles={["admin"]}><AdminPage /></RequireRole>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
