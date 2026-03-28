import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const Hero = () => (
  <section className="section-container flex min-h-[85vh] flex-col justify-center pt-28">
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-3xl"
    >
      <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-primary">
        Marketplace Strategist · SaaS Founder · AI Architect
      </p>
      <h1 className="mb-6 font-display text-4xl font-medium leading-tight tracking-tight text-foreground md:text-6xl lg:text-7xl">
        Building the operating system for{" "}
        <em className="text-primary">EU marketplace sellers</em>.
      </h1>
      <p className="mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground">
        I'm Hans — founder of{" "}
        <a href="https://marketplacegrowth.nl" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
          MarketplaceGrowth.nl
        </a>
        , a SaaS platform combining AI content generation, per-SKU profitability tracking,
        and marketplace intelligence across Amazon, Bol.com, and 5 EU markets.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link
          to="/work"
          className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-all duration-300 hover:gap-3"
        >
          View my work
          <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
        <a
          href="https://marketplacegrowth.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 rounded-full border border-primary/30 px-6 py-3 text-sm font-medium text-primary transition-colors duration-300 hover:bg-primary/5"
        >
          <Sparkles size={14} />
          MarketplaceGrowth.nl
        </a>
        <Link
          to="/about"
          className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors duration-300 hover:bg-secondary"
        >
          About me
        </Link>
      </div>
    </motion.div>
  </section>
);

export default Hero;
