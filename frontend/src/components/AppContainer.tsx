import React from 'react';
import './AppContainer.css';

interface AppContainerProps {
  children: React.ReactNode;
}

export default function AppContainer({ children }: AppContainerProps) {
  return (
    <main className="app-main">
      <div className="app-container">
        {children}
      </div>
    </main>
  );
}
