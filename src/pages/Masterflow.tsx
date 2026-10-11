import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ProtectedRoute from "@/components/ProtectedRoute";

const MasterflowContent = () => {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    import("@/content/master-workflow.html?raw")
      .then((module) => setHtml(module.default))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <section className="section-container flex min-h-[60vh] items-center justify-center pt-28">
        <p className="text-muted-foreground">Could not load the master workflow. Try again later.</p>
      </section>
    );
  }

  if (!html) {
    return (
      <section className="section-container flex min-h-[60vh] items-center justify-center pt-28">
        <p className="text-muted-foreground">Loading master workflow...</p>
      </section>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-x-0 bottom-0 top-[68px] z-40 bg-[#070810]"
    >
      <iframe
        title="Master Workflow Command Center"
        srcDoc={html}
        sandbox="allow-scripts allow-same-origin"
        className="h-full w-full border-0"
      />
    </motion.div>
  );
};

const Masterflow = () => (
  <ProtectedRoute>
    <MasterflowContent />
  </ProtectedRoute>
);

export default Masterflow;
