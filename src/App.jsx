import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MvpLayout from "./layouts/MvpLayout.jsx";
import MvpLanding from "./pages/MvpLanding.jsx";
import Evaluate from "./pages/Evaluate.jsx";
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MvpLayout />}>
          <Route path="/" element={<MvpLanding />} />
                        <Route path="/evaluate" element={<Evaluate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
                      </Route>
      </Routes>
    </BrowserRouter>
  );
}
