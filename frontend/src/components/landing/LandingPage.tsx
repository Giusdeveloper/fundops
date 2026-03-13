"use client";

import Hero from "./Hero";
import SocialProof from "./SocialProof";
import ProductShowcase from "./ProductShowcase";
import ProcessShowcase from "./ProcessShowcase";
import LoiJourneyShowcase from "./LoiJourneyShowcase";
import CapTableShowcase from "./CapTableShowcase";
import Features from "./Features";
import HowItWorks from "./HowItWorks";
import Faq from "./Faq";
import CtaBlock from "./CtaBlock";
import Footer from "./Footer";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <div className={styles.wrapper}>
      <Hero />
      <SocialProof />
      <ProductShowcase />
      <ProcessShowcase />
      <LoiJourneyShowcase />
      <CapTableShowcase />
      <Features />
      <HowItWorks />
      <Faq />
      <CtaBlock />
      <Footer />
    </div>
  );
}
