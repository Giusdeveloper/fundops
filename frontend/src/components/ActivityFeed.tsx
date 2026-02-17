import React from "react";
import { List } from 'lucide-react';

const ActivityFeed = () => {
  return (
    <div style={{ padding: 16, color: '#f3f4f6' }}>
      <h2 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <List size={20} style={{ marginRight: 6 }} />
        Attività recenti
      </h2>
      <ul>
        <li>Utente Mario ha investito 500€</li>
        <li>Nuovo progetto pubblicato: Green Energy</li>
        <li>Utente Anna ha commentato una campagna</li>
      </ul>
    </div>
  );
};

export default ActivityFeed; 