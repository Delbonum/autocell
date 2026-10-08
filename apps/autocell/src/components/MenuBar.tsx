import { Fragment } from 'react';

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
  checked?: boolean;
  /** Zusatzinfo als Tooltip, z. B. der Ordner einer Datei. */
  hint?: string;
  separator?: false;
}

export type MenuEntry = MenuItem | { separator: true };

export interface MenuDef {
  id: string;
  label: string;
  items: MenuEntry[];
}

interface Props {
  menus: MenuDef[];
  open: string | null;
  onOpen: (id: string | null) => void;
}

export function MenuBar({ menus, open, onOpen }: Props) {
  return (
    <>
      {open && <button className="click-catcher" aria-label="Menü schließen" onClick={() => onOpen(null)} />}
      <nav className="menubar" aria-label="Hauptmenü">
        {menus.map((m) => (
          <div className="menu" key={m.id}>
            <button
              className="menu-button"
              aria-haspopup="menu"
              aria-expanded={open === m.id}
              onClick={() => onOpen(open === m.id ? null : m.id)}
              onMouseEnter={() => open && open !== m.id && onOpen(m.id)}
            >
              {m.label}
            </button>
            {open === m.id && (
              <div className="menu-dropdown" role="menu" aria-label={m.label}>
                {m.items.map((it, i) =>
                  it.separator ? (
                    <div className="menu-sep" key={i} role="separator" />
                  ) : (
                    <Fragment key={i}>
                      <button
                        className="menu-item"
                        role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                        aria-checked={it.checked}
                        disabled={it.disabled}
                        title={it.hint}
                        onClick={() => {
                          onOpen(null);
                          it.action?.();
                        }}
                      >
                        {it.checked !== undefined && <span className="menu-check">{it.checked ? '✓' : ''}</span>}
                        <span className="menu-label">{it.label}</span>
                        {it.shortcut && <span className="menu-shortcut">{it.shortcut}</span>}
                      </button>
                    </Fragment>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
      </nav>
    </>
  );
}
