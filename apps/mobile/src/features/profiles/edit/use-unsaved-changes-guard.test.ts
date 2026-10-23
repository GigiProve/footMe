/**
 * Le tre azioni del dialogo di uscita.
 *
 * La terza, «Salva bozza ed esci», è arrivata con DAS-REV-16 §27. Il rischio
 * reale non è che manchi: è che compaia anche dove non era prevista,
 * cambiando il dialogo dei sei editor di profilo già approvati con due sole
 * azioni.
 */
import { createElement } from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi, beforeEach } from "vitest";

const alert = vi.fn();
const listeners: ((event: unknown) => void)[] = [];

vi.mock("react-native", () => ({
  Alert: { alert: (...args: unknown[]) => alert(...args) },
}));

vi.mock("expo-router", () => ({
  useNavigation: () => ({
    addListener: (_type: string, callback: (event: unknown) => void) => {
      listeners.push(callback);

      return () => {
        listeners.splice(listeners.indexOf(callback), 1);
      };
    },
    dispatch: vi.fn(),
  }),
}));

const { useUnsavedChangesGuard } = await import("./use-unsaved-changes-guard");

type GuardOptions = Parameters<typeof useUnsavedChangesGuard>[0];

/**
 * Il progetto non ha `@testing-library/react-native`: un hook si prova
 * montandolo in un componente minimo con `react-test-renderer`, come fanno
 * gli altri test della cartella `ui`.
 */
function renderGuard(options: GuardOptions): { current: () => void } {
  const ref: { current: () => void } = { current: () => undefined };

  function Probe() {
    ref.current = useUnsavedChangesGuard(options);

    return null;
  }

  act(() => {
    create(createElement(Probe));
  });

  return ref;
}

type AlertButton = { onPress?: () => void; style?: string; text: string };

function buttons(): AlertButton[] {
  return alert.mock.calls.at(-1)?.[2] ?? [];
}

beforeEach(() => {
  alert.mockReset();
  listeners.length = 0;
});

describe("azioni del dialogo", () => {
  it("senza onSaveAndLeave resta a due azioni", () => {
    const result = renderGuard({ isDirty: true, isSaving: false, onLeave: vi.fn() });

    result.current();

    expect(buttons().map((button) => button.text)).toEqual([
      "Continua a modificare",
      "Esci senza salvare",
    ]);
  });

  it("con onSaveAndLeave la terza azione sta in mezzo (§27)", () => {
    const onSaveAndLeave = vi.fn();
    const result = renderGuard({
        isDirty: true,
        isSaving: false,
        onLeave: vi.fn(),
        onSaveAndLeave,
      });

    result.current();

    expect(buttons().map((button) => button.text)).toEqual([
      "Continua a modificare",
      "Salva bozza ed esci",
      "Esci senza salvare",
    ]);

    buttons()[1].onPress?.();
    expect(onSaveAndLeave).toHaveBeenCalledTimes(1);
  });

  it("senza modifiche si esce senza chiedere nulla", () => {
    const onLeave = vi.fn();
    const result = renderGuard({ isDirty: false, isSaving: false, onLeave });

    result.current();

    expect(alert).not.toHaveBeenCalled();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("durante un salvataggio non si esce e non si chiede", () => {
    const onLeave = vi.fn();
    const result = renderGuard({ isDirty: true, isSaving: true, onLeave });

    result.current();

    expect(alert).not.toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });
});

describe("back di sistema e gesture", () => {
  it("il listener beforeRemove propone le stesse azioni", () => {
    renderGuard({
        isDirty: true,
        isSaving: false,
        onLeave: vi.fn(),
        onSaveAndLeave: vi.fn(),
      });

    const preventDefault = vi.fn();
    listeners[0]({ data: { action: { type: "POP" } }, preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(buttons().map((button) => button.text)).toEqual([
      "Continua a modificare",
      "Salva bozza ed esci",
      "Esci senza salvare",
    ]);
  });

  it("senza modifiche il back di sistema non viene bloccato", () => {
    renderGuard({ isDirty: false, isSaving: false, onLeave: vi.fn() });

    const preventDefault = vi.fn();
    listeners[0]({ data: { action: { type: "POP" } }, preventDefault });

    expect(preventDefault).not.toHaveBeenCalled();
  });
});
