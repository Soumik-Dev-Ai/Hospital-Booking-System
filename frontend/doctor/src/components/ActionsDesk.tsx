import { motion } from "framer-motion";
import { useWorkspace, type ActionIntent } from "../lib/store";
import CreateChecklist from "./CreateChecklist";
import UploadPrescription from "./UploadPrescription";

export default function ActionsDesk({
  intent,
}: {
  intent: ActionIntent | null;
}) {
  const { doctor } = useWorkspace();

  return (
    <div className="space-y-7">
      {/* hero */}
      <header>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-3 text-[10.5px] font-semibold tracking-[0.3em] text-gold-soft/90 uppercase"
        >
          <span className="h-px w-9 bg-gold/50" />
          Doctor Workspace · Desk 02
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 font-display text-4xl tracking-tight text-alabaster sm:text-5xl"
        >
          The <em className="text-gold-soft italic">Action</em> Desk
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-2.5 max-w-lg text-sm leading-relaxed text-sage"
        >
          Issue prescriptions and assign medical checklists – {doctor.name}'s
          schedule ledger updates the moment a document leaves this desk.
        </motion.p>
      </header>

      {/* panels */}
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-3"
        >
          <UploadPrescription intent={intent} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-2"
        >
          <CreateChecklist intent={intent} />
        </motion.div>
      </div>
    </div>
  );
}
