import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MvpLayout from "./layouts/MvpLayout.jsx";
import MvpLanding from "./pages/MvpLanding.jsx";
import MvpEvaluate from "./pages/MvpEvaluate.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MvpLayout />}>
          <Route path="/" element={<MvpLanding />} />
          <Route path="/evaluate" element={<MvpEvaluate />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
