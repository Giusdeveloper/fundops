"use client";

import styles from "./Faq.module.css";

const faqs = [
  {
    q: "Che cos'è FundOps?",
    a: "È una piattaforma pensata per i team che gestiscono round di fundraising: ti aiuta a tenere insieme supporter, LOI, documenti e stato dei round in un unico flusso.",
  },
  {
    q: "Per chi è pensato FundOps?",
    a: "Per startup, veicoli di investimento e advisor che vogliono smettere di usare mille fogli diversi per gestire supporter, LOI e stato del fundraising.",
  },
  {
    q: "Dove vengono gestiti i dati dei supporter?",
    a: "I dati vengono gestiti con attenzione alla privacy e alle best practice GDPR, usando infrastrutture con controllo degli accessi, auditing e gestione centralizzata dei permessi.",
  },
  {
    q: "Serve cambiare subito tutti i processi attuali?",
    a: "No: puoi iniziare importando i dati esistenti (es. fogli Excel) e usare FundOps solo per una parte del flusso, ad esempio la gestione delle LOI, e poi estenderlo.",
  },
];

export default function Faq() {
  return (
    <section className={styles.section} aria-label="Domande frequenti su FundOps">
      <h2 className={styles.title}>Domande frequenti</h2>
      <div className={styles.list}>
        {faqs.map((item) => (
          <article key={item.q} className={styles.item}>
            <h3 className={styles.q}>{item.q}</h3>
            <p className={styles.a}>{item.a}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

