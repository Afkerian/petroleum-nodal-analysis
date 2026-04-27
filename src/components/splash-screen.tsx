import { Droplet } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Props {
  onStart: () => void;
}

export function SplashScreen({ onStart }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-background to-muted">
      <div className="animate-in fade-in zoom-in-95 mx-auto w-full max-w-md rounded-2xl border border-border/40 bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
          <Droplet className="h-10 w-10" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-primary">VIOLET</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("splash.subtitle")}</p>
        <p className="mt-4 text-xs italic text-muted-foreground">
          IPR · VLP · PVT · Análisis Nodal
        </p>
        <button
          onClick={onStart}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t("splash.start")}
        </button>
      </div>
    </div>
  );
}
