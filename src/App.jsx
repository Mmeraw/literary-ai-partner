import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MvpLayout from "./layouts/MvpLayout.jsx";

// Your landing page
import Home from "./pages/Home.jsx";          // adjust path if Home.jsx lives elsewhere
// Evaluation tool
import Evaluate from "./pages/Evaluate.jsx";  // current tool page

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MvpLayout />}>
          {/* Landing page at / and revisiongrade.com */}
          <Route path="/" element={<Home />} />

          {/* Evaluation tool behind the shell */}
          <Route path="/evaluate" element={<Evaluate />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
