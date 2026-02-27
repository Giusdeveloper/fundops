"use client";

import ViewModeToggle from "@/components/ViewModeToggle";

export default function InvestorHeaderViewModeToggle() {
  return (
    <ViewModeToggle
      onChanged={(m) => {
        window.location.href = m === "investor" ? "/investor/dashboard" : "/dashboard";
      }}
    />
  );
}

