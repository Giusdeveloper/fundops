import React from "react";
import CompanySwitcher from "./CompanySwitcher";

const Header = () => {
  return (
    <header className="main-header">
      <h1 className="header-title">FundOps - Dashboard</h1>
      <div className="header-actions">
        <CompanySwitcher />
      </div>
    </header>
  );
};

export default Header; 