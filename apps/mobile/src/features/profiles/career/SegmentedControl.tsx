import { TabBar, type TabBarItem } from "../../../ui";

type SegmentedControlOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
};

/**
 * Selettore a segmenti. Delega alla `TabBar` condivisa: il design ProLink
 * (§1a) ha un solo modo di segnare una selezione fra viste — testo blu con
 * indicatore 2px — e il vecchio segmento pieno su fondo grigio leggeva come un
 * gruppo di bottoni.
 *
 * Resta un componente a sé perché l'API (`options`/`value`) è già usata in tre
 * punti e non vale la pena riscriverne le chiamate.
 */
export function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <TabBar
      active={value}
      fill
      items={options as readonly TabBarItem<T>[]}
      onChange={onChange}
    />
  );
}
