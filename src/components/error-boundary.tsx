import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (e: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Detecta errores típicos de "removeChild" / "insertBefore" causados por
 * extensiones de traducción (Google Translate, DeepL) que mutan el DOM
 * fuera del control de React. En esos casos la app puede recuperarse
 * remontando el árbol después de un tick.
 */
const TRANSLATE_DOM_PATTERNS = [
  "removeChild",
  "insertBefore",
  "Failed to execute 'removeChild'",
  "is not a child of this node",
  "no es hijo de este nodo",
];

const isTranslateDomError = (e: Error): boolean => {
  const msg = (e.message ?? "").toLowerCase();
  return TRANSLATE_DOM_PATTERNS.some((p) => msg.includes(p.toLowerCase()));
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
    if (isTranslateDomError(error)) {
      // Intento de auto-recuperación: re-render limpio en el siguiente tick.
      setTimeout(() => this.setState({ error: null }), 50);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error);
      const isTranslate = isTranslateDomError(this.state.error);
      return (
        <div role="alert" className="m-6 rounded-lg border border-destructive/40 bg-destructive/10 p-6">
          <h2 className="mb-2 text-base font-semibold text-destructive">
            {isTranslate ? "Conflicto con el traductor del navegador" : "Ha ocurrido un error inesperado"}
          </h2>
          {isTranslate ? (
            <div className="mb-4 space-y-2 text-sm text-foreground/80">
              <p>
                Tu navegador está traduciendo automáticamente la página y eso interfiere con
                React. Para que la app funcione correctamente:
              </p>
              <ol className="ml-5 list-decimal space-y-1 text-xs">
                <li>Click derecho sobre la página → <strong>"Mostrar el original"</strong> / <em>"Show original"</em>.</li>
                <li>O en la barra de URL, click en el icono del traductor y elige no traducir.</li>
                <li>O cambia el idioma de la app desde el botón <kbd className="rounded border border-border px-1">ES/EN</kbd> del header.</li>
              </ol>
              <p className="text-xs italic">Voy a reintentar automáticamente en un instante…</p>
            </div>
          ) : (
            <p className="mb-4 text-sm text-foreground/80">{this.state.error.message}</p>
          )}
          <button
            onClick={this.reset}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
