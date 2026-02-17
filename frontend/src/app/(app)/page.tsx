"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Reindirizza alla pagina companies per selezionare un'azienda
    router.replace("/companies");
  }, [router]);

  // Mostra un messaggio di caricamento durante il redirect
  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      color: "var(--text-primary)"
    }}>
      <p>Reindirizzamento...</p>
    </div>
  );
} 