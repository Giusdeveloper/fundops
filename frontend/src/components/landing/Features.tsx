"use client";

import { Users, FileSignature, LayoutDashboard, FolderOpen } from "lucide-react";
import styles from "./Features.module.css";

const items = [
  {
    icon: Users,
    title: "Supporter",
    description:
      "Anagrafica completa dei supporter, import CSV e collegamento alle aziende. Tutto sotto controllo in un unico posto.",
  },
  {
    icon: FileSignature,
    title: "LOI e reminder",
    description: "Lettere d'intento, invio, reminder e firma. Segui le scadenze e le fasi di ogni LOI senza perdere colpi.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard e KPI",
    description: "Pipeline, capitali in gioco e todo in tempo reale. Metriche chiare per decidere in fretta.",
  },
  {
    icon: FolderOpen,
    title: "Dossier e Cap Table",
    description: "Documenti per round, integrazione con Google Drive e simulatore cap table per scenari e baseline.",
  },
];

export default function Features() {
  return (
    <section id="features" className={styles.section}>
      <h2 className={styles.title}>Tutto ciò che ti serve per il fundraising</h2>
      <div className={styles.grid}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={styles.card}>
              <div className={styles.iconWrap}>
                <Icon size={24} strokeWidth={2.2} />
              </div>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardDesc}>{item.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
