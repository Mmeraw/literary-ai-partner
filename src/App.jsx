import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Simple landing page (we'll create this next)
import Home from "./pages/Home.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

