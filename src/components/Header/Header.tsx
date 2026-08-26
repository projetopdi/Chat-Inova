import { EXTERNAL_LINKS } from '../../constants/links'
import { ASSETS_POR_MODELO } from '../../constants/assets'
import type { Modelo } from '../../constants/modelos'
import ufcInovaLogo from '../../assets/ufc-inova-logo.svg'
import './Header.css'

interface HeaderProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
  modelo: Modelo
}

function Header({ isSidebarOpen, onToggleSidebar, modelo }: HeaderProps) {
  const { wordmark, wordmarkAlt } = ASSETS_POR_MODELO[modelo]

  return (
    <header className="header">
      <button
        type="button"
        className="header__sidebar-toggle"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? 'Recolher barra lateral' : 'Mostrar barra lateral'}
        aria-expanded={isSidebarOpen}
        aria-controls="sidebar"
      >
        <span />
        <span />
        <span />
      </button>
      {/* O wordmark do v3 já traz o nome desenhado, então ele é a marca inteira
          — o mascote separado e o texto "Chat Inova" saíram do design (node 85:3832
          / 85:4106). O alt carrega o nome para quem usa leitor de tela. */}
      <div className="header__brand">
        <img src={wordmark} alt={wordmarkAlt} className="header__wordmark-img" />
      </div>
      <a
        href={EXTERNAL_LINKS.ufcInova}
        target="_blank"
        rel="noopener noreferrer"
        className="header__inova-link"
        aria-label="Site do UFC Inova"
      >
        <img src={ufcInovaLogo} alt="UFC Inova" className="header__inova-logo" />
      </a>
    </header>
  )
}

export default Header
