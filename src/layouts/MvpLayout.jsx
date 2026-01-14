import React from "react";

const MvpLayout = ({ children }) => {
  return (
    <div style={{ minHeight: "100vh" }}>
      {children}
    </div>
  );
};

export default MvpLayout;
